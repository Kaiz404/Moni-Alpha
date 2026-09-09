package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/kaiz404/moni/backend/internal/llm"
)

type Service struct {
	llm *llm.Client
}

func NewService(client *llm.Client) *Service {
	return &Service{llm: client}
}

func (s *Service) Analyze(ctx context.Context, req AnalyzeRequest) AnalyzeResult {
	if len(strings.TrimSpace(req.Message)) == 0 {
		return AnalyzeResult{Status: "unavailable", Reason: "Message is required"}
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	var userContent strings.Builder
	userContent.WriteString("FINANCE_SNAPSHOT:\n")
	userContent.Write(req.Snapshot)
	userContent.WriteString("\n\nUSER_QUESTION:\n")
	userContent.WriteString(strings.TrimSpace(req.Message))

	messages := []llm.Message{{Role: "system", Content: analyzeSystemPrompt}}
	for _, h := range req.History {
		role := strings.TrimSpace(h.Role)
		content := strings.TrimSpace(h.Content)
		if content == "" || (role != "user" && role != "assistant") {
			continue
		}
		messages = append(messages, llm.Message{Role: role, Content: content})
	}
	messages = append(messages, llm.Message{Role: "user", Content: userContent.String()})

	var out struct {
		Reply string `json:"reply"`
	}
	err := s.llm.CompleteJSON(ctx, messages,
		llm.Options{Model: llm.Model, Temperature: 0.35, MaxTokens: 500, MaxRetryWait: 10 * time.Second},
		&out,
	)
	if err != nil {
		return AnalyzeResult{Status: "unavailable", Reason: "Analysis failed: " + err.Error()}
	}

	reply := strings.TrimSpace(out.Reply)
	if reply == "" {
		return AnalyzeResult{Status: "unavailable", Reason: "Analysis returned empty reply"}
	}

	return AnalyzeResult{
		Status:  "ok",
		Reply:   clamp(reply, 2000),
		ModelID: llm.Model,
	}
}

func clamp(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max-1]) + "…"
}

// ValidateSnapshot ensures the snapshot JSON is parseable before sending to the model.
func ValidateSnapshot(raw json.RawMessage) error {
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return fmt.Errorf("invalid snapshot: %w", err)
	}
	return nil
}
