package controllers

import (
	"crypto/rand"
	"errors"
	"math/big"
	"net/http"
	"strings"
	"time"

	"livepoll/backend/models"
	"livepoll/backend/repository"
	"livepoll/backend/websocket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PollController struct {
	mongoRepo repository.MongoRepository
	redisRepo repository.RedisRepository
	hub       *websocket.Hub
}

func NewPollController(mongoRepo repository.MongoRepository, redisRepo repository.RedisRepository, hub *websocket.Hub) *PollController {
	return &PollController{
		mongoRepo: mongoRepo,
		redisRepo: redisRepo,
		hub:       hub,
	}
}

func generatePollCode() string {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Avoid easily confused characters (I, 1, O, 0)
	b := make([]byte, 6)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		b[i] = charset[n.Int64()]
	}
	return string(b)
}

func (pc *PollController) CreatePoll(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.CreatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build options with unique UUIDs
	var options []models.Option
	for _, opt := range req.Options {
		trimmed := strings.TrimSpace(opt.Text)
		if trimmed == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Option text cannot be empty"})
			return
		}
		options = append(options, models.Option{
			ID:        uuid.New().String()[:8],
			Text:      trimmed,
			VoteCount: 0,
		})
	}

	code := generatePollCode()

	poll := &models.Poll{
		ID:          primitive.NewObjectID(),
		CreatorID:   userID.(primitive.ObjectID),
		Title:       strings.TrimSpace(req.Title),
		Description: strings.TrimSpace(req.Description),
		Code:        code,
		Options:     options,
		Settings: models.PollSettings{
			AllowMultiple:         req.AllowMultiple,
			ShowResultsBeforeVote: req.ShowResultsBeforeVote,
			IsClosed:              false,
		},
		TotalVotes: 0,
	}

	if err := pc.mongoRepo.CreatePoll(c.Request.Context(), poll); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create poll"})
		return
	}

	c.JSON(http.StatusCreated, poll)
}

func (pc *PollController) GetPoll(c *gin.Context) {
	identifier := strings.TrimSpace(c.Param("id"))
	if identifier == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poll identifier is required"})
		return
	}

	var poll *models.Poll
	var err error

	// Check if identifier is a MongoDB ObjectID hex or a 6-char poll code
	if objID, parseErr := primitive.ObjectIDFromHex(identifier); parseErr == nil {
		poll, err = pc.mongoRepo.FindPollByID(c.Request.Context(), objID)
	} else {
		poll, err = pc.mongoRepo.FindPollByCode(c.Request.Context(), strings.ToUpper(identifier))
	}

	if err != nil {
		if errors.Is(err, repository.ErrPollNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch poll"})
		return
	}

	// Read live real-time counts from Redis
	liveCounts, totalVotes, err := pc.redisRepo.GetPollCounts(c.Request.Context(), poll.ID.Hex())
	if err == nil && len(liveCounts) > 0 {
		for i := range poll.Options {
			if count, ok := liveCounts[poll.Options[i].ID]; ok {
				poll.Options[i].VoteCount = count
			}
		}
		poll.TotalVotes = totalVotes
	}

	c.JSON(http.StatusOK, gin.H{
		"poll":         poll,
		"viewer_count": pc.hub.GetViewerCount(poll.ID.Hex()),
	})
}

func (pc *PollController) GetMyPolls(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	polls, err := pc.mongoRepo.FindPollsByCreator(c.Request.Context(), userID.(primitive.ObjectID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch polls"})
		return
	}

	// Enrich with live counts from Redis
	for i := range polls {
		liveCounts, totalVotes, err := pc.redisRepo.GetPollCounts(c.Request.Context(), polls[i].ID.Hex())
		if err == nil && len(liveCounts) > 0 {
			for j := range polls[i].Options {
				if count, ok := liveCounts[polls[i].Options[j].ID]; ok {
					polls[i].Options[j].VoteCount = count
				}
			}
			polls[i].TotalVotes = totalVotes
		}
	}

	c.JSON(http.StatusOK, polls)
}

type ToggleStatusRequest struct {
	IsClosed bool `json:"is_closed"`
}

func (pc *PollController) TogglePollStatus(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	pollIDStr := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(pollIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	poll, err := pc.mongoRepo.FindPollByID(c.Request.Context(), pollID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
		return
	}

	if poll.CreatorID != userID.(primitive.ObjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to modify this poll"})
		return
	}

	var req ToggleStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := pc.mongoRepo.UpdatePollStatus(c.Request.Context(), pollID, req.IsClosed); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update poll status"})
		return
	}

	// Fetch current counts to publish
	counts, total, _ := pc.redisRepo.GetPollCounts(c.Request.Context(), pollIDStr)

	// Publish status change to Redis Pub/Sub -> WebSocket fanout
	update := &models.LivePollUpdate{
		Type:       "STATUS_CHANGE",
		PollID:     pollIDStr,
		TotalVotes: total,
		Counts:     counts,
		IsClosed:   req.IsClosed,
		Timestamp:  time.Now(),
	}
	_ = pc.redisRepo.PublishEvent(c.Request.Context(), pollIDStr, update)

	c.JSON(http.StatusOK, gin.H{
		"message":   "Poll status updated",
		"is_closed": req.IsClosed,
	})
}

func (pc *PollController) ResetPoll(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	pollIDStr := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(pollIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	poll, err := pc.mongoRepo.FindPollByID(c.Request.Context(), pollID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Poll not found"})
		return
	}

	if poll.CreatorID != userID.(primitive.ObjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to reset this poll"})
		return
	}

	// Reset Redis counts and voters set
	if err := pc.redisRepo.ResetPollCounts(c.Request.Context(), pollIDStr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset counts in Redis"})
		return
	}

	// Reset MongoDB total_votes
	_ = pc.mongoRepo.UpdatePollTotalVotes(c.Request.Context(), pollID, 0)

	// Broadcast reset event
	emptyCounts := make(map[string]int64)
	for _, opt := range poll.Options {
		emptyCounts[opt.ID] = 0
	}

	update := &models.LivePollUpdate{
		Type:       "VOTE_UPDATE",
		PollID:     pollIDStr,
		TotalVotes: 0,
		Counts:     emptyCounts,
		IsClosed:   poll.Settings.IsClosed,
		Timestamp:  time.Now(),
	}
	_ = pc.redisRepo.PublishEvent(c.Request.Context(), pollIDStr, update)

	c.JSON(http.StatusOK, gin.H{"message": "Poll reset successfully"})
}

func (pc *PollController) DeletePoll(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	pollIDStr := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(pollIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid poll ID"})
		return
	}

	if err := pc.mongoRepo.DeletePoll(c.Request.Context(), pollID, userID.(primitive.ObjectID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete poll"})
		return
	}

	_ = pc.redisRepo.ResetPollCounts(c.Request.Context(), pollIDStr)

	c.JSON(http.StatusOK, gin.H{"message": "Poll deleted successfully"})
}
