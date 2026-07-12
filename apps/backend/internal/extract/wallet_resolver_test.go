package extract

import (
	"strings"
	"testing"
)

func wallets(names ...string) []WalletContext {
	out := make([]WalletContext, len(names))
	for i, n := range names {
		out[i] = WalletContext{ID: "id-" + n, Name: n}
	}
	return out
}

func strPtr(s string) *string { return &s }

func TestResolveWalletSingleWalletAutoSelect(t *testing.T) {
	got := ResolveWallet(wallets("Maybank"), nil, nil, "")
	if got == nil || *got != "id-Maybank" {
		t.Fatalf("expected auto-select of single wallet, got %v", got)
	}
}

func TestResolveWalletValidLLMID(t *testing.T) {
	ws := wallets("Maybank", "Cash")
	id := "id-Cash"
	got := ResolveWallet(ws, &id, nil, "")
	if got == nil || *got != "id-Cash" {
		t.Fatalf("expected Cash via LLM wallet_id, got %v", got)
	}
}

func TestResolveWalletInvalidLLMIDIgnored(t *testing.T) {
	ws := wallets("Maybank", "Cash")
	bad := "invented-id"
	got := ResolveWallet(ws, &bad, strPtr("paid with cash"), "")
	if got == nil || *got != "id-Cash" {
		t.Fatalf("expected Cash via hint fallback after invalid LLM id, got %v", got)
	}
}

func TestResolveWalletWholeWordMatch(t *testing.T) {
	ws := wallets("Maybank", "TNG eWallet", "Cash")
	got := ResolveWallet(ws, nil, strPtr("paid with cash at the market"), "")
	if got == nil || *got != "id-Cash" {
		t.Fatalf("expected Cash wallet, got %v", got)
	}
}

func TestResolveWalletSubstringMatch(t *testing.T) {
	ws := wallets("Maybank", "CIMB")
	got := ResolveWallet(ws, nil, strPtr("maybank2u transfer"), "")
	if got == nil || *got != "id-Maybank" {
		t.Fatalf("expected Maybank via substring, got %v", got)
	}
}

func TestResolveWalletTokenOverlap(t *testing.T) {
	ws := wallets("TNG eWallet", "Maybank Savings")
	got := ResolveWallet(ws, nil, nil, "Touch n Go eWallet payment received")
	if got == nil || *got != "id-TNG eWallet" {
		t.Fatalf("expected TNG eWallet via token overlap, got %v", got)
	}
}

func TestResolveWalletNoMatchReturnsNil(t *testing.T) {
	ws := wallets("Maybank", "CIMB")
	got := ResolveWallet(ws, nil, strPtr("some unknown source"), "")
	if got != nil {
		t.Fatalf("expected nil for no match, got %v", *got)
	}
}

func TestResolveWalletEmptyList(t *testing.T) {
	if got := ResolveWallet(nil, strPtr("id-Cash"), strPtr("cash"), ""); got != nil {
		t.Fatalf("expected nil for empty wallet list, got %v", *got)
	}
}

func TestResolveWalletNameContainsHint(t *testing.T) {
	ws := wallets("Maybank", "Cash")
	got := ResolveWallet(ws, nil, strPtr("bank"), "")
	if got == nil || *got != "id-Maybank" {
		t.Fatalf("expected Maybank when hint is bank, got %v", got)
	}
}

func TestResolveWalletTypeMatch(t *testing.T) {
	cashType := "cash"
	bankType := "bank"
	ws := []WalletContext{
		{ID: "w-cash", Name: "Petty Cash", Type: &cashType},
		{ID: "w-bank", Name: "Maybank", Type: &bankType},
	}
	got := ResolveWallet(ws, nil, strPtr("bank"), "")
	if got == nil || *got != "w-bank" {
		t.Fatalf("expected bank-type wallet, got %v", got)
	}
}

func TestResolveWalletDepositContextInfersCash(t *testing.T) {
	cashType := "cash"
	bankType := "bank"
	ws := []WalletContext{
		{ID: "w-cash", Name: "Cash", Type: &cashType},
		{ID: "w-bank", Name: "Maybank", Type: &bankType},
	}
	got := ResolveWallet(ws, nil, strPtr("cash"), "Deposited 100 cash to bank")
	if got == nil || *got != "w-cash" {
		t.Fatalf("expected Cash as source for deposit, got %v", got)
	}
}

func TestResolveWalletDepositDestinationBank(t *testing.T) {
	cashType := "cash"
	bankType := "bank"
	ws := []WalletContext{
		{ID: "w-cash", Name: "Cash", Type: &cashType},
		{ID: "w-bank", Name: "Maybank", Type: &bankType},
	}
	got := ResolveWallet(ws, nil, strPtr("bank"), "")
	if got == nil || *got != "w-bank" {
		t.Fatalf("expected Maybank as deposit destination, got %v", got)
	}
}

func TestFormatWalletsForPrompt(t *testing.T) {
	got := FormatWalletsForPrompt(wallets("Maybank", "Cash"))
	for _, want := range []string{"AVAILABLE_WALLETS:", "id-Maybank", "Maybank", "id-Cash"} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected %q in wallet preamble, got %q", want, got)
		}
	}
}
