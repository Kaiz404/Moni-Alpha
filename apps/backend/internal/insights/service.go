// Package insights generates the Moni Finance Assistant payload
// (moni_finance_assistant_v1 in @repo/types) from a deterministic
// snapshot computed on the mobile client.
package insights

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/kaiz404/moni/backend/internal/groq"
)

const disclaimer = "Moni AI insights are informational only and not professional financial advice."

type Request struct {
	// Snapshot is the finance_assistant_tool_v1 snapshot; kept opaque and
	// sliced per agent so mobile can evolve it without backend changes.
	Snapshot json.RawMessage `json:"snapshot" binding:"required"`
}

type InsightBlock struct {
	AgentKey string `json:"agentKey"`
	Label    string `json:"label"`
	Title    string `json:"title"`
	Body     string `json:"body"`
}

type FinanceAssistantV1 struct {
	Schema     string         `json:"schema"`
	Disclaimer string         `json:"disclaimer"`
	Insights   []InsightBlock `json:"insights"`
	Trace      *struct {
		Stages []string `json:"stages,omitempty"`
	} `json:"trace,omitempty"`
}

type Result struct {
	Status  string              `json:"status"` // "ok" | "unavailable"
	Result  *FinanceAssistantV1 `json:"result,omitempty"`
	ModelID string              `json:"modelId,omitempty"`
	Reason  string              `json:"reason,omitempty"`
}

type Service struct {
	groq *groq.Client
}

func NewService(client *groq.Client) *Service {
	return &Service{groq: client}
}

type agentSpec struct {
	key          string
	defaultLabel string
	systemPrompt string
	payloadName  string
	// snapshotKeys are the top-level snapshot fields this agent receives.
	snapshotKeys []string
}

var agents = []agentSpec{
	{
		key:          "spending_trend",
		defaultLabel: "Trend Strategist",
		systemPrompt: trendStrategistPrompt,
		payloadName:  "TREND_DATA",
		snapshotKeys: []string{"calendarMonth", "rolling30"},
	},
	{
		key:          "budget_advisor",
		defaultLabel: "Budget Advisor",
		systemPrompt: budgetAdvisorPrompt,
		payloadName:  "BUDGET_SNAPSHOT",
		snapshotKeys: []string{"budgetCoach"},
	},
	{
		key:          "spending_story",
		defaultLabel: "Spending Story",
		systemPrompt: spendingStoryPrompt,
		payloadName:  "STORY_SNAPSHOT",
		snapshotKeys: []string{"spendingStory"},
	},
}

// Generate runs the three insight agents in parallel on the quality model.
func (s *Service) Generate(ctx context.Context, req Request) Result {
	var snapshot map[string]json.RawMessage
	if err := json.Unmarshal(req.Snapshot, &snapshot); err != nil {
		return Result{Status: "unavailable", Reason: "Invalid snapshot payload"}
	}

	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	blocks := make([]InsightBlock, len(agents))
	errs := make([]error, len(agents))
	var wg sync.WaitGroup
	for i, agent := range agents {
		wg.Add(1)
		go func(i int, agent agentSpec) {
			defer wg.Done()
			blocks[i], errs[i] = s.runAgent(ctx, agent, snapshot)
		}(i, agent)
	}
	wg.Wait()

	for _, err := range errs {
		if err != nil {
			return Result{Status: "unavailable", Reason: "Insight generation failed: " + err.Error()}
		}
	}

	return Result{
		Status:  "ok",
		ModelID: groq.ModelTextQuality,
		Result: &FinanceAssistantV1{
			Schema:     "moni_finance_assistant_v1",
			Disclaimer: disclaimer,
			Insights:   blocks,
		},
	}
}

func (s *Service) runAgent(
	ctx context.Context,
	agent agentSpec,
	snapshot map[string]json.RawMessage,
) (InsightBlock, error) {
	payload := map[string]json.RawMessage{}
	for _, key := range agent.snapshotKeys {
		if raw, ok := snapshot[key]; ok {
			payload[key] = raw
		}
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return InsightBlock{}, err
	}

	var out struct {
		Label string `json:"label"`
		Title string `json:"title"`
		Body  string `json:"body"`
	}
	err = s.groq.CompleteJSON(ctx,
		[]groq.Message{
			{Role: "system", Content: agent.systemPrompt},
			{Role: "user", Content: fmt.Sprintf("%s:\n%s", agent.payloadName, payloadJSON)},
		},
		groq.Options{Model: groq.ModelTextQuality, Temperature: 0.4, MaxTokens: 700, MaxRetryWait: 15 * time.Second},
		&out,
	)
	if err != nil {
		return InsightBlock{}, err
	}
	if strings.TrimSpace(out.Body) == "" {
		return InsightBlock{}, fmt.Errorf("%s returned empty body", agent.key)
	}

	label := strings.TrimSpace(out.Label)
	if label == "" {
		label = agent.defaultLabel
	}
	title := strings.TrimSpace(out.Title)
	if title == "" {
		title = agent.defaultLabel
	}

	// Enforce @repo/types moniFinanceAssistantV1Schema limits.
	return InsightBlock{
		AgentKey: agent.key,
		Label:    clamp(label, 48),
		Title:    clamp(title, 160),
		Body:     clamp(strings.TrimSpace(out.Body), 1200),
	}, nil
}

func clamp(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max-1]) + "…"
}
