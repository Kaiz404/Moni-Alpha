package auth

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kaiz404/moni/backend/internal/auth/authtest"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

// flakyJWKS serves jwks once up is set and fails with a 503 until then, like a paused project.
func flakyJWKS(t *testing.T, jwks *httptest.Server) (*httptest.Server, *atomic.Bool) {
	t.Helper()
	var up atomic.Bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !up.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		res, err := http.Get(jwks.URL)
		if err != nil {
			t.Errorf("reading jwks: %v", err)
			return
		}
		defer res.Body.Close()
		w.Header().Set("Content-Type", "application/json")
		io.Copy(w, res.Body)
	}))
	t.Cleanup(srv.Close)
	return srv, &up
}

// authed returns what a request gets through the middleware and whether the handler behind it ran.
func authed(v *Verifier, token string) (*httptest.ResponseRecorder, bool) {
	gin.SetMode(gin.TestMode)
	reached := false
	r := gin.New()
	r.GET("/", v.Middleware(), func(c *gin.Context) {
		reached = true
		c.JSON(http.StatusOK, gin.H{"user": UserID(c)})
	})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec, reached
}

// unsignedToken has a well-formed payload and alg "none".
func unsignedToken(t *testing.T, sub string) string {
	t.Helper()
	tok, err := jwt.NewBuilder().Subject(sub).Expiration(time.Now().Add(time.Hour)).Build()
	if err != nil {
		t.Fatal(err)
	}
	payload, err := jwt.NewSerializer().Serialize(tok)
	if err != nil {
		t.Fatal(err)
	}
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"none"}`))
	return header + "." + base64.RawURLEncoding.EncodeToString(payload) + "."
}

func requireKeysNotLoadedAnswer(t *testing.T, rec *httptest.ResponseRecorder, reached bool) {
	t.Helper()
	if reached {
		t.Fatal("the handler ran for a request nobody could verify")
	}
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d, want 503: %s", rec.Code, rec.Body)
	}
	if got := rec.Header().Get("Retry-After"); got != "30" {
		t.Fatalf("Retry-After = %q, want 30", got)
	}
	want := `{"details":{"retryAfterSeconds":30},"error":"Auth keys are not loaded yet"}`
	if got := rec.Body.String(); got != want {
		t.Fatalf("body = %s, want %s", got, want)
	}
}

func TestUnreachableJWKSDoesNotFailStartup(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	dead := httptest.NewServer(http.NotFoundHandler())
	url := dead.URL
	dead.Close()

	start := time.Now()
	v, err := NewVerifier(ctx, url)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}
	if v.KeysLoaded() {
		t.Fatal("keys reported loaded with nothing to load them from")
	}
	if elapsed := time.Since(start); elapsed > firstFetchTimeout+time.Second {
		t.Fatalf("startup waited %s", elapsed)
	}
}

func TestNoTokenPassesBeforeKeysLoad(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	priv, jwks := authtest.KeyAndJWKS(t)
	srv, _ := flakyJWKS(t, jwks)

	v, err := NewVerifier(ctx, srv.URL)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}
	for name, token := range map[string]string{
		"validly signed": authtest.SignToken(t, priv, "user-123", time.Now().Add(time.Hour)),
		"expired":        authtest.SignToken(t, priv, "user-123", time.Now().Add(-time.Hour)),
		"unsigned":       unsignedToken(t, "user-123"),
		"garbage":        "not-a-jwt",
	} {
		t.Run(name, func(t *testing.T) {
			rec, reached := authed(v, token)
			requireKeysNotLoadedAnswer(t, rec, reached)
			if _, err := v.VerifyToken(context.Background(), token); !errors.Is(err, ErrKeysNotLoaded) {
				t.Fatalf("VerifyToken error = %v, want ErrKeysNotLoaded", err)
			}
		})
	}
	if rec, reached := authed(v, ""); reached || rec.Code != http.StatusUnauthorized {
		t.Fatalf("no token: got %d, reached %v, want 401 and not reached", rec.Code, reached)
	}
}

func TestEmptyJWKSDoesNotCountAsLoaded(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"keys":[]}`)
	}))
	defer srv.Close()
	priv, _ := authtest.KeyAndJWKS(t)

	v, err := NewVerifier(ctx, srv.URL)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}
	rec, reached := authed(v, authtest.SignToken(t, priv, "user-123", time.Now().Add(time.Hour)))
	requireKeysNotLoadedAnswer(t, rec, reached)
}

func TestVerifiesNormallyOnceKeysLoad(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	priv, jwks := authtest.KeyAndJWKS(t)
	other, _ := authtest.KeyAndJWKS(t)
	srv, up := flakyJWKS(t, jwks)

	v, err := NewVerifier(ctx, srv.URL)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}
	good := authtest.SignToken(t, priv, "user-123", time.Now().Add(time.Hour))
	rec, reached := authed(v, good)
	requireKeysNotLoadedAnswer(t, rec, reached)

	up.Store(true)
	deadline := time.Now().Add(10 * time.Second)
	for !v.KeysLoaded() {
		if time.Now().After(deadline) {
			t.Fatal("keys never loaded after the JWKS came back")
		}
		time.Sleep(20 * time.Millisecond)
	}

	rec, reached = authed(v, good)
	if !reached || rec.Code != http.StatusOK || rec.Body.String() != `{"user":"user-123"}` {
		t.Fatalf("valid token: got %d %s, reached %v", rec.Code, rec.Body, reached)
	}
	for name, token := range map[string]string{
		"wrong key": authtest.SignToken(t, other, "user-123", time.Now().Add(time.Hour)),
		"expired":   authtest.SignToken(t, priv, "user-123", time.Now().Add(-time.Hour)),
		"unsigned":  unsignedToken(t, "user-123"),
		"garbage":   "not-a-jwt",
	} {
		rec, reached := authed(v, token)
		if reached || rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s: got %d, reached %v, want 401 and not reached", name, rec.Code, reached)
		}
	}
}

func TestKeptKeysSurviveTheJWKSGoingAway(t *testing.T) {
	priv, jwks := authtest.KeyAndJWKS(t)
	v, err := NewVerifier(context.Background(), jwks.URL)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}
	jwks.Close()

	token := authtest.SignToken(t, priv, "user-123", time.Now().Add(time.Hour))
	if rec, reached := authed(v, token); !reached || rec.Code != http.StatusOK {
		t.Fatalf("got %d, reached %v, want 200 from the cached keys", rec.Code, reached)
	}
}
