// Moni AI backend: stateless Gin service that routes mobile AI requests
// (text, receipt images, notifications, chat analysis) to Groq. Auth is a
// Supabase user JWT verified against the project JWKS; no database access.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/kaiz404/moni/backend/internal/auth"
	"github.com/kaiz404/moni/backend/internal/config"
	"github.com/kaiz404/moni/backend/internal/chat"
	"github.com/kaiz404/moni/backend/internal/extract"
	"github.com/kaiz404/moni/backend/internal/groq"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	verifier, err := auth.NewVerifier(ctx, cfg.JWKSURL())
	if err != nil {
		log.Fatalf("auth: failed to initialize JWKS verifier: %v", err)
	}

	groqClient := groq.NewClient(cfg.GroqAPIKey, cfg.GroqBaseURL)
	extractHandler := extract.NewHandler(extract.NewService(groqClient))
	chatHandler := chat.NewHandler(chat.NewService(groqClient))

	// 20 AI requests/min per user (burst 8) is generous for one person and
	// keeps a single abusive client from draining the org-level Groq quota.
	limiter := auth.NewRateLimiter(20, 8)

	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger())

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/v1", verifier.Middleware(), limiter.Middleware())
	extractHandler.Register(v1)
	chatHandler.Register(v1)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("moni-ai-backend listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
