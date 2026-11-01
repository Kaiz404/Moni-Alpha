// Package auth verifies Supabase-issued user JWTs via the project JWKS
// (asymmetric ES256 signing keys) and enforces per-user rate limits.
package auth

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

const (
	userIDKey = "moni_user_id"

	// The first fetch holds startup back so a healthy cold start serves its first request with
	// keys, as it always has. It is bounded so a black-holed host cannot keep the port closed.
	firstFetchTimeout = 5 * time.Second
	fetchTimeout      = 10 * time.Second
	fetchRetryMin     = time.Second
	fetchRetryMax     = time.Minute

	retryAfterSeconds = 30
)

// ErrKeysNotLoaded means the JWKS has never been fetched, so no token can be verified yet.
var ErrKeysNotLoaded = errors.New("auth keys not loaded")

type Verifier struct {
	cache   *jwk.Cache
	jwksURL string
	loaded  atomic.Bool
}

// NewVerifier sets up a cached JWKS fetcher against the Supabase project. An unreachable JWKS does
// not fail it: fetching continues in the background until ctx ends, and VerifyToken answers
// ErrKeysNotLoaded until a fetch succeeds. Only a URL the cache rejects returns an error.
func NewVerifier(ctx context.Context, jwksURL string) (*Verifier, error) {
	cache := jwk.NewCache(ctx)
	if err := cache.Register(jwksURL, jwk.WithMinRefreshInterval(15*time.Minute)); err != nil {
		return nil, err
	}
	v := &Verifier{cache: cache, jwksURL: jwksURL}
	if err := v.fetchKeys(ctx, firstFetchTimeout); err != nil {
		log.Printf("auth: JWKS not loaded, retrying in the background: %v", err)
		go v.keepFetching(ctx)
	}
	return v, nil
}

// fetchKeys sets loaded only for a set holding at least one key. Past that, the cache refreshes on
// its own and keeps serving the last good set when a refresh fails.
func (v *Verifier) fetchKeys(ctx context.Context, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	set, err := v.cache.Refresh(ctx, v.jwksURL)
	if err != nil {
		return err
	}
	if set.Len() == 0 {
		return fmt.Errorf("JWKS at %s holds no keys", v.jwksURL)
	}
	v.loaded.Store(true)
	return nil
}

func (v *Verifier) keepFetching(ctx context.Context) {
	wait := fetchRetryMin
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
		}
		err := v.fetchKeys(ctx, fetchTimeout)
		if err == nil {
			log.Printf("auth: JWKS loaded")
			return
		}
		wait = min(wait*2, fetchRetryMax)
		log.Printf("auth: JWKS not loaded, next try in %s: %v", wait, err)
	}
}

// KeysLoaded reports whether tokens can be verified yet.
func (v *Verifier) KeysLoaded() bool {
	return v.loaded.Load()
}

// VerifyToken parses and validates a Supabase access token, returning the
// user id (sub claim). It returns ErrKeysNotLoaded before the JWKS has loaded.
func (v *Verifier) VerifyToken(ctx context.Context, raw string) (string, error) {
	if !v.loaded.Load() {
		return "", ErrKeysNotLoaded
	}
	set, err := v.cache.Get(ctx, v.jwksURL)
	if err != nil {
		return "", errors.Join(ErrKeysNotLoaded, err)
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

// Middleware authenticates requests with `Authorization: Bearer <jwt>`. Without keys it answers
// 503 with a retry hint, because the token may be fine and the client should try again.
func (v *Verifier) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		token, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing bearer token"})
			return
		}
		userID, err := v.VerifyToken(c.Request.Context(), token)
		if errors.Is(err, ErrKeysNotLoaded) {
			c.Header("Retry-After", strconv.Itoa(retryAfterSeconds))
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error":   "Auth keys are not loaded yet",
				"details": gin.H{"retryAfterSeconds": retryAfterSeconds},
			})
			return
		}
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
