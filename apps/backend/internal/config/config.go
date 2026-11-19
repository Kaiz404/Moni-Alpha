// Package config loads backend configuration from environment variables.
package config

import (
	"fmt"
	"net/url"
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
	// PlacesUserDailyCap limits each user's calls per Pacific day, per endpoint, within PlacesDailyCap.
	PlacesUserDailyCap int
	// CORSAllowedOrigins are the browser origins (the web app) that may call the gateway.
	CORSAllowedOrigins []string
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
	var err error
	if cfg.PlacesDailyCap, err = nonNegativeInt("PLACES_DAILY_CAP", 1000); err != nil {
		return cfg, err
	}
	if cfg.PlacesUserDailyCap, err = nonNegativeInt("PLACES_USER_DAILY_CAP", 100); err != nil {
		return cfg, err
	}
	if cfg.CORSAllowedOrigins, err = origins("CORS_ALLOWED_ORIGINS"); err != nil {
		return cfg, err
	}
	if cfg.SupabaseURL == "" {
		return cfg, fmt.Errorf("SUPABASE_URL is required")
	}
	if cfg.OpenRouterAPIKey == "" {
		return cfg, fmt.Errorf("OPENROUTER_API_KEY is required")
	}
	return cfg, nil
}

func nonNegativeInt(key string, fallback int) (int, error) {
	n, err := strconv.Atoi(getenv(key, strconv.Itoa(fallback)))
	if err != nil || n < 0 {
		return 0, fmt.Errorf("%s must be a non-negative integer", key)
	}
	return n, nil
}

// origins reads a comma-separated list of exact origins, such as https://app.example.com or
// http://localhost:3000. A path, a wildcard or a missing scheme is a configuration error.
func origins(key string) ([]string, error) {
	var out []string
	for _, raw := range strings.Split(os.Getenv(key), ",") {
		origin := strings.TrimSpace(raw)
		if origin == "" {
			continue
		}
		u, err := url.Parse(origin)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.Path != "" || u.RawQuery != "" || strings.Contains(origin, "*") {
			return nil, fmt.Errorf("%s: %q is not an origin like https://app.example.com", key, origin)
		}
		out = append(out, origin)
	}
	return out, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
