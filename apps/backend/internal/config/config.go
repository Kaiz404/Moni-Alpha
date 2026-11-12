// Package config loads backend configuration from environment variables.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Port the HTTP server listens on. Cloud Run injects PORT.
	Port string
	// SupabaseURL is the project base URL, e.g. https://xyz.supabase.co
	SupabaseURL string
	// OpenRouterAPIKey authenticates against OpenRouter.
	OpenRouterAPIKey string
	// OpenRouterBaseURL allows overriding the OpenRouter endpoint.
	OpenRouterBaseURL string
	// GooglePlacesAPIKey is optional. Without it every Places call answers unavailable.
	GooglePlacesAPIKey string
	// PlacesDailyCap limits Autocomplete and Details calls per Pacific day, each counted separately.
	PlacesDailyCap int
}

func (c Config) JWKSURL() string {
	return strings.TrimRight(c.SupabaseURL, "/") + "/auth/v1/.well-known/jwks.json"
}

func Load() (Config, error) {
	cfg := Config{
		Port:               getenv("PORT", "8080"),
		SupabaseURL:        os.Getenv("SUPABASE_URL"),
		OpenRouterAPIKey:   os.Getenv("OPENROUTER_API_KEY"),
		OpenRouterBaseURL:  getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
		GooglePlacesAPIKey: os.Getenv("GOOGLE_PLACES_API_KEY"),
	}
	placesCap, err := strconv.Atoi(getenv("PLACES_DAILY_CAP", "1000"))
	if err != nil || placesCap < 0 {
		return cfg, fmt.Errorf("PLACES_DAILY_CAP must be a non-negative integer")
	}
	cfg.PlacesDailyCap = placesCap
	if cfg.SupabaseURL == "" {
		return cfg, fmt.Errorf("SUPABASE_URL is required")
	}
	if cfg.OpenRouterAPIKey == "" {
		return cfg, fmt.Errorf("OPENROUTER_API_KEY is required")
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
