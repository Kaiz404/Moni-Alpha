package groq

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExtractJSON(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{`{"a":1}`, `{"a":1}`},
		{"```json\n{\"a\":1}\n```", `{"a":1}`},
		{"```\n{\"a\":1}\n```", `{"a":1}`},
		{"Here is the result: {\"a\":1} hope it helps", `{"a":1}`},
	}
	for _, c := range cases {
		if got := ExtractJSON(c.in); got != c.want {
			t.Errorf("ExtractJSON(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func fakeGroq(t *testing.T, content string, status int) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		if status != http.StatusOK {
			w.WriteHeader(status)
			return
		}
		resp := map[string]any{
			"choices": []map[string]any{
				{"message": map[string]any{"content": content}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
}

func TestCompleteJSON(t *testing.T) {
	srv := fakeGroq(t, `{"amount": 12.5, "type": "expense"}`, http.StatusOK)
	defer srv.Close()

	client := NewClient("test-key", srv.URL)
	var out struct {
		Amount float64 `json:"amount"`
		Type   string  `json:"type"`
	}
	err := client.CompleteJSON(context.Background(),
		[]Message{{Role: "user", Content: "hi"}},
		Options{Model: ModelTextFast}, &out)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Amount != 12.5 || out.Type != "expense" {
		t.Fatalf("unexpected output: %+v", out)
	}
}

func TestCompleteJSONSendsQwenReasoningOptions(t *testing.T) {
	var received ChatRequest
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"content": `{"amount": 12.5}`}}},
		})
	}))
	defer srv.Close()

	client := NewClient("test-key", srv.URL)
	var out struct {
		Amount float64 `json:"amount"`
	}
	err := client.CompleteJSON(context.Background(),
		[]Message{{Role: "user", Content: "Return JSON."}},
		Options{
			Model:           ModelVision,
			ReasoningEffort: "none",
			ReasoningFormat: "hidden",
		},
		&out,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if received.ReasoningEffort != "none" || received.ReasoningFormat != "hidden" {
		t.Fatalf("missing Qwen reasoning options: %+v", received)
	}
	if received.ResponseFormat == nil || received.ResponseFormat.Type != "json_object" {
		t.Fatalf("expected JSON object response format: %+v", received.ResponseFormat)
	}
}

func TestRateLimitedNoRetryWindow(t *testing.T) {
	srv := fakeGroq(t, "", http.StatusTooManyRequests)
	defer srv.Close()

	client := NewClient("test-key", srv.URL)
	_, err := client.Complete(context.Background(),
		[]Message{{Role: "user", Content: "hi"}},
		Options{Model: ModelTextFast}) // MaxRetryWait 0 => fail fast
	if err == nil {
		t.Fatal("expected rate limit error")
	}
	if _, ok := err.(*RateLimitedError); !ok {
		t.Fatalf("expected RateLimitedError, got %T: %v", err, err)
	}
}
