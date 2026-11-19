package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kaiz404/moni/backend/internal/auth"
	"github.com/kaiz404/moni/backend/internal/budget"
	"github.com/kaiz404/moni/backend/internal/chat"
	"github.com/kaiz404/moni/backend/internal/cors"
	"github.com/kaiz404/moni/backend/internal/extract"
	"github.com/kaiz404/moni/backend/internal/llm"
	"github.com/kaiz404/moni/backend/internal/places"
	"github.com/kaiz404/moni/backend/internal/tracing"
)

// maxBodyBytes fits a base64 receipt image inside the JSON envelope.
const maxBodyBytes = 6 << 20

const placesBodyBytes = 16 << 10

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

// traceNames are the Langfuse trace names. Evaluators and saved views target them, so keep them stable.
var traceNames = map[string]string{
	"/v1/extract/text":         "extract-text",
	"/v1/extract/image":        "extract-receipt",
	"/v1/extract/notification": "extract-notification",
	"/v1/chat/analyze":         "chat-analyze",
	"/v1/budget/suggest":       "budget-suggest",
}

// newRouter wires every route behind its middleware. main and the endpoint tests share it.
func newRouter(verifier *auth.Verifier, limiter, ipLimiter *auth.RateLimiter, llmClient *llm.Client, placesHandler *places.Handler, allowedOrigins []string) *gin.Engine {
	r := gin.New()
	r.SetTrustedProxies(nil)
	r.Use(gin.Recovery(), gin.Logger(), cors.Middleware(allowedOrigins))

	health := func(c *gin.Context) {
		authKeys := "loading"
		if verifier.KeysLoaded() {
			authKeys = "loaded"
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "authKeys": authKeys})
	}
	// Cloud Run's frontend answers /healthz itself with a 404 that never reaches the container.
	r.GET("/health", health)
	r.GET("/healthz", health)

	ipLimit := ipLimiter.MiddlewareBy(func(c *gin.Context) string { return auth.ClientIP(c.Request) }, "Too many requests — try again shortly")
	v1 := r.Group("/v1", ipLimit, verifier.Middleware(), auth.RequireAIConsent(), limiter.Middleware(), limitBody(maxBodyBytes),
		tracing.Middleware(traceNames, auth.UserID))
	extract.NewHandler(extract.NewService(llmClient)).Register(v1)
	chat.NewHandler(chat.NewService(llmClient)).Register(v1)
	budget.NewHandler(budget.NewService(llmClient)).Register(v1)
	// Search as you type sends a call every few keystrokes, which the AI limit would throttle.
	placesLimiter := auth.NewRateLimiter(60, 20)
	placesV1 := r.Group("/v1", ipLimit, verifier.Middleware(), placesLimiter.Middleware(), limitBody(placesBodyBytes))
	placesHandler.Register(placesV1)
	return r
}
