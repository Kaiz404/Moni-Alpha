package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"testing"
	"time"

	"github.com/kaiz404/moni/backend/internal/auth"
	"github.com/kaiz404/moni/backend/internal/auth/authtest"
	"github.com/kaiz404/moni/backend/internal/config"
	"github.com/kaiz404/moni/backend/internal/llm"
	"github.com/kaiz404/moni/backend/internal/tracing"
)

// TestEvalServer serves the real router for the eval runner in evals/ until it is interrupted. A
// local signing key stands in for Supabase, so it lives in a test file and never ships in the server
// binary. It writes a user token to MONI_EVAL_TOKEN_FILE, has no rate limit, and joins each request to
// the runner's trace. Opt in: `pnpm --filter backend eval:serve`.
func TestEvalServer(t *testing.T) {
	if os.Getenv("MONI_EVAL_SERVE") != "1" {
		t.Skip("set MONI_EVAL_SERVE=1 to serve the backend for evals")
	}
	key := os.Getenv("OPENROUTER_API_KEY")
	tokenFile := os.Getenv("MONI_EVAL_TOKEN_FILE")
	if key == "" || tokenFile == "" {
		t.Fatal("MONI_EVAL_SERVE=1 needs OPENROUTER_API_KEY and MONI_EVAL_TOKEN_FILE")
	}

	tracingCfg, err := config.TracingFromEnv()
	if err != nil {
		t.Fatal(err)
	}
	tracingCfg.AcceptTraceparent = true
	flush, err := tracing.Setup(context.Background(), tracingCfg)
	if err != nil {
		t.Fatal(err)
	}

	priv, jwks := authtest.KeyAndJWKS(t)
	verifier, err := auth.NewVerifier(context.Background(), jwks.URL)
	if err != nil {
		t.Fatal(err)
	}
	unlimited := auth.NewRateLimiter(1_000_000, 1_000_000)
	srv := &http.Server{
		Addr:    "127.0.0.1:" + envOr("MONI_EVAL_PORT", "8787"),
		Handler: newRouter(verifier, unlimited, unlimited, llm.NewClient(key, liveBaseURL()), noPlaces(), nil),
	}
	token := authtest.SignToken(t, priv, "eval-runner", time.Now().Add(12*time.Hour))
	if err := os.WriteFile(tokenFile, []byte(token), 0o600); err != nil {
		t.Fatal(err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(shutdown)
		flush(shutdown)
	}()
	t.Logf("eval server on http://%s", srv.Addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		t.Fatal(err)
	}
	<-ctx.Done()
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
