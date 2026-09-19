package controllers

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"time"

	"livepoll/backend/models"
	"livepoll/backend/repository"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type VoteController struct {
	mongoRepo repository.MongoRepository
	redisRepo repository.RedisRepository
}

func NewVoteController(mongoRepo repository.MongoRepository, redisRepo repository.RedisRepository) *VoteController {
	return &VoteController{
		mongoRepo: mongoRepo,
		redisRepo: redisRepo,
	}
}

func hashVoter(pollID, voterID string) string {
	hasher := sha256.New()
	hasher.Write([]byte(fmt.Sprintf("%s:%s", pollID, voterID)))
	return hex.EncodeToString(hasher.Sum(nil))
}

func (vc *VoteController) CastVote(c *gin.Context) {
	pollIDStr := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(pollIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	var req models.VoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Fetch Poll from MongoDB
	poll, err := vc.mongoRepo.FindPollByID(c.Request.Context(), pollID)
	if err != nil {
		if errors.Is(err, repository.ErrPollNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch poll"})
		return
	}

	// 2. Validate Poll Status
	if poll.Settings.IsClosed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This poll is closed and no longer accepting votes"})
		return
	}

	// 3. Validate Single vs Multiple Choice Rule
	if !poll.Settings.AllowMultiple && len(req.OptionIDs) > 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This poll only allows selecting a single option"})
		return
	}

	// 4. Validate that all submitted options exist on this poll
	validOptionMap := make(map[string]bool)
	for _, opt := range poll.Options {
		validOptionMap[opt.ID] = true
	}
	for _, optID := range req.OptionIDs {
		if !validOptionMap[optID] {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid option selected: %s", optID)})
			return
		}
	}

	// 5. Generate secure voter hash
	voterHash := hashVoter(pollIDStr, req.VoterID)

	// 6. Redis Atomic Voter Deduplication & Increment
	counts, totalVotes, err := vc.redisRepo.RecordVote(c.Request.Context(), pollIDStr, voterHash, req.OptionIDs)
	if err != nil {
		if errors.Is(err, repository.ErrAlreadyVoted) {
			c.JSON(http.StatusConflict, gin.H{"error": "You have already voted in this poll"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record vote"})
		return
	}

	// 7. Asynchronously update MongoDB TotalVotes & write audit log
	go func() {
		ctx := c.Request.Context()
		_ = vc.mongoRepo.UpdatePollTotalVotes(ctx, pollID, totalVotes)

		ipHash := hex.EncodeToString(sha256.New().Sum([]byte(c.ClientIP())))
		voteRecord := &models.Vote{
			PollID:    pollID,
			VoterHash: voterHash,
			OptionIDs: req.OptionIDs,
			IPHash:    ipHash,
		}
		_ = vc.mongoRepo.RecordVoteAudit(ctx, voteRecord)
	}()

	// 8. Publish Event to Redis Pub/Sub (fans out to all WebSocket clients)
	update := &models.LivePollUpdate{
		Type:       "VOTE_UPDATE",
		PollID:     pollIDStr,
		TotalVotes: totalVotes,
		Counts:     counts,
		IsClosed:   poll.Settings.IsClosed,
		Timestamp:  time.Now(),
	}
	_ = vc.redisRepo.PublishEvent(c.Request.Context(), pollIDStr, update)

	c.JSON(http.StatusOK, gin.H{
		"message":     "Vote recorded successfully",
		"total_votes": totalVotes,
		"counts":      counts,
	})
}
