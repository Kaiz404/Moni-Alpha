import { z } from 'zod';

// ─── System Prompts ──────────────────────────────────────────────────────────

export const TRANSACTION_EXTRACTION_PROMPT = `You are TransactionExtractionAgent for a personal finance app.

You receive user input describing a financial transaction. Extract the following fields:

Required:
- amount: a positive number (the transaction amount)

Best-effort (infer if possible, null if not):
- type: "income" or "expense" (default to "expense" if unclear)
- currency: 3-letter ISO code (default "MYR" if unclear)
- merchant: business/person/app name
- description: short summary of what the transaction is
- wallet_hint: any mention of which account/wallet/card was used
- category_hint: spending category (e.g. "food", "transport", "entertainment")

Rules:
1. Return ONLY valid JSON matching the schema.
2. If the user says "spent", "paid", "bought" → type is "expense".
3. If the user says "received", "earned", "got paid" → type is "income".
4. Extract the exact numerical amount. If multiple amounts exist, pick the most likely transaction amount.
5. If you truly cannot determine an amount, set amount to null.
`;

export const RECEIPT_EXTRACTION_PROMPT = `You are ReceiptExtractionAgent for a personal finance app.

You receive an image of a receipt or financial document. Analyze the image and extract:

Required:
- amount: the total/final amount (positive number)

Best-effort (infer if possible, null if not):
- type: "income" or "expense" (receipts are usually "expense")
- currency: 3-letter ISO code
- merchant: the store/business name from the receipt
- description: brief summary of the purchase
- wallet_hint: payment method if visible (e.g. "Visa ending 4242")
- category_hint: spending category

Rules:
1. Return ONLY valid JSON matching the schema.
2. Look for the total/grand total line — that is the amount.
3. The merchant name is usually at the top of the receipt.
4. Default type to "expense" for receipts.
`;

export const WALLET_RESOLUTION_PROMPT = `You are WalletResolutionAgent.

Goal: Match a transaction to one of the user's wallets.

Rules:
1) Review the available wallets provided in the prompt.
2) Compare the wallet_hint/source with wallet names.
3) Return JSON with fields: action, walletId, reason.
4) action must be "create" (confident match) or "skip" (no match).
5) If there is only one wallet, use that wallet.
6) Never invent walletId values — only use IDs from the provided wallet list.
`;

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const extractionResultSchema = z.object({
  amount: z.number().positive().nullable(),
  type: z.enum(['income', 'expense']).nullable().optional(),
  currency: z.string().nullable().optional(),
  merchant: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  wallet_hint: z.string().nullable().optional(),
  category_hint: z.string().nullable().optional(),
});

export const walletDecisionSchema = z.object({
  action: z.enum(['create', 'skip']),
  walletId: z.string().nullable().optional(),
  reason: z.string(),
});
