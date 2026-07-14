package chat

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/kaiz404/moni/backend/internal/groq"
)

func TestAnalyzeInvalidBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := NewService(groq.NewClient("test", "http://example.com"))
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
	if err := ValidateSnapshot(json.RawMessage(`{"schema":"finance_assistant_tool_v1"}`)); err != nil {
		t.Fatalf("expected valid snapshot: %v", err)
	}
	if err := ValidateSnapshot(json.RawMessage(`not-json`)); err == nil {
		t.Fatal("expected invalid snapshot error")
	}
}
