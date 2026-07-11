// Package auth verifies Supabase-issued user JWTs via the project JWKS
// (asymmetric ES256 signing keys) and enforces per-user rate limits.
package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

const userIDKey = "moni_user_id"

type Verifier struct {
	cache   *jwk.Cache
	jwksURL string
}

// NewVerifier sets up a cached JWKS fetcher against the Supabase project.
func NewVerifier(ctx context.Context, jwksURL string) (*Verifier, error) {
	cache := jwk.NewCache(ctx)
	if err := cache.Register(jwksURL, jwk.WithMinRefreshInterval(15*time.Minute)); err != nil {
		return nil, err
	}
	// Warm the cache so startup fails fast on a bad URL.
	if _, err := cache.Refresh(ctx, jwksURL); err != nil {
		return nil, err
	}
	return &Verifier{cache: cache, jwksURL: jwksURL}, nil
}

// VerifyToken parses and validates a Supabase access token, returning the
// user id (sub claim).
func (v *Verifier) VerifyToken(ctx context.Context, raw string) (string, error) {
	set, err := v.cache.Get(ctx, v.jwksURL)
	if err != nil {
		return "", err
	}
	tok, err := jwt.Parse([]byte(raw),
		jwt.WithKeySet(set),
		jwt.WithValidate(true),
		jwt.WithAcceptableSkew(30*time.Second),
	)
	if err != nil {
		return "", err
	}
	return tok.Subject(), nil
}

// Middleware authenticates requests with `Authorization: Bearer <jwt>`.
func (v *Verifier) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		token, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing bearer token"})
			return
		}
		userID, err := v.VerifyToken(c.Request.Context(), token)
		if err != nil || userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}
		c.Set(userIDKey, userID)
		c.Next()
	}
}

// UserID returns the authenticated user's id from the request context.
func UserID(c *gin.Context) string {
	return c.GetString(userIDKey)
}
