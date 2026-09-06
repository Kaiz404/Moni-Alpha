// Package authtest issues Supabase-style ES256 tokens against a local JWKS for tests.
package authtest

import (
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

// KeyAndJWKS returns a fresh ES256 private key and a server publishing its public JWKS.
// The server is closed when the test ends.
func KeyAndJWKS(t testing.TB) (jwk.Key, *httptest.Server) {
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
	buf, err := json.Marshal(set)
	if err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(buf)
	}))
	t.Cleanup(srv.Close)
	return priv, srv
}

// SignToken returns a signed access token for sub that expires at exp.
func SignToken(t testing.TB, priv jwk.Key, sub string, exp time.Time) string {
	t.Helper()
	tok, err := jwt.NewBuilder().Subject(sub).IssuedAt(time.Now()).Expiration(exp).Build()
	if err != nil {
		t.Fatal(err)
	}
	signed, err := jwt.Sign(tok, jwt.WithKey(jwa.ES256, priv))
	if err != nil {
		t.Fatal(err)
	}
	return string(signed)
}
