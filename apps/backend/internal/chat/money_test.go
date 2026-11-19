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

func TestGlossaryReply(t *testing.T) {
	cases := []struct{ in, want string }{
		{"You spent MYR 365.10 on food.", "You spent RM365.10 on food."},
		{"You spent MYR365.10 on food.", "You spent RM365.10 on food."},
		{"Your income was MYR 4,589.90.", "Your income was RM4,589.90."},
		{"Rent was RM 1500.", "Rent was RM1,500."},
		{"Average 70.78 MYR a day.", "Average RM70.78 a day."},
		{"Acme pays you 4,500 MYR on 25 Oct.", "Acme pays you RM4,500 on 25 Oct."},
		{"A 1500 ringgit rent.", "A RM1,500 rent."},
		{"RM1,500 MYR went to rent.", "RM1,500 went to rent."},
		{"You'd be at -RM122.33 in the worst case.", "You'd be at −RM122.33 in the worst case."},
		{"You'd be at RM-122.33.", "You'd be at −RM122.33."},
		{"(–MYR 45.90)", "(−RM45.90)"},
		{"-MYR 12 at the start.", "−RM12 at the start."},
		{"Somewhere between RM5-RM9.", "Somewhere between RM5-RM9."},
		{"Already right: RM1,116.20 and −RM45.90.", "Already right: RM1,116.20 and −RM45.90."},
		{"You spent SGD 78.40 and USD 2.99.", "You spent SGD 78.40 and USD 2.99."},
		{"MYR 2,123.40, SGD 78.40 and 2.99 USD.", "RM2,123.40, SGD 78.40 and 2.99 USD."},
		{"Your MYR balance is RM8,751.50.", "Your ringgit balance is RM8,751.50."},
		{"In MYR, Housing led at RM1,500.00.", "In ringgit, Housing led at RM1,500.00."},
		{"That's down −SGD 78.40 to SGD 421.60.", "That's down SGD 78.40 to SGD 421.60."},
		{"You'd be short by -RM122 in the worst case.", "You'd be short by RM122 in the worst case."},
		{"You'd be left at −RM248 likely.", "You'd be left at −RM248 likely."},
		{"No money here, just 25 October.", "No money here, just 25 October."},
	}
	for _, tc := range cases {
		if got := glossaryReply(tc.in); got != tc.want {
			t.Errorf("glossaryReply(%q)\n got %q\nwant %q", tc.in, got, tc.want)
		}
	}
}

func TestModelSnapshotFormatsAmounts(t *testing.T) {
	in := `{"schema":"finance_assistant_tool_v4","currencies":{
		"MYR":{"rolling30":{"current":{"expenseTotal":1116.2,"net":-45.9,"transactionCount":41},"deltas":{"expensePctVsPrior":13.8}},
			"budgetCoach":{"categories":[{"categoryName":"Food & Dining","budgetAmount":600,"remaining":187.7,"pctOfBudget":68.7}]},
			"facts":{"forecast":{"status":"ready","daysLeft":11,"endBalance":{"low":-250.6,"likely":1200.99,"high":12345.5}}}},
		"SGD":{"facts":{"balances":{"liquid":421.6,"changeLast30Days":-78.4,"walletCount":1}}}}}`
	want := `{"currencies":{` +
		`"MYR":{"budgetCoach":{"categories":[{"budgetAmount":"RM600","categoryName":"Food & Dining","pctOfBudget":68.7,"remaining":"RM187"}]},` +
		`"facts":{"forecast":{"daysLeft":11,"endBalance":{"high":"RM12,345","likely":"RM1,200","low":"−RM250"},"status":"ready"}},` +
		`"rolling30":{"current":{"expenseTotal":"RM1,116.20","net":"−RM45.90","transactionCount":41},"deltas":{"expensePctVsPrior":13.8}}},` +
		`"SGD":{"facts":{"balances":{"changeLast30Days":"−SGD 78.40","liquid":"SGD 421.60","walletCount":1}}}},` +
		`"schema":"finance_assistant_tool_v4"}`
	if got := string(modelSnapshot(json.RawMessage(in))); got != want {
		t.Fatalf("modelSnapshot\n got %s\nwant %s", got, want)
	}
}

func TestModelSnapshotPassesOtherShapesThrough(t *testing.T) {
	for _, in := range []string{`{}`, `{"schema":"finance_assistant_tool_v4"}`, `{"currencies":[1,2]}`, `{"currencies":{"MYR":1}}`, `not-json`} {
		if got := string(modelSnapshot(json.RawMessage(in))); got != in {
			t.Errorf("modelSnapshot(%s) = %s", in, got)
		}
	}
}

// Every number in the golden snapshot is either money in moneyKeys or one of these, so a field
// added to the snapshot fails here until someone decides how the model should read it.
var notMoneyKeys = map[string]bool{
	"balanceConfirmedDaysAgo": true, "categoryConcentration": true, "confidence": true,
	"count": true, "coveragePct": true, "dailyPaceVsPreviousMonthPct": true, "dayOfMonthNow": true,
	"daysInCurrentMonth": true, "daysLeft": true, "diningOutSharePct": true,
	"expensePctVsPrior": true, "expenseTransactionCount": true, "historyDays": true,
	"incomePctVsPrior": true, "occurrences": true, "pctOfBudget": true, "periodDays": true,
	"savingsMargin": true, "sharePct": true, "transactionCount": true, "txCount": true,
	"walletCount": true,
}

func TestEveryGoldenSnapshotNumberIsClassified(t *testing.T) {
	raw, err := os.ReadFile("../../../../packages/types/fixtures/ai/chat-analyze-request.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture map[string]any
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	var walk func(node any, key string)
	walk = func(node any, key string) {
		switch v := node.(type) {
		case map[string]any:
			for k, child := range v {
				walk(child, k)
			}
		case []any:
			for _, child := range v {
				walk(child, key)
			}
		case float64:
			if _, money := moneyKeys[key]; !money && !notMoneyKeys[key] {
				t.Errorf("snapshot number %q is neither money nor listed as not money", key)
			}
		}
	}
	walk(fixture["snapshot"], "")
}

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
