package extract

import (
	"context"
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

// nil groq client: the LLM rung must be skipped, deterministic rungs only.
func TestResolveWalletSingleWalletAutoSelect(t *testing.T) {
	got := ResolveWallet(context.Background(), nil, wallets("Maybank"), nil, "")
	if got == nil || *got != "id-Maybank" {
		t.Fatalf("expected auto-select of single wallet, got %v", got)
	}
}

func TestResolveWalletWholeWordMatch(t *testing.T) {
	ws := wallets("Maybank", "TNG eWallet", "Cash")
	got := ResolveWallet(context.Background(), nil, ws, strPtr("paid with cash at the market"), "")
	if got == nil || *got != "id-Cash" {
		t.Fatalf("expected Cash wallet, got %v", got)
	}
}

func TestResolveWalletSubstringMatch(t *testing.T) {
	ws := wallets("Maybank", "CIMB")
	got := ResolveWallet(context.Background(), nil, ws, strPtr("maybank2u transfer"), "")
	if got == nil || *got != "id-Maybank" {
		t.Fatalf("expected Maybank via substring, got %v", got)
	}
}

func TestResolveWalletTokenOverlap(t *testing.T) {
	ws := wallets("TNG eWallet", "Maybank Savings")
	got := ResolveWallet(context.Background(), nil, ws, nil, "Touch n Go eWallet payment received")
	if got == nil || *got != "id-TNG eWallet" {
		t.Fatalf("expected TNG eWallet via token overlap, got %v", got)
	}
}

func TestResolveWalletNoMatchReturnsNil(t *testing.T) {
	ws := wallets("Maybank", "CIMB")
	got := ResolveWallet(context.Background(), nil, ws, strPtr("some unknown source"), "")
	if got != nil {
		t.Fatalf("expected nil for no match, got %v", *got)
	}
}

func TestResolveWalletEmptyList(t *testing.T) {
	if got := ResolveWallet(context.Background(), nil, nil, strPtr("cash"), ""); got != nil {
		t.Fatalf("expected nil for empty wallet list, got %v", *got)
	}
}
