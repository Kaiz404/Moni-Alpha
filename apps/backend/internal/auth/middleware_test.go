package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v2/jwa"
	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

func testKeyAndJWKS(t *testing.T) (jwk.Key, *httptest.Server) {
	t.Helper()
	raw, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	priv, err := jwk.FromRaw(raw)
	if err != nil {
		t.Fatal(err)
	}
	priv.Set(jwk.KeyIDKey, "test-kid")
	priv.Set(jwk.AlgorithmKey, jwa.ES256)

	pub, err := priv.PublicKey()
	if err != nil {
		t.Fatal(err)
	}
	set := jwk.NewSet()
	set.AddKey(pub)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		buf, _ := json.Marshal(set)
		w.Write(buf)
	}))
	return priv, srv
}

func signToken(t *testing.T, priv jwk.Key, sub string, exp time.Time) string {
	t.Helper()
	tok, err := jwt.NewBuilder().
		Subject(sub).
		IssuedAt(time.Now()).
		Expiration(exp).
		Build()
	if err != nil {
		t.Fatal(err)
	}
	signed, err := jwt.Sign(tok, jwt.WithKey(jwa.ES256, priv))
	if err != nil {
		t.Fatal(err)
	}
	return string(signed)
}

func TestVerifyTokenValid(t *testing.T) {
	priv, srv := testKeyAndJWKS(t)
	defer srv.Close()

	v, err := NewVerifier(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}

	token := signToken(t, priv, "user-123", time.Now().Add(time.Hour))
	sub, err := v.VerifyToken(context.Background(), token)
	if err != nil {
		t.Fatalf("VerifyToken: %v", err)
	}
	if sub != "user-123" {
		t.Fatalf("expected sub user-123, got %s", sub)
	}
}

func TestVerifyTokenExpired(t *testing.T) {
	priv, srv := testKeyAndJWKS(t)
	defer srv.Close()

	v, err := NewVerifier(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}

	token := signToken(t, priv, "user-123", time.Now().Add(-time.Hour))
	if _, err := v.VerifyToken(context.Background(), token); err == nil {
		t.Fatal("expected expired token to fail verification")
	}
}

func TestVerifyTokenWrongKey(t *testing.T) {
	_, srv := testKeyAndJWKS(t)
	defer srv.Close()

	// Sign with a different key than the JWKS advertises.
	otherRaw, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	other, _ := jwk.FromRaw(otherRaw)
	other.Set(jwk.KeyIDKey, "test-kid")
	other.Set(jwk.AlgorithmKey, jwa.ES256)

	v, err := NewVerifier(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}

	token := signToken(t, other, "user-123", time.Now().Add(time.Hour))
	if _, err := v.VerifyToken(context.Background(), token); err == nil {
		t.Fatal("expected signature mismatch to fail verification")
	}
}
