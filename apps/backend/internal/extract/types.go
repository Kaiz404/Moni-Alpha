// Package extract implements transaction extraction from text, receipt
// images, and Android notifications. Contract mirrors the mobile client
// (apps/mobile/lib/ai/client/types.ts).
package extract

// WalletContext is the user's wallet list sent with every request so the
// backend can resolve which wallet a transaction belongs to.
type WalletContext struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Type     *string `json:"type,omitempty"`
	Currency *string `json:"currency,omitempty"`
}

// Extraction is a normalized transaction candidate.
type Extraction struct {
	Amount               float64  `json:"amount"`
	Type                 string   `json:"type"` // "income" | "expense" | "transfer"
	Currency             string   `json:"currency"`
	Merchant             *string  `json:"merchant"`
	Description          *string  `json:"description"`
	WalletHint           *string  `json:"walletHint"`
	CategoryHint         *string  `json:"categoryHint"`
	WalletID             *string  `json:"walletId"`
	TransferToWalletHint *string  `json:"transferToWalletHint"`
	TransferToWalletID   *string  `json:"transferToWalletId"`
	Confidence           float64  `json:"confidence"`
	Reasoning            string   `json:"reasoning"`
}

// Result is the discriminated union the mobile client consumes.
type Result struct {
	Status     string      `json:"status"` // "ok" | "skipped" | "unavailable"
	Extraction *Extraction `json:"extraction,omitempty"`
	Reason     string      `json:"reason,omitempty"`
}

func OK(e Extraction) Result       { return Result{Status: "ok", Extraction: &e} }
func Skipped(reason string) Result { return Result{Status: "skipped", Reason: reason} }
func Unavailable(reason string) Result {
	return Result{Status: "unavailable", Reason: reason}
}

type TextRequest struct {
	Text    string          `json:"text" binding:"required"`
	Wallets []WalletContext `json:"wallets"`
}

type ImageRequest struct {
	// ImageBase64 is a raw base64 JPEG/PNG (no data: prefix required).
	ImageBase64 string `json:"imageBase64"`
	// ImageURL is a publicly reachable URL (e.g. Supabase Storage).
	ImageURL string `json:"imageUrl"`
	// ImageURI is the mobile-local URI; kept for tracing only.
	ImageURI    string          `json:"imageUri"`
	UserContext string          `json:"userContext"`
	Wallets     []WalletContext `json:"wallets"`
}

// RawNotification mirrors the mobile RawNotification shape.
type RawNotification struct {
	ID            string `json:"id"`
	App           string `json:"app"`
	Title         string `json:"title"`
	TitleBig      string `json:"titleBig"`
	Text          string `json:"text"`
	BigText       string `json:"bigText"`
	SubText       string `json:"subText"`
	SummaryText   string `json:"summaryText"`
	ExtraInfoText string `json:"extraInfoText"`
	Time          string `json:"time"`
	ReceivedAt    string `json:"receivedAt"`
}

// CombinedText joins all textual fields for matching and prompting.
func (n RawNotification) CombinedText() string {
	parts := []string{n.Title, n.TitleBig, n.Text, n.BigText, n.SubText, n.SummaryText, n.ExtraInfoText}
	out := ""
	for _, p := range parts {
		if p == "" {
			continue
		}
		if out != "" {
			out += " "
		}
		out += p
	}
	return out
}

type NotificationRequest struct {
	Notification RawNotification `json:"notification" binding:"required"`
	Wallets      []WalletContext `json:"wallets"`
}

// llmExtraction matches the snake_case JSON the prompts ask for.
type llmExtraction struct {
	Amount               *float64 `json:"amount"`
	Type                 string   `json:"type"`
	Currency             string   `json:"currency"`
	Merchant             *string  `json:"merchant"`
	Description          *string  `json:"description"`
	WalletID             *string  `json:"wallet_id"`
	WalletHint           *string  `json:"wallet_hint"`
	TransferToWalletID   *string  `json:"transfer_to_wallet_id"`
	TransferToWalletHint *string  `json:"transfer_to_wallet_hint"`
	CategoryHint         *string  `json:"category_hint"`
	Confidence           *float64 `json:"confidence"`
	Reasoning            string   `json:"reasoning"`
}

// llmNotificationResult matches the notification detection schema.
type llmNotificationResult struct {
	IsTransaction bool     `json:"is_transaction"`
	Reasoning     string   `json:"reasoning"`
	Confidence    *float64 `json:"confidence"`
	Amount        *float64 `json:"amount"`
	Currency      string   `json:"currency"`
	Type          string   `json:"type"`
	Merchant      *string  `json:"merchant"`
	Description   *string  `json:"description"`
	WalletID      *string  `json:"wallet_id"`
	WalletHint    *string  `json:"wallet_hint"`
	CategoryHint  *string  `json:"category_hint"`
}
