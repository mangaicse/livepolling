package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"livepoll/backend/config"
	"livepoll/backend/controllers"
	"livepoll/backend/middleware"
	"livepoll/backend/repository"
	"livepoll/backend/websocket"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()

	log.Printf("🚀 Starting LivePoll Service on port %s...", cfg.Port)

	// Initialize Repositories
	mongoRepo := repository.NewMongoRepository(cfg.MongoURI, cfg.MongoDBName)
	redisRepo := repository.NewRedisRepository(cfg.RedisURI, cfg.RedisPass)

	// Initialize WebSocket Hub
	hub := websocket.NewHub(redisRepo)
	go hub.Run()

	// Initialize Controllers
	authCtrl := controllers.NewAuthController(mongoRepo, cfg.JWTSecret)
	pollCtrl := controllers.NewPollController(mongoRepo, redisRepo, hub)
	voteCtrl := controllers.NewVoteController(mongoRepo, redisRepo)

	// Gin Engine Setup
	r := gin.Default()

	// Middleware
	r.Use(middleware.CORSMiddleware(cfg.ClientOrigin))

	// Health check endpoint
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now(),
			"services": gin.H{
				"mongo_connected": mongoRepo.IsConnected(),
				"redis_connected": redisRepo.IsConnected(),
			},
		})
	})

	// Public Auth Routes
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/register", authCtrl.Register)
		authGroup.POST("/login", authCtrl.Login)
	}

	// Protected Auth Routes
	protectedAuthGroup := r.Group("/api/auth")
	protectedAuthGroup.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		protectedAuthGroup.GET("/me", authCtrl.Me)
	}

	// Public Poll & Voting Routes
	r.GET("/api/polls/:id", pollCtrl.GetPoll)
	r.POST("/api/polls/:id/vote", voteCtrl.CastVote)

	// Protected Poll Creator Routes
	pollGroup := r.Group("/api/polls")
	pollGroup.Use(middleware.AuthMiddleware(cfg.JWTSecret))
	{
		pollGroup.POST("", pollCtrl.CreatePoll)
		pollGroup.GET("/my", pollCtrl.GetMyPolls)
		pollGroup.PATCH("/:id/toggle", pollCtrl.TogglePollStatus)
		pollGroup.POST("/:id/reset", pollCtrl.ResetPoll)
		pollGroup.DELETE("/:id", pollCtrl.DeletePoll)
	}

	// Real-Time WebSocket Route
	r.GET("/ws/polls/:id", func(c *gin.Context) {
		pollID := c.Param("id")
		websocket.ServeWs(hub, c, pollID)
	})

	// Optional: Serve frontend static build if frontend/dist exists
	distPath := filepath.Join("..", "frontend", "dist")
	if _, err := os.Stat(distPath); err == nil {
		log.Printf("📦 Serving static frontend from %s", distPath)
		r.Static("/assets", filepath.Join(distPath, "assets"))
		r.NoRoute(func(c *gin.Context) {
			c.File(filepath.Join(distPath, "index.html"))
		})
	}

	// Start HTTP Server with Graceful Shutdown
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: r,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to listen: %v", err)
		}
	}()

	log.Printf("✨ LivePoll Backend is live at http://localhost:%s", cfg.Port)

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited cleanly.")
}
