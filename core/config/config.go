package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL         string
	GoogleClientID      string
	GoogleClientSecret  string
	JWTSecret           string
	OAuthCallbackPort   int
}

var App *Config

func Load() {
	// Load .env from working directory (best effort)
	_ = godotenv.Load()

	port, _ := strconv.Atoi(getEnv("OAUTH_CALLBACK_PORT", "7788"))

	App = &Config{
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		JWTSecret:          getEnv("JWT_SECRET", "tenet-change-this-secret-in-production"),
		OAuthCallbackPort:  port,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
