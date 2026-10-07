package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kaiz404/moni/backend/internal/auth"
	"github.com/kaiz404/moni/backend/internal/chat"
	"github.com/kaiz404/moni/backend/internal/extract"
	"github.com/kaiz404/moni/backend/internal/llm"
)

// newRouter wires every route behind its middleware. main and the endpoint tests share it.
func newRouter(verifier *auth.Verifier, limiter *auth.RateLimiter, llmClient *llm.Client) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger())

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/v1", verifier.Middleware(), limiter.Middleware())
	extract.NewHandler(extract.NewService(llmClient)).Register(v1)
	chat.NewHandler(chat.NewService(llmClient)).Register(v1)
	return r
}
