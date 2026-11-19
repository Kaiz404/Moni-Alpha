package budget

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/kaiz404/moni/backend/internal/llm"
)

type sent struct {
	messages []llm.Message
	maxTok   float64
}

// fakeModel answers every completion with content (or fails with status) and records what it was sent.
func fakeModel(t *testing.T, status int, content string) (*Service, *[]sent) {
	t.Helper()
	var calls []sent
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages  []llm.Message `json:"messages"`
			MaxTokens float64       `json:"max_tokens"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode completion request: %v", err)
		}
		calls = append(calls, sent{messages: body.Messages, maxTok: body.MaxTokens})
		w.WriteHeader(status)
		if status != http.StatusOK {
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"message": content}})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{"message": map[string]string{"content": content}, "finish_reason": "stop"}},
		})
	}))
	t.Cleanup(srv.Close)
	return NewService(llm.NewClient("test", srv.URL)), &calls
}

func food() *string { s := "Food & Dining"; return &s }

var history = []Month{{"2026-08", 52130}, {"2026-09", 47890}, {"2026-10", 34980}}

var answers = []Answer{
	{"How often do you eat out?", "Most weekdays"},
	{"What does a meal out usually cost?", "About RM15"},
}

func TestQuestionsFromSpendingHistory(t *testing.T) {
	svc, calls := fakeModel(t, http.StatusOK, `{"questions":[
		{"text":"How often do you eat out?","choices":["Most days","Most weekdays","A few times a week","Rarely","Never"]},
		{"text":"  ","choices":["skip me"]},
		{"text":"What does a meal out usually cost?","choices":["Under RM 10","About MYR 15",""]},
		{"text":"Do you cook at home?"},
		{"text":"A fourth question past the limit","choices":[]}
	]}`)

	got := svc.Suggest(context.Background(), Request{Category: food(), Currency: "MYR", Months: history})

	want := Result{Status: "ok", Step: "questions", ModelID: llm.Model, Questions: []Question{
		{Text: "How often do you eat out?", Choices: []string{"Most days", "Most weekdays", "A few times a week", "Rarely"}},
		{Text: "What does a meal out usually cost?", Choices: []string{"Under RM10", "About RM15"}},
		{Text: "Do you cook at home?", Choices: []string{}},
	}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v\nwant %+v", got, want)
	}
	user := (*calls)[0].messages[1].Content
	wantUser := "CATEGORY: Food & Dining\nCURRENCY: MYR\nSPENDING:\n- August 2026: RM521.30\n- September 2026: RM478.90\n- October 2026: RM349.80"
	if user != wantUser {
		t.Fatalf("user message\n%q\nwant\n%q", user, wantUser)
	}
	if (*calls)[0].maxTok != 600 {
		t.Fatalf("max_tokens %v, want 600", (*calls)[0].maxTok)
	}
}

func TestQuestionsForTheMonthlyTotalWithoutHistory(t *testing.T) {
	svc, calls := fakeModel(t, http.StatusOK, `{"questions":[{"text":"How much are your fixed bills?","choices":["Under SGD 500"]}]}`)

	got := svc.Suggest(context.Background(), Request{Currency: "SGD", Tone: "direct"})

	if got.Status != "ok" || got.Step != "questions" || len(got.Questions) != 1 {
		t.Fatalf("got %+v", got)
	}
	if user := (*calls)[0].messages[1].Content; user != "CATEGORY: all spending\nCURRENCY: SGD\nSPENDING: none" {
		t.Fatalf("user message %q", user)
	}
	system, _ := (*calls)[0].messages[0].Content.(string)
	if want := systemPrompt(questionsPrompt, "direct"); system != want {
		t.Fatalf("system prompt does not carry the direct voice")
	}
}

func TestQuestionsUnavailableWhenNoneSurvive(t *testing.T) {
	svc, _ := fakeModel(t, http.StatusOK, `{"questions":[{"text":" ","choices":["a"]}]}`)
	got := svc.Suggest(context.Background(), Request{Category: food(), Currency: "MYR"})
	if want := (Result{Status: "unavailable", Reason: "Questions returned none"}); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestSuggestionFloorsToWholeUnits(t *testing.T) {
	svc, calls := fakeModel(t, http.StatusOK, `{"amount":452.7,"note":"About 22 meals out at RM 15 and some groceries."}`)

	got := svc.Suggest(context.Background(), Request{Category: food(), Currency: "MYR", Months: history[:1], Answers: answers})

	want := Result{Status: "ok", Step: "suggestion", AmountMinor: 45200,
		Note: "About 22 meals out at RM15 and some groceries.", ModelID: llm.Model}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v\nwant %+v", got, want)
	}
	wantUser := "CATEGORY: Food & Dining\nCURRENCY: MYR\nSPENDING:\n- August 2026: RM521.30\nANSWERS:" +
		"\n- Q: How often do you eat out?\n  A: Most weekdays\n- Q: What does a meal out usually cost?\n  A: About RM15"
	if user := (*calls)[0].messages[1].Content; user != wantUser {
		t.Fatalf("user message\n%q\nwant\n%q", user, wantUser)
	}
}

func TestSuggestionClampsTheNote(t *testing.T) {
	long := make([]byte, 400)
	for i := range long {
		long[i] = 'a'
	}
	svc, _ := fakeModel(t, http.StatusOK, `{"amount":300,"note":"`+string(long)+`"}`)
	got := svc.Suggest(context.Background(), Request{Category: food(), Currency: "MYR", Answers: answers})
	if got.AmountMinor != 30000 || utf16Len(got.Note) != 300 || got.Note[len(got.Note)-3:] != "…" {
		t.Fatalf("got amount %d, note length %d", got.AmountMinor, utf16Len(got.Note))
	}
}

func TestSuggestionRefusesAnAmountOutOfRange(t *testing.T) {
	for _, reply := range []string{
		`{"amount":0,"note":"Nothing."}`,
		`{"amount":0.6,"note":"Under one ringgit."}`,
		`{"amount":-50,"note":"Negative."}`,
		`{"amount":100000,"note":"At the plan limit."}`,
	} {
		svc, _ := fakeModel(t, http.StatusOK, reply)
		got := svc.Suggest(context.Background(), Request{Category: food(), Currency: "MYR", Answers: answers})
		if want := (Result{Status: "unavailable", Reason: "Suggestion returned an amount out of range"}); !reflect.DeepEqual(got, want) {
			t.Errorf("%s: got %+v", reply, got)
		}
	}
}

func TestSuggestionTakesTheLargestBudgetAllowed(t *testing.T) {
	svc, _ := fakeModel(t, http.StatusOK, `{"amount":99999.9,"note":"Big month."}`)
	got := svc.Suggest(context.Background(), Request{Category: food(), Currency: "MYR", Answers: answers})
	if got.Status != "ok" || got.AmountMinor != 9_999_900 {
		t.Fatalf("got %+v", got)
	}
}

func TestSuggestionUnavailableWithoutANote(t *testing.T) {
	svc, _ := fakeModel(t, http.StatusOK, `{"amount":450,"note":"  "}`)
	got := svc.Suggest(context.Background(), Request{Category: food(), Currency: "MYR", Answers: answers})
	if want := (Result{Status: "unavailable", Reason: "Suggestion returned no note"}); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}

func TestModelErrorIsUnavailable(t *testing.T) {
	svc, _ := fakeModel(t, http.StatusInternalServerError, "upstream down")
	got := svc.Suggest(context.Background(), Request{Category: food(), Currency: "MYR", Answers: answers})
	if want := (Result{Status: "unavailable", Reason: "Suggestion failed: llm 500: upstream down"}); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
	got = svc.Suggest(context.Background(), Request{Category: food(), Currency: "MYR"})
	if want := (Result{Status: "unavailable", Reason: "Questions failed: llm 500: upstream down"}); !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v", got)
	}
}
