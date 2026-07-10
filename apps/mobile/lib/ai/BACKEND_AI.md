# Moni AI Backend Reference

> **Purpose:** Archive of the former on-device AI architecture (Qwen 2.5 VL via `@react-native-ai/llama` + Vercel AI SDK) and the prompts/orchestration logic to port into a **Go inference backend**.
>
> Mobile no longer runs local models. It calls `lib/ai/client` (currently a mock). Wire the real Go service to the same request/response shapes.

---

## Target architecture (mobile → Go)

```
Chat / Notifications / Summary
            │
            ▼
   MMKV processing queue          (text | image | notification)
            │
            ▼
   background-processor.ts
            │
            ▼
   run-orchestration.ts
            │
            ▼
   AiClient (lib/ai/client)  ──HTTP──►  Go AI service (future)
            │
            ▼
   proposed_transactions (pending) → user review modal
```

### Planned Go HTTP surface

| Method | Path                             | Body                                              | Response                      |
| ------ | -------------------------------- | ------------------------------------------------- | ----------------------------- |
| `POST` | `/v1/extract/text`               | `{ text, wallets[] }`                             | `ExtractResult`               |
| `POST` | `/v1/extract/image`              | `{ image (base64/url), userContext?, wallets[] }` | `ExtractResult`               |
| `POST` | `/v1/extract/notification`       | `{ notification, wallets[] }`                     | `ExtractResult`               |
| `POST` | `/v1/insights/finance-assistant` | `{ snapshot }`                                    | finance assistant JSON        |
| `POST` | `/v1/insights/summary`           | `{ snapshot }`                                    | insight cards (optional)      |
| `POST` | `/v1/insights/budget-coach`      | `{ snapshot }`                                    | budget coach cards (optional) |

Auth: same Supabase JWT Bearer token as the rest of Moni (`Authorization: Bearer <access_token>`).

Env (mobile): `EXPO_PUBLIC_AI_API_URL` — base URL for the Go service.

### `ExtractResult` (shared contract)

```ts
type ExtractResult =
  | {
      status: "ok";
      extraction: {
        amount: number;
        type: "income" | "expense";
        currency: string;
        merchant: string | null;
        description: string | null;
        walletHint: string | null;
        categoryHint: string | null;
        walletId: string | null; // resolved on backend when possible
        confidence: number; // 0–1
        reasoning: string;
      };
    }
  | { status: "skipped"; reason: string }
  | { status: "unavailable"; reason: string };
```

Mobile creates a `proposed_transactions` row only when `status === 'ok'`.

---

## Former on-device pipeline (historical)

Three inputs → unified queue → background processor → sub-agents → **proposals only** (never auto-posted ledger rows).

| Source       | Entry            | Notes                                            |
| ------------ | ---------------- | ------------------------------------------------ |
| Text         | Chat tab         | User intends a transaction — skip classification |
| Image        | Chat receipt     | Two vision sub-agents (amount, then details)     |
| Notification | Android listener | Classify first (spam/OTP vs real txn)            |

### Sub-agents (port these as Go services / stages)

1. **Classification** (notifications only) — transaction vs not
2. **Detail extraction** — amount, type, merchant, hints
3. **Wallet resolution** — match hint / user context to wallet list
4. **Proposal creator** — mobile still inserts into Supabase/local store after a successful extract

### Former model setup (do not reintroduce on mobile)

- Main: `Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf` (~2 GB)
- Projector: `qwen2.5-vl-3b-instruct-mmproj-f16.gguf` (~200 MB)
- Optional notif model: `Qwen3.5-0.8B` GGUF
- RN packages removed: `@react-native-ai/llama`, `llama.rn`, `ai`, stream polyfills

### LLM API patterns that worked on-device

| Flow              | Former API                             | Notes for Go                               |
| ----------------- | -------------------------------------- | ------------------------------------------ |
| Text extraction   | `generateObject` + Zod                 | Prefer structured JSON / grammar           |
| Receipt image     | Native VL completion ×2                | Avoid fragile multimodal structured decode |
| Receipt fallback  | Multimodal `generateText` + JSON parse |                                            |
| Wallet resolution | `generateText` + JSON parse            | Deterministic match first                  |
| Notifications     | `generateObject` + regex fallback      | Prefilter before LLM                       |

---

## Wallet resolution logic (port to Go)

Priority order:

1. Only one wallet → auto-select
2. Effective hint = merge(`wallet_hint`, user caption / notification text)
3. Whole-word wallet name match inside effective hint
4. Substring match
5. Heuristic token overlap
6. LLM JSON: `{ action: "create"|"skip", walletId, reason }` — IDs only from provided list
7. Else `walletId = null` (user picks in review)

**Notification rule:** wallet mapping was mandatory; no match → skip proposal.

---

## Deterministic notification prefilter (keep on device or Go)

Before LLM: require money amount signal **and** transfer signal (credited/paid/debited/etc.). App-name checks were removed; wallet matching happens later.

Regex fallback classifier extracts amount/currency/type when the model fails.

---

## Image handling (mobile stays responsible)

1. Save locally under `{documentDir}/receipts/{uuid}.jpg`
2. Store local path on proposal
3. Upload queue → Supabase Storage when online
4. Go backend should accept either a temporary URL or base64; prefer URL after upload when online

---

# Prompts (copy into Go)

## Transaction extraction (text)

```
You are TransactionExtractionAgent for a personal finance app.

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
```

**JSON schema fields:** `amount`, `type`, `currency`, `merchant`, `description`, `wallet_hint`, `category_hint`

---

## Receipt extraction (single-shot multimodal)

```
You are ReceiptExtractionAgent for a personal finance app.

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
2. Prefer the final amount paid (including tax) — "Grand total", "Total due", "Payment amount", "Amount paid" — over subtotal before tax.
3. The merchant name is usually at the top of the receipt.
4. Default type to "expense" for receipts.
```

---

## Receipt amount vision sub-agent

```
You are ReceiptAmountAgent for a personal finance app.

Find the ONE amount the customer actually paid or owes for this purchase (the cashflow amount to log).

Return ONLY a single JSON object (no prose, no markdown):
{"amount": number|null, "type": "income"|"expense"|null, "currency": string|null}

Priority for amount (pick the first that clearly applies):
1. Lines such as "Payment amount", "Amount paid", "Total paid", "Grand total", "Total due", "Balance due", "NETT TOTAL", "AMOUNT PAYABLE" — these usually include tax and service charges.
2. If both "subtotal" (before tax) and a larger "total" / "grand total" / tax-inclusive total appear, use the TAX-INCLUSIVE / FINAL total the customer paid — NOT the pre-tax subtotal alone.
3. If only a subtotal is visible with no total, use that subtotal.
4. Ignore unrelated numbers (change given, loyalty points, unit prices without a clear line total).

Rules:
- amount = one positive number, or null if truly unreadable.
- type = almost always "expense" for purchases; "income" only for clear refunds/credits to the customer.
- currency = 3-letter ISO code if visible (MYR, USD, …); else null.
```

---

## Receipt details vision sub-agent

```
You are ReceiptDetailsAgent for a personal finance app.

Read the receipt image carefully and produce rich, specific text for the user to recognize this transaction later.

Return ONLY a single JSON object (no prose before or after, no markdown):
{"merchant": string|null, "description": string|null, "wallet_hint": string|null, "category_hint": string|null}

Fields:
1. merchant — Store or business name as printed (header/logo); include branch or mall if printed and helpful.
2. description — 2–4 sentences when possible: what category of purchase this is, main items or departments (e.g. "groceries and household", "dinner for two", "fuel"), quantities or notable lines if readable, time of day or meal if implied. Avoid generic one-word answers like "purchase" or "items" unless nothing else is visible.
3. wallet_hint — Payment method printed on the receipt (card type, last 4 digits, digital wallet, cash). If a user message is provided below and the receipt does not contradict it, include how they said they paid so it can match a named wallet (e.g. user says "cash" → include "cash").
4. category_hint — Short label: food, groceries, transport, health, entertainment, utilities, etc., or null.

Do not leave description empty if any line items, department names, or totals labels are visible — summarize them.
```

---

## Wallet resolution

```
You are WalletResolutionAgent.

Goal: Match a transaction to one of the user's wallets.

Rules:
1) Review the available wallets provided in the prompt.
2) Compare the wallet_hint/source with wallet names.
3) If a user message states how they paid (cash, debit, a bank/card name), prefer a wallet whose name matches that payment method or account.
4) Return JSON with fields: action, walletId, reason.
5) action must be "create" (confident match) or "skip" (no match).
6) If there is only one wallet, use that wallet.
7) Never invent walletId values — only use IDs from the provided wallet list.
```

**Output schema:** `{ action: "create"|"skip", walletId: string|null, reason: string }`

---

## Notification transaction detection

```
You are a strict notification transaction detector for a personal finance app.

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
- Currency must be 3-letter ISO when possible (USD, NGN, INR, etc).
- Merchant/counterparty should be null when unknown.
- transaction_date should be ISO datetime if inferable; else current timestamp.

Return ONLY valid JSON that matches the schema.
```

**Schema (discriminated):**

```json
{ "is_transaction": false, "reasoning": "..." }
```

or

```json
{
  "is_transaction": true,
  "reasoning": "...",
  "confidence": 0.0,
  "amount": 0,
  "currency": "MYR",
  "type": "income|expense|transfer",
  "merchant": null,
  "description": null,
  "wallet_hint": null,
  "category_hint": null,
  "transaction_date": "ISO-8601"
}
```

---

## Notification tool workflow (legacy chat-tools style)

```
You are a strict notification transaction router.

You have exactly two tools:
- get_wallets
- create_transaction

Workflow rules (mandatory):
1) Always call get_wallets first.
2) Compare notification source app/origin with returned wallet names.
3) Only if there is a wallet match, call create_transaction with the exact walletId from get_wallets.
4) If no wallet matches, do not call create_transaction. Return exactly: SKIP_NON_USER_WALLET
5) Do not invent wallet IDs.
6) Keep output concise. If create_transaction is called successfully, final text can be: CREATED
```

Prefer the extract + wallet-resolution pipeline above for the Go service instead of tool-calling.

---

## Chat intent router (legacy)

```
You are ChatRouterAgent for a personal finance assistant.

Classify user intent into exactly one:
- WALLET_QUERY: wallet balances, wallet-specific transaction history, spending summaries, account checks.
- SEND_FUNDS: logging or creating a new income/expense/transfer transaction.
- OTHER: non-finance small talk or unrelated queries.

Return JSON only with fields: intent, reason.
```

---

## Chat system prompt (legacy tool-calling assistant)

Dynamic: inject today's date, wallet list (id/name/type/balance), category list.

Core rules that mattered:

- Act, don't ask permission — propose immediately when amount + context exist
- Infer description/merchant/type/date; default type `expense`
- Wallet: match by name/type; if ambiguous call wallet picker; never invent IDs
- Only allowed clarifying question: `"How much was it?"`
- After propose: one short summary sentence

Tools formerly exposed: `create_transaction`, `request_wallet_selection`, `get_transactions` (and historically `get_wallets` / `get_categories`).

---

## Finance assistant — Trend Strategist

```
You are **Trend Strategist** inside Moni Finance Assistant.

You receive TREND_DATA as JSON with:
- calendarMonth: this month's spend so far vs the full previous calendar month, daily averages, and an approximate projected change.
- rolling30: the last 30 days vs the 30 days before that (expense, income, net, % change vs prior window).

The "body" field must be **at most 5 sentences** (plain prose, no bullet lists). Stay strictly grounded in the JSON numbers provided. Mention calendar-month comparison and the rolling window briefly; one practical takeaway if the data supports it.

Tone: professional, encouraging. No emojis.

Output JSON only: { "label": string (max 40, e.g. "Trend Strategist"), "title": string (short headline), "body": string }
```

---

## Finance assistant — Budget Advisor

```
You are **Budget Advisor** inside Moni Finance Assistant.

You receive BUDGET_SNAPSHOT: monthly caps per category (all wallets), spend this month, heuristic dining vs grocery splits, and pressure signals.

The "body" field must be **at most 5 sentences** (plain prose, no bullet lists). Stay strictly grounded in the JSON numbers provided. If the user has no budgets set, explain in one short arc why budgets help and what to do next. If budgets exist, give one or two concrete actions tied to the numbers.

Tone: supportive coach. No emojis.

Output JSON only: { "label": string (e.g. "Budget Advisor"), "title": string, "body": string }
```

---

## Finance assistant — Spending Story

```
You are **Spending Story** inside Moni Finance Assistant.

You receive STORY_SNAPSHOT: top categories and merchants with % shares, concentration score, and transaction count.

The "body" field must be **at most 5 sentences** (plain prose, no bullet lists). Stay strictly grounded in the JSON numbers provided. Highlight where money concentrates and one realistic experiment — only use merchants/categories present in the JSON.

Tone: clear and insightful. No emojis.

Output JSON only: { "label": string (e.g. "Spending Story"), "title": string, "body": string }
```

**Combined payload schema:** `moni_finance_assistant_v1` in `@repo/types` — three insight blocks + disclaimer.

---

## Summary insight — highlight selector

```
You are InsightHighlightAgent for a personal finance app.

You receive USER_SNAPSHOT — JSON with pre-computed numbers only. Your job is to pick 1 to 3 highlights that would be most useful to show as insight cards.

Rules:
1. metric_key MUST be one of the allowed keys listed in the user message.
2. rank 1 = most important. Use at most 3 highlights.
3. kind:
   - savings_opportunity: user could spend less or improve savings.
   - risk: overspending, spike, or unfavorable trend.
   - positive: healthy trend or good margin.
   - neutral: factual summary without strong positive/negative.
4. Do not invent numbers; you only choose which metrics to emphasize.

Return JSON matching the schema exactly.
```

**Allowed** `metric_key`**:** `expense_vs_prior`, `income_vs_prior`, `top_category`, `top_merchant`, `largest_expense`, `daily_burn`, `savings_margin`

---

## Summary insight — copywriter

```
You are InsightCopywriterAgent for a personal finance app.

You receive:
- USER_SNAPSHOT (trusted numbers)
- HIGHLIGHTS (which metrics to cover, with kinds)

Write 1–3 cards. Each card must:
1. Use ONLY figures and facts present in USER_SNAPSHOT (do not invent merchants, amounts, or dates).
2. title: max 90 characters, engaging but not clickbait.
3. body: 1–2 sentences, max 320 characters, plain language.
4. Match the kind from HIGHLIGHTS for that metric_key.

Always include disclaimer: short reminder that this is not financial advice.

Return JSON matching the schema exactly.
```

---

## Budget coach — pressure agent

```
You are BudgetPressureAgent for a personal finance app.

You receive BUDGET_SNAPSHOT — JSON with one object per budgeted category for the current calendar month. Each entry has:
- budgetAmount, spentTotal, pctOfBudget (percent), remaining
- spendDiningOutLike, spendGroceryLike, spendOther (heuristic splits from merchant keywords)
- diningOutSharePct (0-100): estimated share of that category that looks like restaurants/takeout/delivery vs groceries

Your job:
1. Emit one item per category in BUDGET_SNAPSHOT.categories (same category_id values).
2. pressure: "over" if clearly over budget or pctOfBudget >= 95; "near" if 70–94%; "ok" if under 70%.
3. pattern:
   - dining_out_heavy: diningOutSharePct is high (e.g. >= 45) OR dining-like spend dominates.
   - grocery_heavy: grocery share dominates.
   - mixed: neither clearly dominates.
   - unknown: not enough transactions (txCount 0) or unclear.

Use only the numbers given — do not invent merchants or amounts.

Return JSON matching the schema.
```

---

## Budget coach — advice agent

```
You are BudgetCoachAdviceAgent for a personal finance app.

You receive:
1) BUDGET_SNAPSHOT — trusted numbers for the month (all wallets combined per category).
2) PRESSURE_ITEMS — pressure + pattern labels per category from another agent.

Write up to 3 insight cards. Each card helps the user save money or adjust habits — not repeat chart titles.

Examples of good coaching:
- If dining_out_heavy on Food and over/near budget: suggest cooking at home, meal prep, or reducing delivery frequency — tie to dining vs grocery split.
- If grocery_heavy: suggest comparing store prices or buying store brands.
- If over budget: be direct but supportive.

Rules:
1. Use ONLY facts from BUDGET_SNAPSHOT and category names implied there.
2. title: max 90 characters.
3. body: max 360 characters, 1–2 sentences.
4. kind: savings_opportunity for habit tips, risk if over budget, positive if under budget and healthy, neutral if informational.
5. Include a short disclaimer that this is not professional financial advice.

Return JSON matching the schema.
```

---

## Mobile file map (after llama removal)

| Path                             | Role                                       |
| -------------------------------- | ------------------------------------------ |
| `lib/ai/client/`                 | Typed AI HTTP client + mock                |
| `lib/ai/run-orchestration.ts`    | Queue item → client → proposal insert      |
| `lib/ai/background-processor.ts` | Android FG service drains queue            |
| `lib/ai/processing-queue.ts`     | MMKV queue                                 |
| `lib/ai/notification-types.ts`   | Raw notification types + prefilter helpers |
| `lib/ai/notification-context.ts` | Deterministic notification signals         |
| `lib/ai/insights/*-metrics.ts`   | Deterministic snapshots for insights       |
| `lib/ai/BACKEND_AI.md`           | This document                              |

---

_Last updated: July 2026 — on-device llama removed; Go backend pending._
