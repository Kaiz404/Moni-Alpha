package extract

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/kaiz404/moni/backend/internal/groq"
)

// ResolveWallet implements the priority ladder from the original on-device
// pipeline: deterministic matching first, LLM only as the last step.
//
//  1. Only one wallet -> auto-select
//  2. Effective hint = merge(walletHint, user context / notification text)
//  3. Whole-word wallet name match inside effective hint
//  4. Substring match
//  5. Heuristic token overlap
//  6. LLM JSON {action, walletId, reason}
//  7. nil (user picks in the review modal)
func ResolveWallet(
	ctx context.Context,
	client *groq.Client,
	wallets []WalletContext,
	walletHint *string,
	extraContext string,
) *string {
	if len(wallets) == 0 {
		return nil
	}
	if len(wallets) == 1 {
		return &wallets[0].ID
	}

	hint := strings.TrimSpace(strings.ToLower(joinHint(walletHint, extraContext)))
	if hint != "" {
		// Whole-word match on wallet name.
		for i := range wallets {
			name := strings.ToLower(strings.TrimSpace(wallets[i].Name))
			if name == "" {
				continue
			}
			if regexp.MustCompile(`(^|\W)` + regexp.QuoteMeta(name) + `($|\W)`).MatchString(hint) {
				return &wallets[i].ID
			}
		}
		// Substring match.
		for i := range wallets {
			name := strings.ToLower(strings.TrimSpace(wallets[i].Name))
			if name != "" && strings.Contains(hint, name) {
				return &wallets[i].ID
			}
		}
		// Token overlap: any wallet-name token (len >= 3) present in hint.
		hintTokens := tokenSet(hint)
		bestID, bestScore := "", 0
		for i := range wallets {
			score := 0
			for token := range tokenSet(strings.ToLower(wallets[i].Name)) {
				if len(token) >= 3 && hintTokens[token] {
					score++
				}
			}
			if score > bestScore {
				bestScore, bestID = score, wallets[i].ID
			}
		}
		if bestScore > 0 {
			return &bestID
		}
	}

	// LLM as last resort; failure means unresolved, never an error.
	if id := resolveWalletLLM(ctx, client, wallets, hint); id != nil {
		return id
	}
	return nil
}

func joinHint(walletHint *string, extra string) string {
	parts := []string{}
	if walletHint != nil && strings.TrimSpace(*walletHint) != "" {
		parts = append(parts, *walletHint)
	}
	if strings.TrimSpace(extra) != "" {
		parts = append(parts, extra)
	}
	return strings.Join(parts, " ")
}

func tokenSet(s string) map[string]bool {
	out := map[string]bool{}
	for _, t := range regexp.MustCompile(`[a-z0-9]+`).FindAllString(s, -1) {
		out[t] = true
	}
	return out
}

func resolveWalletLLM(
	ctx context.Context,
	client *groq.Client,
	wallets []WalletContext,
	hint string,
) *string {
	if client == nil || hint == "" {
		return nil
	}

	list := make([]string, 0, len(wallets))
	valid := map[string]bool{}
	for _, w := range wallets {
		t := ""
		if w.Type != nil {
			t = *w.Type
		}
		list = append(list, fmt.Sprintf(`{"id": %q, "name": %q, "type": %q}`, w.ID, w.Name, t))
		valid[w.ID] = true
	}

	user := fmt.Sprintf("Available wallets:\n[%s]\n\nTransaction hint/context:\n%s",
		strings.Join(list, ",\n"), hint)

	var out struct {
		Action   string  `json:"action"`
		WalletID *string `json:"walletId"`
		Reason   string  `json:"reason"`
	}
	err := client.CompleteJSON(ctx,
		[]groq.Message{
			{Role: "system", Content: walletResolutionPrompt},
			{Role: "user", Content: user},
		},
		groq.Options{Model: groq.ModelTextFast, Temperature: 0, MaxTokens: 256},
		&out,
	)
	if err != nil {
		return nil
	}
	if out.Action == "create" && out.WalletID != nil && valid[*out.WalletID] {
		return out.WalletID
	}
	return nil
}

// resolveCtx bounds the wallet-resolution LLM step so it can't stall a
// live request.
func resolveCtx(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, 8*time.Second)
}
