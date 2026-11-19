// Package cors lets the web app's origins call the gateway from a browser. The phone sends no
// Origin header and never meets this code.
package cors

import (
	"net/http"
	"slices"

	"github.com/gin-gonic/gin"
)

// Middleware answers preflights and marks responses readable for the allowed origins only. It
// sits in front of auth, because a preflight carries no Authorization header.
func Middleware(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			c.Next()
			return
		}
		c.Header("Vary", "Origin")
		allowed := slices.Contains(allowedOrigins, origin)
		preflight := c.Request.Method == http.MethodOptions && c.GetHeader("Access-Control-Request-Method") != ""
		if !allowed {
			if preflight {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.Next()
			return
		}
		c.Header("Access-Control-Allow-Origin", origin)
		// The 503 before auth keys load says when to try again.
		c.Header("Access-Control-Expose-Headers", "Retry-After")
		if preflight {
			c.Header("Access-Control-Allow-Methods", "GET, POST")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Header("Access-Control-Max-Age", "600")
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
