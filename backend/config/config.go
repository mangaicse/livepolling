package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	MongoURI     string
	MongoDBName  string
	RedisURI     string
	RedisPass    string
	JWTSecret    string
	ClientOrigin string
}

func LoadConfig() *Config {
	// Attempt to load .env if present
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	mongoDBName := os.Getenv("MONGO_DB_NAME")
	if mongoDBName == "" {
		mongoDBName = "livepoll"
	}

	redisURI := os.Getenv("REDIS_URI")
	if redisURI == "" {
		redisURI = "localhost:6379"
	}

	redisPass := os.Getenv("REDIS_PASSWORD")

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "livepoll_super_secure_jwt_secret_token_2026_x789!"
	}

	clientOrigin := os.Getenv("CLIENT_ORIGIN")
	if clientOrigin == "" {
		clientOrigin = "*"
	}

	return &Config{
		Port:         port,
		MongoURI:     mongoURI,
		MongoDBName:  mongoDBName,
		RedisURI:     redisURI,
		RedisPass:    redisPass,
		JWTSecret:    jwtSecret,
		ClientOrigin: clientOrigin,
	}
}
