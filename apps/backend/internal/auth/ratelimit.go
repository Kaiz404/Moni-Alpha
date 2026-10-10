package auth

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// RateLimiter keeps an in-memory token bucket per key (user id or client IP). Good enough for a
// single Cloud Run instance at ~1000 users; revisit if scaled out.
type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*userBucket
	rps      rate.Limit
	burst    int
	lastSeen time.Duration
}

type userBucket struct {
	limiter *rate.Limiter
	seen    time.Time
}

// NewRateLimiter allows `perMinute` requests per key with the given burst.
func NewRateLimiter(perMinute int, burst int) *RateLimiter {
	rl := &RateLimiter{
		buckets:  make(map[string]*userBucket),
		rps:      rate.Limit(float64(perMinute) / 60.0),
		burst:    burst,
		lastSeen: 10 * time.Minute,
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *RateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	b, ok := rl.buckets[key]
	if !ok {
		b = &userBucket{limiter: rate.NewLimiter(rl.rps, rl.burst)}
		rl.buckets[key] = b
	}
	b.seen = time.Now()
	return b.limiter.Allow()
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		for id, b := range rl.buckets {
			if time.Since(b.seen) > rl.lastSeen {
				delete(rl.buckets, id)
			}
		}
		rl.mu.Unlock()
	}
}

// Middleware rejects requests over the per-user budget with 429.
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return rl.MiddlewareBy(func(c *gin.Context) string {
		if userID := UserID(c); userID != "" {
			return userID
		}
		return c.ClientIP()
	}, "Too many AI requests — try again shortly")
}

// MiddlewareBy rejects requests over the budget of key(c) with 429 and message.
func (rl *RateLimiter) MiddlewareBy(key func(*gin.Context) string, message string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !rl.allow(key(c)) {
			c.Header("Retry-After", "10")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": message})
			return
		}
		c.Next()
	}
}
