package chat

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/kaiz404/moni/backend/internal/llm"
)

func TestAnalyzeInvalidBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := NewService(llm.NewClient("test", "http://example.com"))
	h := NewHandler(svc)

	r := gin.New()
	h.Register(r)

	req := httptest.NewRequest(http.MethodPost, "/chat/analyze", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestValidateSnapshot(t *testing.T) {
	if err := ValidateSnapshot(json.RawMessage(`{"schema":"finance_assistant_tool_v4"}`)); err != nil {
		t.Fatalf("expected valid snapshot: %v", err)
	}
	if err := ValidateSnapshot(json.RawMessage(`not-json`)); err == nil {
		t.Fatal("expected invalid snapshot error")
	}
}

// fakeModel answers every completion with `reply` and records the system prompt it was sent.
func fakeModel(t *testing.T, reply string) (*llm.Client, *string) {
	t.Helper()
	var system string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode completion request: %v", err)
		}
		system = body.Messages[0].Content
		content, _ := json.Marshal(map[string]string{"reply": reply})
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]string{"content": string(content)}, "finish_reason": "stop"}},
		})
	}))
	t.Cleanup(srv.Close)
	return llm.NewClient("test", srv.URL), &system
}

func TestAnalyzeTone(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		name  string
		body  string
		voice string
	}{
		{"old client without tone", `{"message":"what can you do?","snapshot":{}}`, tones["friendly"]},
		{"direct", `{"message":"what can you do?","snapshot":{},"tone":"direct"}`, tones["direct"]},
		{"playful", `{"message":"what can you do?","snapshot":{},"tone":"playful"}`, tones["playful"]},
		{"unknown tone from a newer client", `{"message":"what can you do?","snapshot":{},"tone":"pirate"}`, tones["friendly"]},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			client, system := fakeModel(t, "I add spends and answer money questions.")
			r := gin.New()
			NewHandler(NewService(client)).Register(r)
			req := httptest.NewRequest(http.MethodPost, "/chat/analyze", bytes.NewBufferString(tc.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("status %d: %s", w.Code, w.Body.String())
			}
			var res AnalyzeResult
			if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil || res.Status != "ok" || res.Reply != "I add spends and answer money questions." {
				t.Fatalf("result %+v, err %v", res, err)
			}
			if !strings.Contains(*system, "- Voice: "+tc.voice) {
				t.Fatalf("system prompt does not carry the %s voice", tc.name)
			}
			if strings.Contains(*system, "{{voice}}") {
				t.Fatal("system prompt kept the voice placeholder")
			}
		})
	}
}
