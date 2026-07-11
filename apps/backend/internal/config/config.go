// Package config loads backend configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	// Port the HTTP server listens on. Cloud Run injects PORT.
	Port string
	// SupabaseURL is the project base URL, e.g. https://xyz.supabase.co
	SupabaseURL string
	// GroqAPIKey authenticates against the Groq API.
	GroqAPIKey string
	// GroqBaseURL allows overriding the Groq endpoint (tests).
	GroqBaseURL string
}

func (c Config) JWKSURL() string {
	return strings.TrimRight(c.SupabaseURL, "/") + "/auth/v1/.well-known/jwks.json"
}

func Load() (Config, error) {
	cfg := Config{
		Port:        getenv("PORT", "8080"),
		SupabaseURL: os.Getenv("SUPABASE_URL"),
		GroqAPIKey:  os.Getenv("GROQ_API_KEY"),
		GroqBaseURL: getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
	}
	if cfg.SupabaseURL == "" {
		return cfg, fmt.Errorf("SUPABASE_URL is required")
	}
	if cfg.GroqAPIKey == "" {
		return cfg, fmt.Errorf("GROQ_API_KEY is required")
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
