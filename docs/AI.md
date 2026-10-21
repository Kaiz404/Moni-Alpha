# AI Pipeline

Moni turns natural language, receipt photos, and (on Android) bank notifications into transactions. Moni chat (a pushed page) also answers finance questions using pre-aggregated metrics. Inference runs on the Go backend (`apps/backend`) against OpenRouter; the client decides what needs review (see [Routine detection](#routine-detection)).

## Flow

### Transaction extraction (queue)

```
Input (chat text / receipt photo / notification / + chooser scan or voice)
  → MMKV processing queue                 apps/mobile/lib/ai/processing-queue.ts
  → background processor (Android FG svc) apps/mobile/lib/ai/background-processor.ts
  → run-extraction                        apps/mobile/lib/ai/run-extraction.ts
  → AiClient                              apps/mobile/lib/ai/client/
  → Go backend                            apps/backend (Gin, stateless)
  → OpenRouter
  → routine detection                     apps/mobile/lib/ai/routine.ts
      routine notification → transactions (metadata.ai_suggested, shown as "Auto")
      otherwise            → proposed_transactions (category/merchant prefilled from history)
  → Review deck (`app/review.tsx`) → Approve / Not mine / Later
```

### Moni chat (conversational)

```
User message (text / inline receipt-camera photo / tap-to-talk)
  → lib/ai/chat/orchestrator.ts (heuristic routing; a thinking card holds the turn)
  → extract path: run-extraction (sync for text) or processing queue (images) → draft card in thread
  → analyze path: pick an answer card on-device + POST /v1/chat/analyze → card with the reply as caption, or prose
  → extract skipped → auto-retry analyze → clarify with quick-reply chips if both fail
```

Threads: one per local date in the finance timezone (`lib/ai/chat/sessions.ts`), stored in MMKV by `lib/ai/chat/messages.ts`; opening chat reopens today's thread, and `app/chat/history.tsx` lists past days. Messages are a discriminated union; `assistant_draft` holds a `proposalId`, `assistant_card` an `AnswerCard`, `assistant_noticed` the lines of "Moni noticed". **Answer cards are client-side:** `pickAnswerCard` in `lib/ai/chat/answer-cards.ts` picks `category_spend`, `budget_progress` or `bill_due` from the question's topic and fills it from the ledger (`answer-snapshot.ts`), so the model never sets a card's numbers; the wire contract is unchanged. API history is the last 6 question/answer pairs of today's thread whose answer was a successful analysis (prose or a card's caption), each prefixed with its local `[HH:MM]`; drafts and errors are never sent. Failures show a short message by category (not configured, offline, rate-limited, signed out, other), never the backend reason.

Capture entry points feeding the **extraction queue** (silent — not shown in Chat thread): the tab bar's + chooser (Scan a receipt → `app/scan/receipt.tsx` camera; Say it → `app/scan/listen.tsx` narration).

If `EXPO_PUBLIC_AI_API_URL` is unset, the mobile client falls back to a mock that returns `unavailable` — AI features degrade cleanly.

## Routine detection

On-device and deterministic; the user's own transaction history is the model.

- Similar = same type and currency, and the same merchant (ids and digits stripped), or for notifications within 100 m at a similar amount. Location is ignored for manual inputs: they are often logged away from where the money was spent.
- The first transaction of a kind always goes to review. Afterwards the most recent similar transaction's category is prefilled.
- A **notification** is added without review when the last (up to 3) similar transactions agree on one active category and the amount is at most 3x the largest of them. Correcting a category breaks the streak, so the next one returns to review until the last 3 agree again.
- Transfers never auto-add. Notification transactions are dated when the notification arrived.

## Duplicate detection

One payment often reaches Moni twice. `apps/mobile/lib/ai/duplicates.ts` is a pure matcher over recent transactions and pending proposals; nothing is stored. The Review card shows the match as "Maybe a duplicate"; Not mine drops the capture.

| Kind                   | Rule                                                                                                                                 | Resolution                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-posted notification | Same app, title and text within 2 min                                                                                                | Not queued (`lib/notifications/notification-repeat.core.js`)                                                                                                                                                        |
| `same_purchase`        | Same type, currency and exact amount within 12 h; merchants share a word (company suffixes like "Sdn Bhd" ignored) or one is unknown | The Review card warns "Maybe a duplicate" and names the existing row                                                                                                                                                 |
| `transfer_pair`        | Expense in one wallet and income in another, same currency and exact amount within 10 min                                            | When a notification completes the pair, combined automatically (`combineIntoTransfer`): the existing row becomes one transfer, marked Auto if already in the ledger. Otherwise the Review card warns "Maybe a duplicate"         |

A possible `same_purchase` duplicate is never auto-added. Saving a manual entry that matches an existing purchase asks "Add anyway?".

## Finance facts

Chat answers balance, payday, subscription and affordability questions from facts computed on-device (`apps/mobile/lib/ai/facts/`), one block per currency in the snapshot. Nothing is stored except the user's verdicts; the model narrates and never computes.

- **Balance**: cash, bank, debit and e-wallet wallets (opening balance plus ledger); credit cards are left out.
- **Recurring series**: one series per currency, type and merchant (`merchantKey`). It needs 3 payments in a row on a weekly (6–8 days), biweekly (12–16) or monthly (27–34) cadence, with amounts within 20% of the median (2% for weekly and biweekly spending, so weekly groceries are not a bill). It ends once a payment is 3–5 days overdue. Transfers, balance adjustments and debt mirrors are ignored. Kind is income, subscription (Subscriptions or Entertainment category) or bill.
- **Overrides**: `recurring_overrides` rows hide a dismissed series and mark a confirmed one as certain, optionally fixing its kind, amount and day of month.
- **Payday**: the confirmed income series, else the most regular monthly one.
- **Forecast** to payday, else month end: balance − bills due before it + trusted income before it − day-to-day spend. Day-to-day spend excludes recurring series; its light, typical and heavy cases are the P10, P50 and P90 of spend in 7-day windows (shorter when the horizon is) over the last 8 weeks. Shown only with ≥45 days of history, the balance of every liquid wallet in use (holding money or used in the last 8 weeks) confirmed within 30 days (`wallets.balance_confirmed_at`), logged coverage ≥70% (logged spending over logged spending plus balance corrections that lowered a balance, last 8 weeks), a positive balance, without a payday no more unscheduled income than 20% of spending, and a range no wider than 40% of the balance. Otherwise it is `insufficient` with reasons, and the model says what it can't see.
- **Balance check**: `walletsNeedingConfirmation` lists the in-use liquid wallets holding the forecast back (never confirmed or older than 30 days), using the forecast's own in-use rule. Home's check-in asks about one main-currency wallet once that currency has ≥45 days of history; "That's right" stamps `balance_confirmed_at`, "Fix it" opens the wallet page's balance edit, "Not now" hides it for 7 days (device-local).
- **Afford**: when the question asks about affording ("afford", "can I buy/spend", "should I buy", "enough for"), its amount (`RM800`, or a bare number) is subtracted on-device; the reply is yes only if the worst case stays ≥ 0.
- **Backtest** (`backtestForecast`, CI only): replaying 10 synthetic six-month salaried ledgers day by day put the real balance before payday inside the range 86% of the time (80% over 20 ledgers, worst ledger 53%). P25/P75 managed 60% (50% over 20): an interquartile range holds about half the outcomes by construction. Real accuracy needs replay over real ledgers.

## Wire contract

Defined in `apps/mobile/lib/ai/client/types.ts`. Extraction structs mirror `apps/backend/internal/extract/types.go`; chat analyze mirrors `apps/backend/internal/chat/types.go`. **Keep these in sync manually.**

Every extract endpoint returns:

```ts
type ExtractResult =
  | {
      status: 'ok';
      extraction: {
        amount;
        type;
        currency;
        merchant;
        description;
        walletHint;
        categoryHint;
        walletId;
        transferToWalletHint;
        transferToWalletId;
        confidence;
        reasoning;
        occurredAt; // YYYY-MM-DD or null; text and receipts only
      };
    }
  | { status: 'skipped'; reason: string } // input isn't a transaction
  | { status: 'unavailable'; reason: string }; // backend model failure (mobile queue retries)
```

Chat analyze (`POST /v1/chat/analyze`):

```ts
// Request
{ message: string; snapshot: { schema: "finance_assistant_tool_v4"; generatedAt: string; currencies: Record<ISO4217, FinanceAssistantCurrencySnapshot> }; history?: { role: "user"|"assistant"; content: string }[] }

// Response
{ status: "ok"; reply: string; modelId: string } | { status: "unavailable"; reason: string }
```

Text and image requests also carry optional `clientNow` (device local time, RFC 3339 with offset) and `timezone` (IANA). Without them the backend sends no `TODAY` line and returns `occurredAt: null`, so older clients keep working.

`type` is `income` | `expense` | `transfer`. Transfers use `walletId` as the source wallet and `transferToWalletId` as the destination (either may be `null` for user completion in the review UI). Receipt and notification extraction remain income/expense only; **text** extraction detects transfers (e.g. "move 500 from Maybank to savings").

Auth: `Authorization: Bearer <supabase-user-jwt>`, verified via JWKS (ES256). Errors: `{ error, details? }`.

## Model allocation

Every flow uses `deepseek/deepseek-v4.1-flash` on OpenRouter, chosen by the benchmark below. Source of truth: `llm.Model` in `apps/backend/internal/llm/models.go`; `pnpm --filter backend test:live` fails if OpenRouter stops serving it.

| Flow                       | Endpoint                   | Retry and 429 behaviour                                                                                                                              |
| -------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text extraction (live)     | `/v1/extract/text`         | One retry on unparseable output; 429 waits up to 3s                                                                                                  |
| Receipt images (live)      | `/v1/extract/image`        | No retry; 429 waits up to 5s                                                                                                                         |
| Notifications (background) | `/v1/extract/notification` | One retry; 429 waits up to 30s. One-time codes (OTP/TAC, "do not share") are skipped before any model call because a model has read them as payments |
| Chat finance analysis      | `/v1/chat/analyze`         | No retry; 429 waits up to 10s; snapshot context keeps tokens bounded                                                                                 |

Every request asks for `response_format: json_object`, disables reasoning (even low effort used the whole token budget before the JSON in the benchmark), and sets `provider.require_parameters` so OpenRouter only routes to upstream hosts that honour JSON mode. `llm.CompleteJSON` strips fences and rejects malformed output. A reply cut off at `max_tokens` (`finish_reason: length`) is retried once with double the budget; each attempt keeps the flow's 429 wait cap. The extraction bad-JSON retry skips truncated replies, so a flow makes at most 2 calls. Budgets: chat 900 tokens, text 768, notifications 512, receipts 1024. Receipts run at temperature 0.1.

### Rate limits and cost (~1000 users)

- OpenRouter bills prepaid credit per token; it has no tight per-minute limits on paid models.
- The backend rate-limits per user (20 req/min, burst 8) so one client can't drain the shared credit.
- Live flows return `unavailable` after a short 429 window; notifications wait up to 30s.
- Cost: about $0.12 per 1000 extractions in the benchmark, roughly $115 a month at 1000 users doing 30 a day. Receipts stay cheap because the client crops, filters and downscales to a single ≤1024px JPEG on-device before sending.

### Model benchmark (2026-10-07)

`pnpm --filter backend bench:llm` runs 29 labelled Malaysian cases (11 text, 14 notifications, 4 synthetic receipts) through the production extraction service per candidate model and writes a scorecard to `apps/backend/bench-results/` (gitignored). Setup, flags and the model list are in `apps/backend/README.md`. A pass means amount, type and every labelled field (currency, merchant, wallets) matched, or that a non-transaction was skipped. OpenRouter calls ran with reasoning disabled; even low effort used the whole 512-token budget on `qwen3.7-flash`.

Full run, 3 runs per case, before the notification prompt accepted payments from any app:

| Provider   | Model                          | Pass | Receipts | p50  | p95   | $ / 1k calls |
| ---------- | ------------------------------ | ---- | -------- | ---- | ----- | ------------ |
| OpenRouter | `deepseek/deepseek-v4.1-flash` | 100% | 100%     | 1.6s | 3.1s  | 0.128        |
| OpenRouter | `qwen/qwen3.7-flash`           | 100% | 100%     | 2.3s | 5.2s  | 0.033        |
| OpenRouter | `deepseek/deepseek-v4-flash`   | 100% | no image | 2.2s | 6.5s  | 0.080        |
| OpenRouter | `moonshotai/kimi-k2.5`         | 100% | 100%     | 3.5s | 6.8s  | 0.587        |
| OpenRouter | `xiaomi/mimo-v2.6-flash`       | 98%  | 100%     | 4.2s | 14.3s | 0.088        |
| OpenRouter | `qwen/qwen3.8-flash`           | 98%  | 92%      | 3.3s | 8.4s  | 0.105        |
| OpenRouter | `bytedance-seed/seed-2.0-mini` | 95%  | 92%      | 1.0s | 1.8s  | 0.158        |
| OpenRouter | `minimax/minimax-m3`           | 95%  | 92%      | 2.7s | 7.0s  | 0.273        |
| OpenRouter | `qwen/qwen3.8-27b`             | 95%  | 100%     | 2.5s | 4.7s  | 0.440        |
| Groq Free  | `openai/gpt-oss-120b`          | 96%  | no image | 1.2s | 1.8s  | free         |
| Groq Free  | `openai/gpt-oss-20b`           | 93%  | no image | 0.9s | 1.8s  | free         |
| Groq Free  | `qwen/qwen3.8-27b`             | none | none     |      |       | free         |
| OpenRouter | `z-ai/glm-5.3-flash`           | none | none     |      |       |              |

After the prompt change, `deepseek-v4.1-flash`, `qwen3.7-flash`, `seed-2.0-mini`, `minimax-m3` and `mimo-v2.6-flash` passed all 87 checks, and `gpt-oss-120b` passed all 50 that Groq served.

Findings:

- **Groq Free can't carry production traffic.** Around 24 requests a minute across three models drew `retry-after` waits of 3 to 17 minutes. `qwen3.8-27b`, which serves receipts, chat and the notification fallback, answered 1 of 87 cases within a minute.
- **The old notification prompt dropped online payments.** It required a bank, fintech, payment or wallet app, so every model skipped Lazada refunds and most skipped GrabFood payments. Any app confirming a completed payment or refund now counts.
- **Remaining model errors were receipt JSON.** `qwen3.8-flash`, `seed-2.0-mini` and `minimax-m3` each returned unparseable receipt JSON once in three runs.
- **`glm-5.3-flash` requires reasoning.** OpenRouter rejects reasoning-off requests; testing it means raising the 512-token budget.
- **Best fits.** `deepseek-v4.1-flash` for one model across every flow (tightest p95). `qwen3.7-flash` for the lowest cost at about a quarter of the price. Rough estimate at 1000 users and 30 extractions a day: about $115 a month on DeepSeek, $30 on Qwen.
- **Limits.** The cases are too easy to rank the top models, and the receipts are clean synthetic images. Real phone photos and real notifications would separate them.

## Extraction pipeline details

- **Prompts** live in `apps/backend/internal/extract/prompts.go` and `internal/chat/prompts.go`.
- **Wallet selection** — the client's `wallets[]` is injected into every extraction user message as `AVAILABLE_WALLETS` (JSON array of `{id, name, type?, currency?, accountHint?}`). The extraction model returns `wallet_id` / `transfer_to_wallet_id` directly; the backend validates ids against the provided list (`internal/extract/wallet_resolver.go`):
  1. Client-locked wallet when exactly one wallet is linked to the notification app (`lockedWalletId`)
  2. Only one wallet in candidate list → auto-select
  3. Valid `wallet_id` from the model (must be in the provided list)
  4. Fallback: merge `wallet_hint` + notification body → `accountHint` match → whole-word name match → substring → token overlap
  5. `walletId = null` → mobile applies the user's **default wallet** from `profiles.preferences.default_wallet_id` when set (`lib/wallets/default-wallet.ts`); otherwise user picks in the review UI
- **Currency** — text and receipt extraction do **not** ask the model for currency. Amount only; currency is taken from the resolved wallet (`lib/wallets/proposal-wallet.ts`). Receipts always land on the default wallet (user can switch wallet — and thus currency — in the review UI). Notifications extract currency from the bank message; if that currency does not match the default wallet, `walletId` stays null until the user picks a wallet in review.
- **Dates** — text and receipt prompts get `TODAY: YYYY-MM-DD (weekday), timezone …` from the client clock and return `occurred_at` for "yesterday", "last Friday", "on the 3rd" or a printed receipt date. The backend only checks the format; `lib/ai/occurred-at.ts` turns it into the transaction date: today, missing, invalid, future or older than 90 days → the capture time; other past days → local noon. Notifications keep their arrival time.
- For **transfers**, resolution runs twice: source (`wallet_id` + context) and destination (`transfer_to_wallet_id` + hint only).
- **Text transfer patterns:** deposits ("deposited cash to bank"), withdrawals, top-ups, and explicit "from X to Y" moves are transfers between wallets in `AVAILABLE_WALLETS` — not income. The model uses wallet names/types to infer direction (e.g. cash → bank for deposits).
- **Notification rule:** each wallet may link one Android app (`notification_package` on `wallets`). Notifications from unlinked apps are captured for debug but not queued. Candidate wallets are narrowed by package before extraction; ambiguous same-app wallets may create proposals with `walletId: null` for review (`run-extraction.ts`).
- **Notification prefilter stays on-device** (`apps/mobile/lib/notifications/notification-filter.core.js`): requires a money-amount signal AND a transfer signal before an LLM ever sees it. Test suite: `pnpm --filter moni test:notification-detection`.
- **Receipt images:** Android ML Kit document scanner (`modules/moni-document-scanner`) → normalized ≤1024px JPEG (`lib/receipts/normalize-scan.ts`). `lib/ai/client/image-payload.ts` base64-encodes (defensive downscale fallback) or sends the Storage URL if already uploaded. User cancel / empty scan never reaches the queue. Backend extracts amount, merchant, and description only; mobile assigns the default wallet and its currency.

## Chat routing (on-device)

Heuristic-first — no LLM call for most messages:

| Input                                                                        | Route                                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Photo attached                                                               | Always extract                                                           |
| Question-like text (`?`, how/what/am I/show/list/will/…) without amount      | Analyze                                                                  |
| Question about afford/forecast/payday/subscriptions/owe, even with an amount | Analyze                                                                  |
| Amount (`RM12`, `RM 12`, `12 rm`, `$12`) or merchant verbs                   | Extract; with a question → clarify chips                                 |
| Default text                                                                 | Extract → if `skipped`, retry analyze → if both fail, clarify with chips |

Table test: `lib/ai/chat/__tests__/routing.test.ts`.

Snapshot builder: `lib/ai/snapshot/finance-metrics.ts` (deterministic metrics from transactions, budgets and pending proposals, plus [finance facts](#finance-facts) — never raw tx rows sent to the model). Each snapshot is keyed by ISO currency; mobile and the chat prompt must never sum, compare, or infer a first/default currency across keys. Rows without a currency are skipped and logged, never defaulted. `pendingProposals` is a count plus expense and income totals per currency; a proposal takes its wallet's currency, and text and receipt proposals without a wallet are left out because their currency is a placeholder. `calendarMonth.dailyPaceVsPreviousMonthPct` compares average daily spend with last month and is `null` before day 7 and while one expense is over half of month-to-date spend, so rent on day 1 never reads as a forecast. `rolling30.deltas.*PctVsPrior` is `null` when the prior 30 days are empty.

**Chat bench** (`pnpm --filter moni bench:chat`, offline, part of `pnpm --filter moni test`): a fixed MYR/SGD/USD ledger with rent on day 1, a refund, a transfer, MYR salary, rent and Netflix series with confirmed balances, a stale SGD balance and irregular USD freelance income, plus generated salaried and gig-worker MYR ledgers with daily spending (`lib/ai/chat/bench/fixture.ts`), 31 questions with the snapshot facts each answer rests on (`cases.ts`; each question gets its own snapshot so an asked amount reaches the forecast, as in `analyze.ts`), and a grounding checker (`grounding.ts`) that fails a reply citing a number not derivable from one currency's snapshot, or a sum across currencies. `pnpm --filter moni bench:chat:live` sends the same questions through the real chat service and model (needs `apps/backend/.env`) and scores the replies with that checker plus style gates (at most 150 words, no leaked field names like "null" or "snapshot"); run it after changing the chat prompt, snapshot or model.
