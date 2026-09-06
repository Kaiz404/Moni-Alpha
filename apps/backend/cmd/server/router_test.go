package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kaiz404/moni/backend/internal/auth"
	"github.com/kaiz404/moni/backend/internal/auth/authtest"
	"github.com/kaiz404/moni/backend/internal/groq"
)

// groqReply is one scripted response from the fake Groq server.
type groqReply struct {
	status  int
	content string
}

func ok(content string) groqReply { return groqReply{http.StatusOK, content} }

// fakeGroq plays scripted replies in order and records every request it receives.
type fakeGroq struct {
	mu       sync.Mutex
	replies  []groqReply
	requests []map[string]any
	headers  []http.Header
}

func (f *fakeGroq) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	json.NewDecoder(r.Body).Decode(&body)

	f.mu.Lock()
	f.requests = append(f.requests, body)
	f.headers = append(f.headers, r.Header.Clone())
	reply := groqReply{http.StatusInternalServerError, ""}
	if len(f.replies) > 0 {
		reply, f.replies = f.replies[0], f.replies[1:]
	}
	f.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(reply.status)
	if reply.status != http.StatusOK {
		json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"message": reply.content}})
		return
	}
	json.NewEncoder(w).Encode(map[string]any{
		"choices": []any{map[string]any{"message": map[string]string{"content": reply.content}}},
	})
}

func (f *fakeGroq) models() []string {
	out := make([]string, len(f.requests))
	for i, req := range f.requests {
		out[i], _ = req["model"].(string)
	}
	return out
}

// promptText joins every text the backend sent to the model, for asserting what it saw.
func (f *fakeGroq) promptText(i int) string {
	raw, _ := json.Marshal(f.requests[i]["messages"])
	return string(raw)
}

type testServer struct {
	handler http.Handler
	groq    *fakeGroq
	token   func(sub string) string
}

func newTestServer(t *testing.T, limiter *auth.RateLimiter, replies ...groqReply) *testServer {
	t.Helper()
	gin.SetMode(gin.TestMode)
	gin.DefaultWriter = io.Discard
	priv, jwks := authtest.KeyAndJWKS(t)
	verifier, err := auth.NewVerifier(context.Background(), jwks.URL)
	if err != nil {
		t.Fatal(err)
	}
	fake := &fakeGroq{replies: replies}
	groqSrv := httptest.NewServer(fake)
	t.Cleanup(groqSrv.Close)
	if limiter == nil {
		limiter = auth.NewRateLimiter(600, 100)
	}
	return &testServer{
		handler: newRouter(verifier, limiter, groq.NewClient("test-key", groqSrv.URL)),
		groq:    fake,
		token: func(sub string) string {
			return authtest.SignToken(t, priv, sub, time.Now().Add(time.Hour))
		},
	}
}

// call sends body (a JSON string or any marshalable value) and decodes the JSON response.
func (s *testServer) call(t *testing.T, method, path, token string, body any) (int, http.Header, map[string]any) {
	t.Helper()
	var payload []byte
	switch b := body.(type) {
	case nil:
	case string:
		payload = []byte(b)
	default:
		payload, _ = json.Marshal(b)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	s.handler.ServeHTTP(rec, req)
	var out map[string]any
	json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, rec.Header(), out
}

func (s *testServer) post(t *testing.T, path string, body any) (int, map[string]any) {
	t.Helper()
	code, _, out := s.call(t, http.MethodPost, path, s.token("user-1"), body)
	return code, out
}

func extraction(t *testing.T, res map[string]any) map[string]any {
	t.Helper()
	ex, _ := res["extraction"].(map[string]any)
	if ex == nil {
		t.Fatalf("expected an extraction, got %v", res)
	}
	return ex
}

var wallets = []map[string]any{
	{"id": "w-maybank", "name": "Maybank", "type": "bank", "currency": "MYR"},
	{"id": "w-tng", "name": "Touch n Go", "type": "ewallet", "currency": "MYR"},
}

var v1Routes = []string{"/v1/extract/text", "/v1/extract/image", "/v1/extract/notification", "/v1/chat/analyze"}

func TestHealthzNeedsNoToken(t *testing.T) {
	s := newTestServer(t, nil)
	code, _, body := s.call(t, http.MethodGet, "/healthz", "", nil)
	if code != http.StatusOK || body["status"] != "ok" {
		t.Fatalf("got %d %v", code, body)
	}
}

func TestV1RoutesRejectMissingOrInvalidTokens(t *testing.T) {
	s := newTestServer(t, nil)
	priv, _ := authtest.KeyAndJWKS(t)
	foreign := authtest.SignToken(t, priv, "user-1", time.Now().Add(time.Hour))

	for _, route := range v1Routes {
		for name, token := range map[string]string{"missing": "", "garbage": "not-a-jwt", "foreign key": foreign} {
			code, _, body := s.call(t, http.MethodPost, route, token, `{}`)
			if code != http.StatusUnauthorized || body["error"] == nil {
				t.Errorf("%s %s token: got %d %v", route, name, code, body)
			}
		}
	}
	if len(s.groq.requests) != 0 {
		t.Fatalf("unauthenticated requests reached Groq: %d", len(s.groq.requests))
	}
}

func TestInvalidBodiesReturn400WithoutCallingGroq(t *testing.T) {
	s := newTestServer(t, nil)
	cases := []struct{ route, body string }{
		{"/v1/extract/text", `{}`},
		{"/v1/extract/text", `{"text":`},
		{"/v1/chat/analyze", `{"snapshot":{}}`},
		{"/v1/chat/analyze", `{"message":"` + strings.Repeat("a", 2001) + `","snapshot":{}}`},
		{"/v1/chat/analyze", `{"message":"hi","snapshot":[1,2]}`},
		{"/v1/chat/analyze", `{"message":"hi","snapshot":{},"history":[{"role":"system","content":"x"}]}`},
	}
	for _, c := range cases {
		code, body := s.post(t, c.route, c.body)
		if code != http.StatusBadRequest || body["error"] == nil {
			t.Errorf("%s %.40s: got %d %v", c.route, c.body, code, body)
		}
	}
	if len(s.groq.requests) != 0 {
		t.Fatalf("invalid requests reached Groq: %d", len(s.groq.requests))
	}
}

func TestExtractTextReturnsWalletResolvedExtraction(t *testing.T) {
	s := newTestServer(t, nil, ok(`{"amount":12.5,"type":"expense","merchant":"FamilyMart","description":"Lunch",
		"wallet_id":"w-maybank","category_hint":"food","confidence":0.92,"reasoning":"paid by card"}`))

	code, res := s.post(t, "/v1/extract/text", map[string]any{"text": "lunch at familymart 12.50 maybank", "wallets": wallets})
	if code != http.StatusOK || res["status"] != "ok" {
		t.Fatalf("got %d %v", code, res)
	}
	ex := extraction(t, res)
	want := map[string]any{"amount": 12.5, "type": "expense", "merchant": "FamilyMart", "walletId": "w-maybank",
		"currency": "MYR", "categoryHint": "food", "confidence": 0.92}
	for k, v := range want {
		if ex[k] != v {
			t.Errorf("%s = %v, want %v", k, ex[k], v)
		}
	}
	if got := s.groq.models(); len(got) != 1 || got[0] != groq.ModelTextFast {
		t.Errorf("models = %v, want [%s]", got, groq.ModelTextFast)
	}
	if !strings.Contains(s.groq.promptText(0), "w-maybank") {
		t.Error("prompt did not include the wallet list")
	}
	if auth := s.groq.headers[0].Get("Authorization"); auth != "Bearer test-key" {
		t.Errorf("Groq Authorization = %q", auth)
	}
}

func TestExtractTextFallsBackToQualityModel(t *testing.T) {
	s := newTestServer(t, nil,
		groqReply{http.StatusInternalServerError, "overloaded"},
		ok(`{"amount":8,"type":"expense","merchant":"Grab","confidence":0.8,"reasoning":"ride"}`))

	_, res := s.post(t, "/v1/extract/text", map[string]any{"text": "grab 8", "wallets": wallets})
	if res["status"] != "ok" {
		t.Fatalf("got %v", res)
	}
	want := []string{groq.ModelTextFast, groq.ModelTextQuality}
	if got := s.groq.models(); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("models = %v, want %v", got, want)
	}
}

func TestExtractTextUnavailableWhenGroqRejectsTheKey(t *testing.T) {
	invalid := groqReply{http.StatusUnauthorized, "Invalid API Key"}
	s := newTestServer(t, nil, invalid, invalid)

	code, res := s.post(t, "/v1/extract/text", map[string]any{"text": "lunch 12", "wallets": wallets})
	if code != http.StatusOK || res["status"] != "unavailable" {
		t.Fatalf("got %d %v", code, res)
	}
	if reason, _ := res["reason"].(string); !strings.Contains(reason, "Invalid API Key") {
		t.Fatalf("reason %q does not surface the Groq error", reason)
	}
}

func TestExtractTextSkippedWithoutAmount(t *testing.T) {
	s := newTestServer(t, nil, ok(`{"amount":null,"type":"expense","reasoning":"no amount"}`))
	_, res := s.post(t, "/v1/extract/text", map[string]any{"text": "had lunch", "wallets": wallets})
	if res["status"] != "skipped" {
		t.Fatalf("got %v", res)
	}
}

func TestExtractImageSendsVisionRequest(t *testing.T) {
	receipt := `{"amount":12.5,"type":"expense","merchant":"FamilyMart KLCC","category_hint":"groceries","confidence":0.9,"reasoning":"total"}`
	for name, body := range map[string]map[string]any{
		"base64": {"imageBase64": "aGVsbG8=", "wallets": wallets},
		"url":    {"imageUrl": "https://example.com/r.jpg", "wallets": wallets},
	} {
		t.Run(name, func(t *testing.T) {
			s := newTestServer(t, nil, ok(receipt))
			_, res := s.post(t, "/v1/extract/image", body)
			if ex := extraction(t, res); ex["amount"] != 12.5 || ex["merchant"] != "FamilyMart KLCC" {
				t.Fatalf("got %v", ex)
			}
			if got := s.groq.models(); len(got) != 1 || got[0] != groq.ModelVision {
				t.Fatalf("models = %v", got)
			}
			wantURL := "data:image/jpeg;base64,aGVsbG8="
			if name == "url" {
				wantURL = "https://example.com/r.jpg"
			}
			if !strings.Contains(s.groq.promptText(0), wantURL) {
				t.Fatalf("image_url %q not sent", wantURL)
			}
		})
	}
}

func TestExtractImageWithoutImageIsSkipped(t *testing.T) {
	s := newTestServer(t, nil)
	_, res := s.post(t, "/v1/extract/image", map[string]any{"wallets": wallets})
	if res["status"] != "skipped" || len(s.groq.requests) != 0 {
		t.Fatalf("got %v with %d Groq calls", res, len(s.groq.requests))
	}
}

func notificationBody(text string) map[string]any {
	return map[string]any{
		"notification": map[string]any{"packageName": "com.maybank2u.life", "title": "Maybank2u", "text": text},
		"wallets":      wallets,
	}
}

func TestExtractNotificationUsesCurrencyFromNotification(t *testing.T) {
	s := newTestServer(t, nil, ok(`{"is_transaction":true,"amount":45,"currency":"SGD","type":"expense",
		"merchant":"Changi Shop","confidence":0.9,"reasoning":"card purchase"}`))

	body := notificationBody("Card purchase of SGD 45.00 at Changi Shop")
	body["lockedWalletId"] = "w-maybank"
	_, res := s.post(t, "/v1/extract/notification", body)
	ex := extraction(t, res)
	if ex["currency"] != "SGD" || ex["walletId"] != "w-maybank" || ex["amount"] != 45.0 {
		t.Fatalf("got %v", ex)
	}
	if !strings.Contains(s.groq.promptText(0), "com.maybank2u.life") {
		t.Error("prompt did not include the source app")
	}
}

func TestExtractNotificationSkipsNonTransactions(t *testing.T) {
	s := newTestServer(t, nil, ok(`{"is_transaction":false,"reasoning":"balance snapshot"}`))
	_, res := s.post(t, "/v1/extract/notification", notificationBody("Your available balance is RM 1,204.50"))
	if res["status"] != "skipped" || res["reason"] != "balance snapshot" {
		t.Fatalf("got %v", res)
	}
}

func TestExtractNotificationSkipsOneTimeCodesWithoutCallingGroq(t *testing.T) {
	s := newTestServer(t, nil)
	for _, text := range []string{
		"Your TAC is 482913 for a transfer of RM 300.00. Do not share this code with anyone.",
		"Maybank2u Secure TAC: approve RM 1,250.00 to ALI BIN ABU",
		"OTP 551203 for your RM 89.90 purchase. Don't share it.",
		"Kod pengesahan anda 774410 untuk RM 50.00. Jangan kongsi kod ini.",
	} {
		_, res := s.post(t, "/v1/extract/notification", notificationBody(text))
		if res["status"] != "skipped" {
			t.Errorf("%q: got %v", text, res)
		}
	}
	if len(s.groq.requests) != 0 {
		t.Fatalf("one-time codes reached Groq: %d", len(s.groq.requests))
	}
}

func TestExtractNotificationKeepsPurchasesThatMentionContact(t *testing.T) {
	s := newTestServer(t, nil, ok(`{"is_transaction":true,"amount":23.9,"currency":"MYR","type":"expense","confidence":0.9,"reasoning":"card"}`))
	_, res := s.post(t, "/v1/extract/notification",
		notificationBody("Card purchase RM 23.90 at FamilyMart. Contact 1300-88-6688 if this was not you."))
	if res["status"] != "ok" {
		t.Fatalf("got %v", res)
	}
}

func TestExtractNotificationFallsBackToQualityModel(t *testing.T) {
	s := newTestServer(t, nil,
		groqReply{http.StatusBadRequest, "Failed to generate JSON. Please adjust your prompt."},
		ok(`{"is_transaction":true,"amount":15,"currency":"MYR","type":"income","confidence":0.9,"reasoning":"received"}`))
	_, res := s.post(t, "/v1/extract/notification", notificationBody("ALI BIN ABU has transferred RM 15.00 to you."))
	if ex := extraction(t, res); ex["amount"] != 15.0 || ex["type"] != "income" {
		t.Fatalf("got %v", ex)
	}
	want := []string{groq.ModelTextFast, groq.ModelTextQuality}
	if got := s.groq.models(); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("models = %v, want %v", got, want)
	}
}

func TestExtractNotificationWithoutTextSkipsGroq(t *testing.T) {
	s := newTestServer(t, nil)
	_, res := s.post(t, "/v1/extract/notification", map[string]any{
		"notification": map[string]any{"packageName": "com.maybank2u.life"}, "wallets": wallets,
	})
	if res["status"] != "skipped" || len(s.groq.requests) != 0 {
		t.Fatalf("got %v with %d Groq calls", res, len(s.groq.requests))
	}
}

func TestChatAnalyzeRepliesWithHistory(t *testing.T) {
	s := newTestServer(t, nil, ok(`{"reply":"You spent RM 420 on food this month."}`))
	_, res := s.post(t, "/v1/chat/analyze", map[string]any{
		"message":  "how much on food?",
		"snapshot": map[string]any{"currency": "MYR", "food": 420},
		"history":  []map[string]string{{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}},
	})
	if res["status"] != "ok" || res["reply"] != "You spent RM 420 on food this month." || res["modelId"] != groq.ModelTextQuality {
		t.Fatalf("got %v", res)
	}
	if msgs, _ := s.groq.requests[0]["messages"].([]any); len(msgs) != 4 {
		t.Fatalf("sent %d messages, want system + 2 history + question", len(msgs))
	}
}

func TestChatAnalyzeUnavailableWhenGroqFails(t *testing.T) {
	s := newTestServer(t, nil, groqReply{http.StatusInternalServerError, "down"})
	code, res := s.post(t, "/v1/chat/analyze", map[string]any{"message": "hi", "snapshot": map[string]any{}})
	if code != http.StatusOK || res["status"] != "unavailable" {
		t.Fatalf("got %d %v", code, res)
	}
}

func TestRateLimitIsPerUser(t *testing.T) {
	s := newTestServer(t, auth.NewRateLimiter(1, 2))
	body := `{"message":"hi","snapshot":{}}`
	alice, bob := s.token("alice"), s.token("bob")

	for i := 0; i < 2; i++ {
		if code, _, _ := s.call(t, http.MethodPost, "/v1/chat/analyze", alice, body); code == http.StatusTooManyRequests {
			t.Fatalf("request %d limited inside the burst", i+1)
		}
	}
	code, headers, res := s.call(t, http.MethodPost, "/v1/chat/analyze", alice, body)
	if code != http.StatusTooManyRequests || headers.Get("Retry-After") != "10" || res["error"] == nil {
		t.Fatalf("third request: got %d %v", code, res)
	}
	if code, _, _ := s.call(t, http.MethodPost, "/v1/chat/analyze", bob, body); code == http.StatusTooManyRequests {
		t.Fatal("another user was limited by alice's budget")
	}
}
