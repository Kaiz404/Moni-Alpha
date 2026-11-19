package budget

import (
	"context"
	"math"
	"strings"
	"time"
	"unicode/utf16"

	"github.com/kaiz404/moni/backend/internal/chat"
	"github.com/kaiz404/moni/backend/internal/llm"
)

// Limits from budgetQuestionSchema and budgetSuggestAmountSchema in @repo/types.
const (
	maxQuestions  = 3
	maxChoices    = 4
	maxQuestion   = 200
	maxChoice     = 60
	maxNote       = 300
	maxWholeUnits = 99_999 // below PLAN_LIMIT_MINOR, the apps' limit on a budget
)

type Service struct {
	llm *llm.Client
}

func NewService(client *llm.Client) *Service {
	return &Service{llm: client}
}

// Suggest asks Moni's questions when the request carries no answers and suggests an amount when it
// does. Model or provider failures come back as unavailable, never as an error.
func (s *Service) Suggest(ctx context.Context, req Request) Result {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if len(req.Answers) == 0 {
		return s.questions(ctx, req)
	}
	return s.suggestion(ctx, req)
}

func (s *Service) questions(ctx context.Context, req Request) Result {
	var out struct {
		Questions []Question `json:"questions"`
	}
	if err := s.complete(ctx, "suggest-budget-questions", systemPrompt(questionsPrompt, req.Tone), req, &out); err != nil {
		return Result{Status: "unavailable", Reason: "Questions failed: " + err.Error()}
	}
	var questions []Question
	for _, q := range out.Questions {
		text := strings.TrimSpace(q.Text)
		if text == "" {
			continue
		}
		choices := []string{}
		for _, c := range q.Choices {
			if c = strings.TrimSpace(c); c != "" && len(choices) < maxChoices {
				choices = append(choices, clamp(chat.GlossaryReply(c), maxChoice))
			}
		}
		questions = append(questions, Question{Text: clamp(text, maxQuestion), Choices: choices})
		if len(questions) == maxQuestions {
			break
		}
	}
	if len(questions) == 0 {
		return Result{Status: "unavailable", Reason: "Questions returned none"}
	}
	return Result{Status: "ok", Step: "questions", Questions: questions, ModelID: llm.Model}
}

func (s *Service) suggestion(ctx context.Context, req Request) Result {
	var out struct {
		Amount float64 `json:"amount"`
		Note   string  `json:"note"`
	}
	if err := s.complete(ctx, "suggest-budget", systemPrompt(suggestionPrompt, req.Tone), req, &out); err != nil {
		return Result{Status: "unavailable", Reason: "Suggestion failed: " + err.Error()}
	}
	units := math.Floor(out.Amount)
	if units <= 0 || units > maxWholeUnits {
		return Result{Status: "unavailable", Reason: "Suggestion returned an amount out of range"}
	}
	note := strings.TrimSpace(out.Note)
	if note == "" {
		return Result{Status: "unavailable", Reason: "Suggestion returned no note"}
	}
	return Result{
		Status:      "ok",
		Step:        "suggestion",
		AmountMinor: int64(units) * 100,
		Note:        clamp(chat.GlossaryReply(note), maxNote),
		ModelID:     llm.Model,
	}
}

func (s *Service) complete(ctx context.Context, name, system string, req Request, out any) error {
	messages := []llm.Message{
		{Role: "system", Content: system},
		{Role: "user", Content: userContent(req)},
	}
	return s.llm.CompleteJSON(ctx, messages,
		llm.Options{Name: name, Model: llm.Model, Temperature: 0.3, MaxTokens: 600, MaxRetryWait: 10 * time.Second},
		out,
	)
}

func userContent(req Request) string {
	var b strings.Builder
	b.WriteString("CATEGORY: ")
	if req.Category == nil {
		b.WriteString("all spending")
	} else {
		b.WriteString(strings.TrimSpace(*req.Category))
	}
	b.WriteString("\nCURRENCY: " + req.Currency + "\nSPENDING:")
	if len(req.Months) == 0 {
		b.WriteString(" none")
	}
	for _, m := range req.Months {
		b.WriteString("\n- " + monthName(m.Month) + ": " + chat.FormatMinor(m.SpentMinor, req.Currency))
	}
	if len(req.Answers) > 0 {
		b.WriteString("\nANSWERS:")
		for _, a := range req.Answers {
			b.WriteString("\n- Q: " + strings.TrimSpace(a.Question) + "\n  A: " + strings.TrimSpace(a.Answer))
		}
	}
	return b.String()
}

// monthName turns "2026-08" into "August 2026"; binding has already checked the format.
func monthName(month string) string {
	t, err := time.Parse("2006-01", month)
	if err != nil {
		return month
	}
	return t.Format("January 2006")
}

// clamp keeps s within max UTF-16 code units, the length Zod checks on the client.
func clamp(s string, max int) string {
	if utf16Len(s) <= max {
		return s
	}
	var b strings.Builder
	n := 0
	for _, r := range s {
		w := utf16.RuneLen(r)
		if n+w > max-1 {
			break
		}
		b.WriteRune(r)
		n += w
	}
	return b.String() + "…"
}

func utf16Len(s string) int {
	n := 0
	for _, r := range s {
		n += utf16.RuneLen(r)
	}
	return n
}
