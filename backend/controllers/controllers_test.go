package controllers_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"livepoll/backend/controllers"
	"livepoll/backend/middleware"
	"livepoll/backend/models"
	"livepoll/backend/repository"
	"livepoll/backend/websocket"

	"github.com/gin-gonic/gin"
)

func setupTestApp() (*gin.Engine, repository.MongoRepository, repository.RedisRepository, string) {
	gin.SetMode(gin.TestMode)
	jwtSecret := "test_secret_key"

	// These will use the in-memory fallback repos if local services aren't running
	mongoRepo := repository.NewMongoRepository("mongodb://localhost:27017", "livepoll_test")
	redisRepo := repository.NewRedisRepository("localhost:6379", "")
	hub := websocket.NewHub(redisRepo)
	go hub.Run()

	authCtrl := controllers.NewAuthController(mongoRepo, jwtSecret)
	pollCtrl := controllers.NewPollController(mongoRepo, redisRepo, hub)
	voteCtrl := controllers.NewVoteController(mongoRepo, redisRepo)

	r := gin.New()
	r.Use(gin.Recovery())

	// Public Auth
	r.POST("/api/auth/register", authCtrl.Register)
	r.POST("/api/auth/login", authCtrl.Login)

	// Protected Auth & Polls
	authGroup := r.Group("")
	authGroup.Use(middleware.AuthMiddleware(jwtSecret))
	{
		authGroup.GET("/api/auth/me", authCtrl.Me)
		authGroup.POST("/api/polls", pollCtrl.CreatePoll)
		authGroup.GET("/api/polls/my", pollCtrl.GetMyPolls)
		authGroup.PATCH("/api/polls/:id/toggle", pollCtrl.TogglePollStatus)
	}

	// Public Poll & Voting
	r.GET("/api/polls/:id", pollCtrl.GetPoll)
	r.POST("/api/polls/:id/vote", voteCtrl.CastVote)

	return r, mongoRepo, redisRepo, jwtSecret
}

func TestAuthAndPollWorkflow(t *testing.T) {
	router, _, _, _ := setupTestApp()

	// 1. Register a creator
	regPayload := models.RegisterRequest{
		Email:    "host@example.com",
		Password: "password123",
		Name:     "Host Alice",
	}
	body, _ := json.Marshal(regPayload)
	req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected status 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var authResp models.AuthResponse
	_ = json.Unmarshal(w.Body.Bytes(), &authResp)
	token := authResp.Token

	// 2. Create a Poll
	createPollPayload := models.CreatePollRequest{
		Title:       "What is your favorite cloud database?",
		Description: "Live voting test",
		Options: []models.CreatePollOption{
			{Text: "MongoDB"},
			{Text: "Redis"},
			{Text: "PostgreSQL"},
		},
		AllowMultiple: false,
	}
	body, _ = json.Marshal(createPollPayload)
	req = httptest.NewRequest("POST", "/api/polls", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected status 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var poll models.Poll
	_ = json.Unmarshal(w.Body.Bytes(), &poll)
	if len(poll.Options) != 3 {
		t.Fatalf("Expected 3 options, got %d", len(poll.Options))
	}
	if poll.Code == "" {
		t.Fatalf("Expected a 6-character poll code")
	}

	pollID := poll.ID.Hex()
	optID1 := poll.Options[0].ID

	// 3. Cast a valid vote
	votePayload := models.VoteRequest{
		OptionIDs: []string{optID1},
		VoterID:   "voter_device_fingerprint_001",
	}
	body, _ = json.Marshal(votePayload)
	req = httptest.NewRequest("POST", "/api/polls/"+pollID+"/vote", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK for vote, got %d: %s", w.Code, w.Body.String())
	}

	// 4. Test Duplicate Vote Prevention (Same Voter ID)
	req = httptest.NewRequest("POST", "/api/polls/"+pollID+"/vote", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("Expected status 409 Conflict for duplicate vote, got %d", w.Code)
	}

	// 5. Test Multiple Choice Validation Violation (when AllowMultiple=false)
	optID2 := poll.Options[1].ID
	multiVotePayload := models.VoteRequest{
		OptionIDs: []string{optID1, optID2},
		VoterID:   "voter_device_fingerprint_002",
	}
	body, _ = json.Marshal(multiVotePayload)
	req = httptest.NewRequest("POST", "/api/polls/"+pollID+"/vote", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("Expected status 400 Bad Request for invalid multi-vote, got %d", w.Code)
	}

	// 6. Test Fetch Poll by 6-character short code
	req = httptest.NewRequest("GET", "/api/polls/"+poll.Code, nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK for GET by code, got %d: %s", w.Code, w.Body.String())
	}

	// 7. Toggle Poll to Closed
	togglePayload := controllers.ToggleStatusRequest{IsClosed: true}
	body, _ = json.Marshal(togglePayload)
	req = httptest.NewRequest("PATCH", "/api/polls/"+pollID+"/toggle", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK for toggle, got %d", w.Code)
	}

	// 8. Try to vote on closed poll -> should be rejected
	newVoterPayload := models.VoteRequest{
		OptionIDs: []string{optID2},
		VoterID:   "voter_device_fingerprint_003",
	}
	body, _ = json.Marshal(newVoterPayload)
	req = httptest.NewRequest("POST", "/api/polls/"+pollID+"/vote", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("Expected status 400 Bad Request for closed poll vote, got %d", w.Code)
	}
}

func TestConcurrentVoting(t *testing.T) {
	router, _, _, _ := setupTestApp()

	// 1. Create creator and poll
	regPayload := models.RegisterRequest{Email: "concurr@test.com", Password: "password123", Name: "Stress Tester"}
	body, _ := json.Marshal(regPayload)
	req := httptest.NewRequest("POST", "/api/auth/register", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var authResp models.AuthResponse
	_ = json.Unmarshal(w.Body.Bytes(), &authResp)

	pollPayload := models.CreatePollRequest{
		Title:   "Concurrent Voting Benchmark",
		Options: []models.CreatePollOption{{Text: "Option Alpha"}, {Text: "Option Beta"}},
	}
	body, _ = json.Marshal(pollPayload)
	req = httptest.NewRequest("POST", "/api/polls", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authResp.Token)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var poll models.Poll
	_ = json.Unmarshal(w.Body.Bytes(), &poll)
	pollID := poll.ID.Hex()
	optID := poll.Options[0].ID

	// 2. Cast 20 concurrent unique votes
	const voterCount = 20
	done := make(chan bool, voterCount)

	for i := 0; i < voterCount; i++ {
		go func(idx int) {
			voteBody, _ := json.Marshal(models.VoteRequest{
				OptionIDs: []string{optID},
				VoterID:   fmt.Sprintf("concurrent_device_%d", idx),
			})
			vReq := httptest.NewRequest("POST", "/api/polls/"+pollID+"/vote", bytes.NewBuffer(voteBody))
			vReq.Header.Set("Content-Type", "application/json")
			vRec := httptest.NewRecorder()
			router.ServeHTTP(vRec, vReq)
			if vRec.Code == http.StatusOK {
				done <- true
			} else {
				done <- false
			}
		}(i)
	}

	successCount := 0
	for i := 0; i < voterCount; i++ {
		if <-done {
			successCount++
		}
	}

	if successCount != voterCount {
		t.Fatalf("Expected %d successful concurrent votes, got %d", voterCount, successCount)
	}

	// 3. Fetch poll and verify total votes
	getReq := httptest.NewRequest("GET", "/api/polls/"+pollID, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)

	var res struct {
		Poll models.Poll `json:"poll"`
	}
	_ = json.Unmarshal(getRec.Body.Bytes(), &res)

	if res.Poll.TotalVotes != int64(voterCount) {
		t.Fatalf("Expected %d total votes tallied, got %d", voterCount, res.Poll.TotalVotes)
	}
}
