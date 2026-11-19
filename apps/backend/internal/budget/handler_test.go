package budget

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/kaiz404/moni/backend/internal/llm"
)

func TestInvalidBodiesAre400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	NewHandler(NewService(llm.NewClient("test", "http://127.0.0.1:1"))).Register(r)

	month := `{"month":"2026-08","spentMinor":100}`
	answer := `{"question":"q","answer":"a"}`
	for name, body := range map[string]string{
		"empty":              `{}`,
		"not json":           `{"currency":`,
		"lowercase currency": `{"category":null,"currency":"myr","months":[],"answers":[]}`,
		"numeric currency":   `{"category":null,"currency":"MY1","months":[],"answers":[]}`,
		"empty category":     `{"category":"","currency":"MYR","months":[],"answers":[]}`,
		"bad month":          `{"category":null,"currency":"MYR","months":[{"month":"2026-13","spentMinor":1}],"answers":[]}`,
		"negative spend":     `{"category":null,"currency":"MYR","months":[{"month":"2026-08","spentMinor":-1}],"answers":[]}`,
		"seven months":       `{"category":null,"currency":"MYR","months":[` + strings.Repeat(month+",", 6) + month + `],"answers":[]}`,
		"empty answer":       `{"category":null,"currency":"MYR","months":[],"answers":[{"question":"q","answer":""}]}`,
		"long answer":        `{"category":null,"currency":"MYR","months":[],"answers":[{"question":"q","answer":"` + strings.Repeat("a", 201) + `"}]}`,
		"seven answers":      `{"category":null,"currency":"MYR","months":[],"answers":[` + strings.Repeat(answer+",", 6) + answer + `]}`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/budget/suggest", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), `"error":"Invalid request body"`) {
			t.Errorf("%s: got %d %s", name, w.Code, w.Body)
		}
	}
}
