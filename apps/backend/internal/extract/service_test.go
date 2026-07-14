package extract

import (
	"testing"
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
