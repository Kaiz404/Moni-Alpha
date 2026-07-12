package extract

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// FormatWalletsForPrompt serializes the client's wallet list for injection
// into extraction prompts as AVAILABLE_WALLETS.
func FormatWalletsForPrompt(wallets []WalletContext) string {
	if len(wallets) == 0 {
		return "AVAILABLE_WALLETS: []"
	}
	type entry struct {
		ID          string  `json:"id"`
		Name        string  `json:"name"`
		Type        *string `json:"type,omitempty"`
		Currency    *string `json:"currency,omitempty"`
		AccountHint *string `json:"accountHint,omitempty"`
	}
	list := make([]entry, len(wallets))
	for i, w := range wallets {
		list[i] = entry{ID: w.ID, Name: w.Name, Type: w.Type, Currency: w.Currency, AccountHint: w.AccountHint}
	}
	b, err := json.Marshal(list)
	if err != nil {
		return "AVAILABLE_WALLETS: []"
	}
	return fmt.Sprintf("AVAILABLE_WALLETS: %s", string(b))
}

// ResolveWallet picks a wallet id from the extraction model output and
// client-provided list. The model's wallet_id is preferred when valid;
// deterministic hint matching is the fallback when the model is unsure.
//
//  0. Locked wallet id from client (single wallet linked to notification app)
//  1. Only one wallet -> auto-select
//  2. Valid wallet_id from the model (must be in the provided list)
//  3. Effective hint = merge(walletHint, user context / notification text)
//  4. Account-hint token match against notification body
//  5. Whole-word wallet name match inside effective hint
//  6. Substring match (hint contains wallet name)
//  7. Reverse substring (wallet name contains hint, e.g. "bank" -> "Maybank")
//  8. Wallet type matches wallet_hint (e.g. hint "bank" -> type "bank")
//  9. Heuristic token overlap
//  10. nil (user picks in the review modal)
func ResolveWallet(
	wallets []WalletContext,
	llmWalletID *string,
	walletHint *string,
	extraContext string,
) *string {
	if len(wallets) == 0 {
		return nil
	}
	if len(wallets) == 1 {
		return &wallets[0].ID
	}

	if id := validateWalletID(wallets, llmWalletID); id != nil {
		return id
	}

	hint := strings.TrimSpace(strings.ToLower(joinHint(walletHint, extraContext)))
	if hint != "" {
		// Account-hint match: user-configured disambiguator for same-app wallets.
		for i := range wallets {
			ah := strings.TrimSpace(strings.ToLower(derefString(wallets[i].AccountHint)))
			if len(ah) >= 2 && strings.Contains(hint, ah) {
				return &wallets[i].ID
			}
		}
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
		// Substring match: hint contains wallet name.
		for i := range wallets {
			name := strings.ToLower(strings.TrimSpace(wallets[i].Name))
			if name != "" && strings.Contains(hint, name) {
				return &wallets[i].ID
			}
		}
		// Reverse substring + type match use wallet_hint alone when set (avoids
		// noisy matches from full user sentences like "deposited cash to bank").
		shortHint := hintForShortMatch(walletHint, hint)
		if shortHint != "" {
			for i := range wallets {
				name := strings.ToLower(strings.TrimSpace(wallets[i].Name))
				if len(shortHint) >= 3 && name != "" && strings.Contains(name, shortHint) {
					return &wallets[i].ID
				}
			}
			for i := range wallets {
				if wallets[i].Type == nil {
					continue
				}
				if strings.EqualFold(strings.TrimSpace(*wallets[i].Type), shortHint) {
					return &wallets[i].ID
				}
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

	return nil
}

// ResolveWalletWithLock applies an optional client-locked wallet before the ladder.
func ResolveWalletWithLock(
	wallets []WalletContext,
	lockedWalletID *string,
	llmWalletID *string,
	walletHint *string,
	extraContext string,
) *string {
	if id := validateWalletID(wallets, lockedWalletID); id != nil {
		return id
	}
	return ResolveWallet(wallets, llmWalletID, walletHint, extraContext)
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func validateWalletID(wallets []WalletContext, id *string) *string {
	if id == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*id)
	if trimmed == "" {
		return nil
	}
	for i := range wallets {
		if wallets[i].ID == trimmed {
			return &wallets[i].ID
		}
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

// hintForShortMatch prefers the model's wallet_hint for generic labels
// ("bank", "cash") that should match wallet names/types, not the full sentence.
func hintForShortMatch(walletHint *string, mergedHint string) string {
	if walletHint != nil {
		if t := strings.TrimSpace(strings.ToLower(*walletHint)); t != "" {
			return t
		}
	}
	return mergedHint
}

func tokenSet(s string) map[string]bool {
	out := map[string]bool{}
	for _, t := range regexp.MustCompile(`[a-z0-9]+`).FindAllString(s, -1) {
		out[t] = true
	}
	return out
}
