package extract

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kaiz404/moni/backend/internal/llm"
)

func TestFinalizeTransferResolvesBothWallets(t *testing.T) {
	s := NewService(nil)
	ws := []WalletContext{
		{ID: "w1", Name: "Maybank"},
		{ID: "w2", Name: "Savings"},
	}
	amount := 500.0
	conf := 0.9
	out := llmExtraction{
		Amount:               &amount,
		Type:                 "transfer",
		Currency:             "MYR",
		WalletHint:           strPtr("Maybank"),
		TransferToWalletHint: strPtr("Savings"),
		Confidence:           &conf,
		Reasoning:            "User moved money between own accounts",
	}

	got := s.finalize(out, ws, "transfer 500 from Maybank to savings", 0.85, nil, currencyFromWallet, false)

	if got.Type != "transfer" {
		t.Fatalf("type = %q, want transfer", got.Type)
	}
	if got.WalletID == nil || *got.WalletID != "w1" {
		t.Fatalf("walletId = %v, want w1", got.WalletID)
	}
	if got.TransferToWalletID == nil || *got.TransferToWalletID != "w2" {
		t.Fatalf("transferToWalletId = %v, want w2", got.TransferToWalletID)
	}
	if got.Merchant != nil {
		t.Fatalf("merchant should be nil for transfer, got %v", got.Merchant)
	}
}

func TestFinalizeDepositCashToBank(t *testing.T) {
	s := NewService(nil)
	cashType := "cash"
	bankType := "bank"
	ws := []WalletContext{
		{ID: "w-cash", Name: "Cash", Type: &cashType},
		{ID: "w-bank", Name: "Maybank", Type: &bankType},
	}
	amount := 100.0
	out := llmExtraction{
		Amount:             &amount,
		Type:               "transfer",
		Currency:           "MYR",
		WalletID:           strPtr("w-cash"),
		TransferToWalletID: strPtr("w-bank"),
		Description:        strPtr("Deposited cash to bank"),
		Reasoning:          "User deposited own cash into their bank — transfer from Cash to Maybank",
	}

	got := s.finalize(out, ws, "Deposited 100 cash to bank", 0.85, nil, currencyFromWallet, false)

	if got.Type != "transfer" {
		t.Fatalf("type = %q, want transfer", got.Type)
	}
	if got.WalletID == nil || *got.WalletID != "w-cash" {
		t.Fatalf("walletId = %v, want w-cash", got.WalletID)
	}
	if got.TransferToWalletID == nil || *got.TransferToWalletID != "w-bank" {
		t.Fatalf("transferToWalletId = %v, want w-bank", got.TransferToWalletID)
	}
}

func TestFinalizeDepositResolvesWalletsFromHints(t *testing.T) {
	s := NewService(nil)
	cashType := "cash"
	bankType := "bank"
	ws := []WalletContext{
		{ID: "w-cash", Name: "Cash", Type: &cashType},
		{ID: "w-bank", Name: "Maybank", Type: &bankType},
	}
	amount := 100.0
	out := llmExtraction{
		Amount:               &amount,
		Type:                 "transfer",
		Currency:             "MYR",
		WalletHint:           strPtr("cash"),
		TransferToWalletHint: strPtr("bank"),
		Reasoning:            "Deposit cash to bank",
	}

	got := s.finalize(out, ws, "Deposited 100 cash to bank", 0.85, nil, currencyFromWallet, false)

	if got.Type != "transfer" {
		t.Fatalf("type = %q, want transfer", got.Type)
	}
	if got.WalletID == nil || *got.WalletID != "w-cash" {
		t.Fatalf("walletId = %v, want w-cash from hint", got.WalletID)
	}
	if got.TransferToWalletID == nil || *got.TransferToWalletID != "w-bank" {
		t.Fatalf("transferToWalletId = %v, want w-bank from hint", got.TransferToWalletID)
	}
}

func TestFinalizeUsesLLMWalletIDs(t *testing.T) {
	s := NewService(nil)
	ws := []WalletContext{
		{ID: "w1", Name: "Maybank"},
		{ID: "w2", Name: "Cash"},
	}
	amount := 42.0
	out := llmExtraction{
		Amount:     &amount,
		Type:       "expense",
		Currency:   "MYR",
		WalletID:   strPtr("w2"),
		WalletHint: strPtr("ignored when id is valid"),
	}

	got := s.finalize(out, ws, "", 0.85, nil, currencyFromWallet, false)
	if got.WalletID == nil || *got.WalletID != "w2" {
		t.Fatalf("walletId = %v, want w2 from model", got.WalletID)
	}
}

func TestFinalizeTransferClearsSameWalletDestination(t *testing.T) {
	s := NewService(nil)
	ws := []WalletContext{{ID: "w1", Name: "Cash"}}
	amount := 100.0
	out := llmExtraction{
		Amount:               &amount,
		Type:                 "transfer",
		WalletHint:           strPtr("Cash"),
		TransferToWalletHint: strPtr("Cash"),
	}

	got := s.finalize(out, ws, "", 0.8, nil, currencyFromWallet, false)

	if got.TransferToWalletID != nil {
		t.Fatalf("expected nil destination when source equals dest, got %v", got.TransferToWalletID)
	}
}

func TestFinalizeCurrencyFromWallet(t *testing.T) {
	s := NewService(nil)
	usd := "USD"
	ws := []WalletContext{
		{ID: "w-usd", Name: "Spending", Currency: &usd},
	}
	amount := 10.40
	out := llmExtraction{
		Amount:   &amount,
		Type:     "expense",
		Currency: "MYR",
		WalletID: strPtr("w-usd"),
	}

	got := s.finalize(out, ws, "spent 10.40 on ice cream", 0.85, nil, currencyFromWallet, false)
	if got.Currency != "USD" {
		t.Fatalf("currency = %q, want USD from wallet", got.Currency)
	}
}

func TestFinalizeReceiptSkipsWalletInference(t *testing.T) {
	s := NewService(nil)
	myr := "MYR"
	ws := []WalletContext{
		{ID: "w-cash", Name: "Cash", Currency: &myr},
	}
	amount := 42.0
	out := llmExtraction{
		Amount:     &amount,
		Type:       "expense",
		WalletID:   strPtr("w-cash"),
		WalletHint: strPtr("Cash"),
	}

	got := s.finalize(out, ws, "", 0.8, nil, currencyFromWallet, true)
	if got.WalletID != nil {
		t.Fatalf("walletId = %v, want nil for receipt finalize", got.WalletID)
	}
	if got.Currency != "USD" {
		t.Fatalf("currency = %q, want USD fallback when wallet unset", got.Currency)
	}
}

func TestTruncatedOutputSkipsTheBadJSONRetry(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		json.NewEncoder(w).Encode(map[string]any{"choices": []any{
			map[string]any{"message": map[string]any{"content": `{"amount":`}, "finish_reason": "length"},
		}})
	}))
	defer srv.Close()
	s := NewService(llm.NewClient("test-key", srv.URL))

	if got := s.FromText(context.Background(), TextRequest{Text: "lunch 12"}); got.Status != "unavailable" || calls != 2 {
		t.Fatalf("text: status %q after %d calls, want unavailable after 2", got.Status, calls)
	}
	calls = 0
	note := NotificationRequest{Notification: RawNotification{Text: "You paid RM12 to Mamak"}}
	if got := s.FromNotification(context.Background(), note); got.Status != "unavailable" || calls != 2 {
		t.Fatalf("notification: status %q after %d calls, want unavailable after 2", got.Status, calls)
	}
}

func fakeModel(t *testing.T, content string) *Service {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"choices": []any{
			map[string]any{"message": map[string]any{"content": content}},
		}})
	}))
	t.Cleanup(srv.Close)
	return NewService(llm.NewClient("test-key", srv.URL))
}

func readReceipt(t *testing.T, content string) Result {
	t.Helper()
	return fakeModel(t, content).FromImage(context.Background(), ImageRequest{ImageBase64: "abc"})
}

func TestReceiptItemCount(t *testing.T) {
	six, most := 6, 200
	cases := []struct {
		name  string
		field string
		want  *int
	}{
		{"whole number", `,"item_count":6`, &six},
		{"whole number written as a float", `,"item_count":6.0`, &six},
		{"at the bound", `,"item_count":200`, &most},
		{"key left out", ``, nil},
		{"null", `,"item_count":null`, nil},
		{"zero", `,"item_count":0`, nil},
		{"negative", `,"item_count":-3`, nil},
		{"fraction", `,"item_count":6.5`, nil},
		{"past the bound", `,"item_count":201`, nil},
		{"past float64", `,"item_count":1e999`, nil},
		{"digits in a string", `,"item_count":"6"`, nil},
		{"words", `,"item_count":"six items"`, nil},
		{"bool", `,"item_count":true`, nil},
		{"array", `,"item_count":[1,2]`, nil},
		{"object", `,"item_count":{"n":6}`, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := readReceipt(t, `{"amount":18.6,"merchant":"99 Speedmart"`+c.field+`}`)
			if got.Status != "ok" {
				t.Fatalf("status = %q (%s), want ok", got.Status, got.Reason)
			}
			if got.Extraction.Amount != 18.6 || *got.Extraction.Merchant != "99 Speedmart" {
				t.Fatalf("receipt fields lost: %+v", got.Extraction)
			}
			switch {
			case c.want == nil && got.Extraction.ItemCount != nil:
				t.Fatalf("itemCount = %d, want none", *got.Extraction.ItemCount)
			case c.want != nil && got.Extraction.ItemCount == nil:
				t.Fatalf("itemCount missing, want %d", *c.want)
			case c.want != nil && *got.Extraction.ItemCount != *c.want:
				t.Fatalf("itemCount = %d, want %d", *got.Extraction.ItemCount, *c.want)
			}
		})
	}
}

func TestItemCountStaysOffTheWireWithoutACount(t *testing.T) {
	without, err := json.Marshal(readReceipt(t, `{"amount":18.6,"item_count":"lots"}`))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(without), "itemCount") {
		t.Fatalf("wire has itemCount with no count: %s", without)
	}
	with, err := json.Marshal(readReceipt(t, `{"amount":18.6,"item_count":6}`))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(with), `"itemCount":6`) {
		t.Fatalf("wire lacks itemCount: %s", with)
	}
}

func TestOnlyReceiptsCarryAnItemCount(t *testing.T) {
	s := fakeModel(t, `{"amount":12,"item_count":6}`)
	got := s.FromText(context.Background(), TextRequest{Text: "lunch 12"})
	if got.Status != "ok" || got.Extraction.ItemCount != nil {
		t.Fatalf("text: status %q, extraction %+v, want ok and no count", got.Status, got.Extraction)
	}
}
