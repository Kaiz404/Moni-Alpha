package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kaiz404/moni/backend/internal/auth"
	"github.com/kaiz404/moni/backend/internal/chat"
	"github.com/kaiz404/moni/backend/internal/extract"
	"github.com/kaiz404/moni/backend/internal/llm"
)

// maxBodyBytes fits a base64 receipt image inside the JSON envelope.
const maxBodyBytes = 6 << 20

// limitBody rejects a declared oversize body before reading it and caps undeclared (chunked) bodies while streaming.
func limitBody(max int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > max {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Request body too large"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, max)
		c.Next()
	}
}

// newRouter wires every route behind its middleware. main and the endpoint tests share it.
func newRouter(verifier *auth.Verifier, limiter, ipLimiter *auth.RateLimiter, llmClient *llm.Client) *gin.Engine {
	r := gin.New()
	r.SetTrustedProxies(nil)
	r.Use(gin.Recovery(), gin.Logger())

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	ipLimit := ipLimiter.MiddlewareBy(func(c *gin.Context) string { return auth.ClientIP(c.Request) }, "Too many requests — try again shortly")
	v1 := r.Group("/v1", ipLimit, verifier.Middleware(), limiter.Middleware(), limitBody(maxBodyBytes))
	extract.NewHandler(extract.NewService(llmClient)).Register(v1)
	chat.NewHandler(chat.NewService(llmClient)).Register(v1)
	return r
}
