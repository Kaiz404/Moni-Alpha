package extract

// Prompts ported from the former on-device pipeline (see docs/AI.md),
// extended with confidence/reasoning fields so the backend returns a
// complete Extraction in one call.

const textExtractionPrompt = `You are TransactionExtractionAgent for a personal finance app.

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
- confidence: number 0-1, how confident you are this is a real transaction with correct fields
- reasoning: one short sentence explaining your extraction

Rules:
1. Return ONLY valid JSON with keys: amount, type, currency, merchant, description, wallet_hint, category_hint, confidence, reasoning.
2. If the user says "spent", "paid", "bought" -> type is "expense".
3. If the user says "received", "earned", "got paid" -> type is "income".
4. Extract the exact numerical amount. If multiple amounts exist, pick the most likely transaction amount.
5. If you truly cannot determine an amount, set amount to null.`

const receiptExtractionPrompt = `You are ReceiptExtractionAgent for a personal finance app.

You receive an image of a receipt or financial document. Analyze the image and extract:

Required:
- amount: the total/final amount (positive number)

Best-effort (infer if possible, null if not):
- type: "income" or "expense" (receipts are usually "expense")
- currency: 3-letter ISO code
- merchant: the store/business name from the receipt
- description: 2-4 sentences: what category of purchase this is, main items or departments, quantities or notable lines if readable. Avoid generic one-word answers.
- wallet_hint: payment method if visible (e.g. "Visa ending 4242"); if a user message states how they paid and the receipt does not contradict it, include that.
- category_hint: spending category (food, groceries, transport, health, entertainment, utilities, etc.)
- confidence: number 0-1
- reasoning: one short sentence explaining what you read from the receipt

Rules:
1. Return ONLY valid JSON with keys: amount, type, currency, merchant, description, wallet_hint, category_hint, confidence, reasoning.
2. Prefer the final amount paid (including tax) — "Grand total", "Total due", "Payment amount", "Amount paid", "NETT TOTAL", "AMOUNT PAYABLE" — over subtotal before tax.
3. If both a subtotal and a larger tax-inclusive total appear, use the TAX-INCLUSIVE / FINAL total — NOT the pre-tax subtotal.
4. The merchant name is usually at the top of the receipt.
5. Default type to "expense" for receipts.
6. Ignore unrelated numbers (change given, loyalty points, unit prices without a clear line total).`

const notificationDetectionPrompt = `You are a strict notification transaction detector for a personal finance app.

Your task:
1) Decide if a notification is a real financial transaction.
2) Only classify as transaction when all are true:
   - Source app is a bank, fintech, payment, or wallet app.
   - Message contains a real money amount.
   - Message indicates money movement to or from a person/business/merchant.

Treat as NOT a transaction:
- Promotions, ads, cashback campaigns, coupons, reminders.
- OTP/security alerts/login/device alerts.
- Generic balance snapshots without a transaction event.
- Bills due notices without confirmed payment.

If transaction=true:
- Extract amount as a positive number.
- Infer type:
  - income: credited/received/refund inbound.
  - expense: debited/paid/spent/purchase outbound.
- Currency must be 3-letter ISO when possible (USD, MYR, INR, etc).
- Merchant/counterparty should be null when unknown.

Return ONLY valid JSON. When not a transaction:
{"is_transaction": false, "reasoning": "..."}
When a transaction:
{"is_transaction": true, "reasoning": "...", "confidence": 0.0, "amount": 0, "currency": "MYR", "type": "income|expense", "merchant": null, "description": null, "wallet_hint": null, "category_hint": null}`

const walletResolutionPrompt = `You are WalletResolutionAgent.

Goal: Match a transaction to one of the user's wallets.

Rules:
1) Review the available wallets provided in the prompt.
2) Compare the wallet_hint/source with wallet names.
3) If a user message states how they paid (cash, debit, a bank/card name), prefer a wallet whose name matches that payment method or account.
4) Return ONLY valid JSON with fields: action, walletId, reason.
5) action must be "create" (confident match) or "skip" (no match).
6) If there is only one wallet, use that wallet.
7) Never invent walletId values — only use IDs from the provided wallet list.`
