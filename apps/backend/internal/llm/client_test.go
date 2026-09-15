package llm

import (
	"context"
	"encoding/json"
	"errors"
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

func fakeLLM(t *testing.T, content string, status int) *httptest.Server {
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
	srv := fakeLLM(t, `{"amount": 12.5, "type": "expense"}`, http.StatusOK)
	defer srv.Close()

	client := NewClient("test-key", srv.URL)
	var out struct {
		Amount float64 `json:"amount"`
		Type   string  `json:"type"`
	}
	err := client.CompleteJSON(context.Background(),
		[]Message{{Role: "user", Content: "hi"}},
		Options{Model: Model}, &out)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Amount != 12.5 || out.Type != "expense" {
		t.Fatalf("unexpected output: %+v", out)
	}
}

func TestCompleteJSONAsksOpenRouterForJSONWithoutReasoning(t *testing.T) {
	var received map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]any{"content": `{"amount": 12.5}`}}},
		})
	}))
	defer srv.Close()

	var out struct {
		Amount float64 `json:"amount"`
	}
	err := NewClient("test-key", srv.URL).CompleteJSON(context.Background(),
		[]Message{{Role: "user", Content: "Return JSON."}}, Options{Model: Model}, &out)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got, _ := json.Marshal(map[string]any{
		"model": received["model"], "response_format": received["response_format"],
		"reasoning": received["reasoning"], "provider": received["provider"],
	})
	want := `{"model":"deepseek/deepseek-v4.1-flash","provider":{"require_parameters":true},"reasoning":{"enabled":false},"response_format":{"type":"json_object"}}`
	if string(got) != want {
		t.Fatalf("request = %s, want %s", got, want)
	}
}

func TestRateLimitedNoRetryWindow(t *testing.T) {
	srv := fakeLLM(t, "", http.StatusTooManyRequests)
	defer srv.Close()

	client := NewClient("test-key", srv.URL)
	_, err := client.Complete(context.Background(),
		[]Message{{Role: "user", Content: "hi"}},
		Options{Model: Model}) // MaxRetryWait 0 => fail fast
	if err == nil {
		t.Fatal("expected rate limit error")
	}
	if _, ok := err.(*RateLimitedError); !ok {
		t.Fatalf("expected RateLimitedError, got %T: %v", err, err)
	}
}

func TestTruncatedOutputRetriesOnceWithDoubleBudget(t *testing.T) {
	var budgets []float64
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		json.NewDecoder(r.Body).Decode(&req)
		budgets = append(budgets, req["max_tokens"].(float64))
		choice := map[string]any{"message": map[string]any{"content": `{"reply":"cut`}, "finish_reason": "length"}
		if len(budgets) == 2 {
			choice = map[string]any{"message": map[string]any{"content": `{"reply":"done"}`}, "finish_reason": "stop"}
		}
		json.NewEncoder(w).Encode(map[string]any{"choices": []any{choice}})
	}))
	defer srv.Close()

	var out struct {
		Reply string `json:"reply"`
	}
	err := NewClient("test-key", srv.URL).CompleteJSON(context.Background(),
		[]Message{{Role: "user", Content: "hi"}}, Options{Model: Model, MaxTokens: 900}, &out)
	if err != nil || out.Reply != "done" {
		t.Fatalf("got %+v, %v", out, err)
	}
	if len(budgets) != 2 || budgets[0] != 900 || budgets[1] != 1800 {
		t.Fatalf("max_tokens per call = %v, want [900 1800]", budgets)
	}
}

func TestTruncatedTwiceReturnsErrTruncated(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		json.NewEncoder(w).Encode(map[string]any{"choices": []any{
			map[string]any{"message": map[string]any{"content": `{"reply":"cut`}, "finish_reason": "length"},
		}})
	}))
	defer srv.Close()

	_, err := NewClient("test-key", srv.URL).Complete(context.Background(),
		[]Message{{Role: "user", Content: "hi"}}, Options{Model: Model, MaxTokens: 100})
	if !errors.Is(err, ErrTruncated) || calls != 2 {
		t.Fatalf("got %v after %d calls, want ErrTruncated after 2", err, calls)
	}
}
