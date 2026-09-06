package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kaiz404/moni/backend/internal/auth"
	"github.com/kaiz404/moni/backend/internal/auth/authtest"
	"github.com/kaiz404/moni/backend/internal/groq"
)

// Live tests call the real Groq API through the full router (local JWKS stands in for Supabase).
// Opt in with MONI_LIVE_TESTS=1 and GROQ_API_KEY set: `pnpm --filter backend test:live`.
// Inputs are unambiguous so assertions stay loose enough to survive model variance.

func groqBaseURL() string {
	if u := os.Getenv("GROQ_BASE_URL"); u != "" {
		return u
	}
	return "https://api.groq.com/openai/v1"
}

func requireLive(t *testing.T) string {
	t.Helper()
	if os.Getenv("MONI_LIVE_TESTS") != "1" {
		t.Skip("set MONI_LIVE_TESTS=1 to call the real Groq API")
	}
	key := os.Getenv("GROQ_API_KEY")
	if key == "" {
		t.Fatal("MONI_LIVE_TESTS=1 but GROQ_API_KEY is empty")
	}
	return key
}

func newLiveServer(t *testing.T) *testServer {
	key := requireLive(t)
	gin.SetMode(gin.TestMode)
	gin.DefaultWriter = io.Discard
	priv, jwks := authtest.KeyAndJWKS(t)
	verifier, err := auth.NewVerifier(context.Background(), jwks.URL)
	if err != nil {
		t.Fatal(err)
	}
	return &testServer{
		handler: newRouter(verifier, auth.NewRateLimiter(600, 100), groq.NewClient(key, groqBaseURL())),
		token: func(sub string) string {
			return authtest.SignToken(t, priv, sub, time.Now().Add(time.Hour))
		},
	}
}

func liveExtraction(t *testing.T, res map[string]any, amount float64, txType string) map[string]any {
	t.Helper()
	if res["status"] != "ok" {
		t.Fatalf("status %v, reason %v", res["status"], res["reason"])
	}
	ex := extraction(t, res)
	if got, _ := ex["amount"].(float64); math.Abs(got-amount) > 0.001 || ex["type"] != txType {
		t.Fatalf("amount %v type %v, want %v %s (reasoning: %v)", ex["amount"], ex["type"], amount, txType, ex["reasoning"])
	}
	return ex
}

// Catches a revoked key or a model id Groq no longer serves before any extraction runs.
func TestLiveGroqKeyServesConfiguredModels(t *testing.T) {
	key := requireLive(t)
	req, _ := http.NewRequest(http.MethodGet, groqBaseURL()+"/models", nil)
	req.Header.Set("Authorization", "Bearer "+key)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var body struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	json.NewDecoder(res.Body).Decode(&body)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET /models: %d %+v", res.StatusCode, body.Error)
	}
	served := map[string]bool{}
	for _, m := range body.Data {
		served[m.ID] = true
	}
	for _, model := range []string{groq.ModelTextFast, groq.ModelTextQuality, groq.ModelVision} {
		if !served[model] {
			t.Errorf("model %q is not served for this key", model)
		}
	}
}

func TestLiveExtractText(t *testing.T) {
	s := newLiveServer(t)
	_, res := s.post(t, "/v1/extract/text", map[string]any{
		"text": "Lunch at FamilyMart KLCC, RM12.50, paid with my Maybank card", "wallets": wallets,
	})
	ex := liveExtraction(t, res, 12.5, "expense")
	if ex["walletId"] != "w-maybank" || ex["currency"] != "MYR" {
		t.Fatalf("walletId %v currency %v, want w-maybank MYR", ex["walletId"], ex["currency"])
	}
}

func TestLiveExtractNotification(t *testing.T) {
	s := newLiveServer(t)
	cases := []struct {
		name, pkg, title, text string
		want                   string // "expense" | "income" | "skipped"
		amount                 float64
	}{
		{"card purchase", "com.maybank2u.life", "Maybank2u: Card Purchase",
			"You have made a purchase of RM 23.90 at FAMILYMART KLCC with your card ending 4821.", "expense", 23.9},
		{"money received", "my.com.tngdigital.ewallet", "You've received money!",
			"ALI BIN ABU has transferred RM 15.00 to you. Tap here to check the transaction details.", "income", 15},
		{"one-time password", "com.maybank2u.life", "Maybank2u",
			"Your TAC is 482913 for a transfer of RM 300.00. Do not share this code with anyone.", "skipped", 0},
		{"promotion", "my.com.tngdigital.ewallet", "Weekend deal",
			"Enjoy 20% cashback up to RM 10 on Shopee this weekend! T&C apply.", "skipped", 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, res := s.post(t, "/v1/extract/notification", map[string]any{
				"notification": map[string]any{"packageName": c.pkg, "title": c.title, "text": c.text},
				"wallets":      wallets,
			})
			if c.want == "skipped" {
				if res["status"] != "skipped" {
					t.Fatalf("got %v, want skipped", res)
				}
				return
			}
			if ex := liveExtraction(t, res, c.amount, c.want); ex["currency"] != "MYR" {
				t.Fatalf("currency %v, want MYR", ex["currency"])
			}
		})
	}
}

func TestLiveExtractImage(t *testing.T) {
	s := newLiveServer(t)
	png, err := os.ReadFile("testdata/receipt.png")
	if err != nil {
		t.Fatal(err)
	}
	_, res := s.post(t, "/v1/extract/image", map[string]any{
		"imageBase64": "data:image/png;base64," + base64.StdEncoding.EncodeToString(png), "wallets": wallets,
	})
	ex := liveExtraction(t, res, 12.5, "expense")
	if merchant, _ := ex["merchant"].(string); !strings.Contains(strings.ToLower(merchant), "familymart") {
		t.Fatalf("merchant %q, want FamilyMart", merchant)
	}
}

func TestLiveChatAnalyze(t *testing.T) {
	s := newLiveServer(t)
	_, res := s.post(t, "/v1/chat/analyze", map[string]any{
		"message": "What did I spend the most on in the last 30 days?",
		"snapshot": map[string]any{"currency": "MYR", "rolling30": map[string]any{
			"totalSpend": 1240.5,
			"topCategories": []map[string]any{
				{"name": "Food", "amount": 620}, {"name": "Transport", "amount": 310}, {"name": "Groceries", "amount": 180},
			},
		}},
	})
	reply, _ := res["reply"].(string)
	if res["status"] != "ok" || !strings.Contains(strings.ToLower(reply), "food") {
		t.Fatalf("status %v reply %q reason %v", res["status"], reply, res["reason"])
	}
}
