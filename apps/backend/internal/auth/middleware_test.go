package auth

import (
	"context"
	"testing"
	"time"

	"github.com/kaiz404/moni/backend/internal/auth/authtest"
)

func TestVerifyTokenValid(t *testing.T) {
	priv, srv := authtest.KeyAndJWKS(t)

	v, err := NewVerifier(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}

	token := authtest.SignToken(t, priv, "user-123", time.Now().Add(time.Hour))
	id, err := v.VerifyToken(context.Background(), token)
	if err != nil {
		t.Fatalf("VerifyToken: %v", err)
	}
	if id != (Identity{UserID: "user-123", AIConsent: AIConsentUnstated}) {
		t.Fatalf("got %+v, want user-123 with no AI claim", id)
	}
}

func TestVerifyTokenExpired(t *testing.T) {
	priv, srv := authtest.KeyAndJWKS(t)

	v, err := NewVerifier(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}

	token := authtest.SignToken(t, priv, "user-123", time.Now().Add(-time.Hour))
	if _, err := v.VerifyToken(context.Background(), token); err == nil {
		t.Fatal("expected expired token to fail verification")
	}
}

func TestVerifyTokenWrongKey(t *testing.T) {
	_, srv := authtest.KeyAndJWKS(t)
	// Same kid, different key: the signature must not verify against the advertised JWKS.
	other, _ := authtest.KeyAndJWKS(t)

	v, err := NewVerifier(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("NewVerifier: %v", err)
	}

	token := authtest.SignToken(t, other, "user-123", time.Now().Add(time.Hour))
	if _, err := v.VerifyToken(context.Background(), token); err == nil {
		t.Fatal("expected signature mismatch to fail verification")
	}
}
