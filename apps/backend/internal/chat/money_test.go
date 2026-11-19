package chat

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/kaiz404/moni/backend/internal/llm"
)

func TestAnalyzeSpeaksGlossaryMoney(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var question string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		question = body.Messages[len(body.Messages)-1].Content
		content, _ := json.Marshal(map[string]string{"reply": "You spent MYR 1116.20 in the last 30 days."})
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]string{"content": string(content)}, "finish_reason": "stop"}},
		})
	}))
	t.Cleanup(srv.Close)
	raw, err := os.ReadFile("../../../../packages/types/fixtures/ai/chat-analyze-request.json")
	if err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	NewHandler(NewService(llm.NewClient("test", srv.URL))).Register(r)
	req := httptest.NewRequest(http.MethodPost, "/chat/analyze", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var res AnalyzeResult
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if res.Reply != "You spent RM1,116.20 in the last 30 days." {
		t.Fatalf("reply %q", res.Reply)
	}
	if !strings.Contains(question, `"expenseTotal":"RM1,116.20"`) || !strings.Contains(question, `"liquid":"RM5,230.55"`) {
		t.Fatalf("the model did not read glossary amounts:\n%s", question)
	}
}
