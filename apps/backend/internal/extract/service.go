package extract

import (
	"context"
	"strings"
	"time"

	"github.com/kaiz404/moni/backend/internal/groq"
)

type Service struct {
	groq *groq.Client
}

func NewService(client *groq.Client) *Service {
	return &Service{groq: client}
}

const defaultCurrency = "MYR"

func walletPreamble(wallets []WalletContext) string {
	return FormatWalletsForPrompt(wallets) + "\n\n"
}

// FromText extracts a transaction from free-form user text.
// Live UX flow: fast model, quality fallback, no long 429 waits.
func (s *Service) FromText(ctx context.Context, req TextRequest) Result {
	messages := []groq.Message{
		{Role: "system", Content: textExtractionPrompt},
		{Role: "user", Content: walletPreamble(req.Wallets) + req.Text},
	}

	var out llmExtraction
	err := s.groq.CompleteJSON(ctx, messages,
		groq.Options{Model: groq.ModelTextFast, Temperature: 0.2, MaxTokens: 512, MaxRetryWait: 3 * time.Second},
		&out,
	)
	if err != nil {
		// One fallback attempt on the quality model.
		err = s.groq.CompleteJSON(ctx, messages,
			groq.Options{Model: groq.ModelTextQuality, Temperature: 0.2, MaxTokens: 512},
			&out,
		)
	}
	if err != nil {
		return Unavailable("Text extraction failed: " + err.Error())
	}
	if out.Amount == nil || *out.Amount <= 0 {
		return Skipped("No transaction amount found in text")
	}

	return OK(s.finalize(out, req.Wallets, req.Text, 0.85, nil))
}

// FromImage extracts a transaction from a receipt image. Accepts a public
// URL (preferred) or base64 payload.
func (s *Service) FromImage(ctx context.Context, req ImageRequest) Result {
	imageURL := strings.TrimSpace(req.ImageURL)
	if imageURL == "" && req.ImageBase64 != "" {
		b64 := req.ImageBase64
		if !strings.HasPrefix(b64, "data:") {
			b64 = "data:image/jpeg;base64," + b64
		}
		imageURL = b64
	}
	if imageURL == "" {
		return Skipped("No image data provided — upload the receipt or include base64")
	}

	userText := walletPreamble(req.Wallets) + "Extract the transaction from this receipt."
	if strings.TrimSpace(req.UserContext) != "" {
		userText += "\nUser message: " + req.UserContext
	}

	messages := []groq.Message{
		{Role: "system", Content: receiptExtractionPrompt},
		{Role: "user", Content: []groq.ContentPart{
			{Type: "text", Text: userText},
			{Type: "image_url", ImageURL: &groq.ImageURL{URL: imageURL}},
		}},
	}

	var out llmExtraction
	err := s.groq.CompleteJSON(ctx, messages,
		groq.Options{Model: groq.ModelVision, Temperature: 0.2, MaxTokens: 1024, MaxRetryWait: 5 * time.Second},
		&out,
	)
	if err != nil {
		return Unavailable("Receipt extraction failed: " + err.Error())
	}
	if out.Amount == nil || *out.Amount <= 0 {
		return Skipped("Could not read a payable amount from the receipt")
	}

	return OK(s.finalize(out, req.Wallets, req.UserContext, 0.8, nil))
}

// FromNotification classifies and extracts a transaction from an Android
// notification. Not latency-sensitive: allows longer 429 waits.
func (s *Service) FromNotification(ctx context.Context, req NotificationRequest) Result {
	combined := req.Notification.CombinedText()
	if strings.TrimSpace(combined) == "" {
		return Skipped("Empty notification")
	}

	user := walletPreamble(req.Wallets) + "App: " + req.Notification.PackageNameForRouting() + "\nNotification: " + combined

	var out llmNotificationResult
	err := s.groq.CompleteJSON(ctx,
		[]groq.Message{
			{Role: "system", Content: notificationDetectionPrompt},
			{Role: "user", Content: user},
		},
		groq.Options{Model: groq.ModelTextFast, Temperature: 0, MaxTokens: 512, MaxRetryWait: 30 * time.Second},
		&out,
	)
	if err != nil {
		return Unavailable("Notification analysis failed: " + err.Error())
	}
	if !out.IsTransaction {
		reason := out.Reasoning
		if reason == "" {
			reason = "Not a financial transaction"
		}
		return Skipped(reason)
	}
	if out.Amount == nil || *out.Amount <= 0 {
		return Skipped("Notification classified as transaction but no amount extracted")
	}

	ex := llmExtraction{
		Amount:       out.Amount,
		Type:         out.Type,
		Currency:     out.Currency,
		Merchant:     out.Merchant,
		Description:  out.Description,
		WalletID:     out.WalletID,
		WalletHint:   out.WalletHint,
		CategoryHint: out.CategoryHint,
		Confidence:   out.Confidence,
		Reasoning:    out.Reasoning,
	}
	extraCtx := req.Notification.PackageNameForRouting() + " " + combined
	return OK(s.finalize(ex, req.Wallets, extraCtx, 0.7, req.LockedWalletID))
}

// finalize normalizes LLM output and resolves the wallet.
func (s *Service) finalize(
	out llmExtraction,
	wallets []WalletContext,
	extraContext string,
	defaultConfidence float64,
	lockedWalletID *string,
) Extraction {
	txType := strings.ToLower(strings.TrimSpace(out.Type))
	if txType != "income" && txType != "expense" && txType != "transfer" {
		txType = "expense"
	}

	currency := strings.ToUpper(strings.TrimSpace(out.Currency))
	if len(currency) != 3 {
		currency = defaultCurrency
	}

	confidence := defaultConfidence
	if out.Confidence != nil && *out.Confidence > 0 && *out.Confidence <= 1 {
		confidence = *out.Confidence
	}

	reasoning := strings.TrimSpace(out.Reasoning)
	if reasoning == "" {
		reasoning = "Extracted by Moni AI backend"
	}

	walletID := ResolveWalletWithLock(wallets, lockedWalletID, out.WalletID, out.WalletHint, extraContext)

	var transferToWalletID *string
	transferHint := emptyToNil(out.TransferToWalletHint)
	if txType == "transfer" {
		transferToWalletID = ResolveWallet(wallets, out.TransferToWalletID, transferHint, "")
		if walletID != nil && transferToWalletID != nil && *walletID == *transferToWalletID {
			transferToWalletID = nil
		}
	}

	merchant := emptyToNil(out.Merchant)
	categoryHint := emptyToNil(out.CategoryHint)
	if txType == "transfer" {
		merchant = nil
		categoryHint = nil
	}

	return Extraction{
		Amount:               *out.Amount,
		Type:                 txType,
		Currency:             currency,
		Merchant:             merchant,
		Description:          emptyToNil(out.Description),
		WalletHint:           emptyToNil(out.WalletHint),
		CategoryHint:         categoryHint,
		WalletID:             walletID,
		TransferToWalletHint: transferHint,
		TransferToWalletID:   transferToWalletID,
		Confidence:           confidence,
		Reasoning:            reasoning,
	}
}

func emptyToNil(s *string) *string {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil
	}
	return s
}
