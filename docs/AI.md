# AI Pipeline

Moni turns natural language, receipt photos, and (on Android) bank notifications into transactions. The Chat tab also answers finance questions using pre-aggregated metrics. Inference runs on the Go backend (`apps/backend`) against Groq; the client decides what needs review (see [Routine detection](#routine-detection)).

## Flow

### Transaction extraction (queue)

```
Input (chat text / receipt photo / notification / FAB scan)
  → MMKV processing queue                 apps/mobile/lib/ai/processing-queue.ts
  → background processor (Android FG svc) apps/mobile/lib/ai/background-processor.ts
  → run-extraction                        apps/mobile/lib/ai/run-extraction.ts
  → AiClient                              apps/mobile/lib/ai/client/
  → Go backend                            apps/backend (Gin, stateless)
  → Groq
  → routine detection                     apps/mobile/lib/ai/routine.ts
      routine notification → transactions (metadata.ai_suggested, shown as "Auto")
      otherwise            → proposed_transactions (category/merchant prefilled from history)
  → ProposalSummarySheet (minimal popup) → Approve/Decline, or "Edit details" → `app/proposal/[id].tsx`
```

### Chat tab (conversational)

```
User message (text / inline receipt-camera photo / hold-to-talk)
  → lib/ai/chat/orchestrator.ts (heuristic routing)
  → extract path: run-extraction (sync for text) or processing queue (images)
  → analyze path: build snapshot on-device → POST /v1/chat/analyze → prose reply in thread
  → extract skipped → auto-retry analyze → clarify with quick-reply chips if both fail
```

Chat sessions: MMKV (`lib/ai/chat/messages.ts`), rolling ~6 message pairs sent as API history, 24h idle expiry, "New chat" reset.

Capture entry points feeding the **extraction queue** (silent — not shown in Chat thread): floating tab-bar button (tap → `app/scan/receipt.tsx` camera; long-press → `app/scan/listen.tsx` narration).

If `EXPO_PUBLIC_AI_API_URL` is unset, the mobile client falls back to a mock that returns `unavailable` — AI features degrade cleanly.

## Routine detection

On-device and deterministic; the user's own transaction history is the model.

- Similar = same type and currency, and the same merchant (ids and digits stripped), or for notifications within 100 m at a similar amount. Location is ignored for manual inputs: they are often logged away from where the money was spent.
- The first transaction of a kind always goes to review. Afterwards the most recent similar transaction's category is prefilled.
- A **notification** is added without review when the last (up to 3) similar transactions agree on one active category and the amount is at most 3x the largest of them. Correcting a category breaks the streak, so the next one returns to review until the last 3 agree again.
- Transfers never auto-add. Notification transactions are dated when the notification arrived.

## Duplicate detection

One payment often reaches Moni twice. `apps/mobile/lib/ai/duplicates.ts` is a pure matcher over recent transactions and pending proposals; nothing is stored, and nothing merges without a tap.

| Kind                   | Rule                                                                                                                                 | Resolution                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-posted notification | Same app, title and text within 2 min                                                                                                | Not queued (`lib/notifications/notification-repeat.core.js`)                                                                                                                                                        |
| `same_purchase`        | Same type, currency and exact amount within 12 h; merchants share a word (company suffixes like "Sdn Bhd" ignored) or one is unknown | Review shows "Same purchase · merge": fills the existing row's missing category, merchant and receipt, then drops the proposal                                                                                      |
| `transfer_pair`        | Expense in one wallet and income in another, same currency and exact amount within 10 min                                            | When a notification completes the pair, combined automatically (`combineIntoTransfer`): the existing row becomes one transfer, marked Auto if already in the ledger. Otherwise review shows "Combine into transfer" |

A possible `same_purchase` duplicate is never auto-added. Saving a manual entry that matches an existing purchase asks "Add anyway?".

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
      };
    }
  | { status: 'skipped'; reason: string } // input isn't a transaction
  | { status: 'unavailable'; reason: string }; // backend model failure (mobile queue retries)
```

Chat analyze (`POST /v1/chat/analyze`):

```ts
// Request
{ message: string; snapshot: { schema: "finance_assistant_tool_v2"; generatedAt: string; currencies: Record<ISO4217, FinanceAssistantCurrencySnapshot> }; history?: { role: "user"|"assistant"; content: string }[] }

// Response
{ status: "ok"; reply: string; modelId: string } | { status: "unavailable"; reason: string }
```

`type` is `income` | `expense` | `transfer`. Transfers use `walletId` as the source wallet and `transferToWalletId` as the destination (either may be `null` for user completion in the review UI). Receipt and notification extraction remain income/expense only; **text** extraction detects transfers (e.g. "move 500 from Maybank to savings").

Auth: `Authorization: Bearer <supabase-user-jwt>`, verified via JWKS (ES256). Errors: `{ error, details? }`.

## Model allocation

Source of truth: `apps/backend/internal/groq/models.go`. `pnpm --filter backend test:live` fails if the key cannot use any of them.

| Flow                       | Endpoint                   | Model                                             | Why                                                                                                                                                                                                                          |
| -------------------------- | -------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text extraction (live)     | `/v1/extract/text`         | `openai/gpt-oss-20b`, fallback `qwen/qwen3.8-27b` | Fast; fallback covers unparseable output                                                                                                                                                                                     |
| Receipt images (live)      | `/v1/extract/image`        | `qwen/qwen3.8-27b`                                | Vision + OCR with JSON mode; the tightest per-minute limit on Groq Free                                                                                                                                                      |
| Notifications (background) | `/v1/extract/notification` | `openai/gpt-oss-20b`, fallback `qwen/qwen3.8-27b` | Latency doesn't matter, honors long 429 waits; fallback covers intermittent JSON-validation failures. One-time codes (OTP/TAC, "do not share") are skipped before any model call because the model has read them as payments |
| Chat finance analysis      | `/v1/chat/analyze`         | `qwen/qwen3.8-27b`                                | Concise prose; snapshot context keeps tokens bounded                                                                                                                                                                         |

All calls use Groq's OpenAI-compatible endpoint with `response_format: json_object` and Go-side JSON validation (`groq.CompleteJSON` strips fences and rejects malformed output). Qwen receipt calls disable reasoning, use hidden reasoning format, and put their instructions in the user message so JSON mode remains reliable.

### Rate limits and cost (Groq Developer tier, ~1000 users)

- Limits are **per organization**, not per key. Developer tier ≈ 10x free-tier limits; free tier is ~30 RPM which is not enough for production.
- The backend rate-limits per user (20 req/min, burst 8) so one client can't drain the org quota.
- Live flows retry a 429 only within a short window (3–5s) then return `unavailable`; the mobile queue retries later. Notifications wait up to 30s.
- Cost: most calls go to the fast model (`openai/gpt-oss-20b`). At 1000 users doing a few extractions/day this is low single-digit dollars per month; receipts (vision) dominate but stay cheap because the client already perspective-crops + grayscale/contrast-filters + downscales to a single ≤1024px JPEG on-device before it's ever sent.

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
- For **transfers**, resolution runs twice: source (`wallet_id` + context) and destination (`transfer_to_wallet_id` + hint only).
- **Text transfer patterns:** deposits ("deposited cash to bank"), withdrawals, top-ups, and explicit "from X to Y" moves are transfers between wallets in `AVAILABLE_WALLETS` — not income. The model uses wallet names/types to infer direction (e.g. cash → bank for deposits).
- **Notification rule:** each wallet may link one Android app (`notification_package` on `wallets`). Notifications from unlinked apps are captured for debug but not queued. Candidate wallets are narrowed by package before extraction; ambiguous same-app wallets may create proposals with `walletId: null` for review (`run-extraction.ts`).
- **Notification prefilter stays on-device** (`apps/mobile/lib/notifications/notification-filter.core.js`): requires a money-amount signal AND a transfer signal before an LLM ever sees it. Test suite: `pnpm --filter moni test:notification-detection`.
- **Receipt images:** Android ML Kit document scanner (`modules/moni-document-scanner`) → normalized ≤1024px JPEG (`lib/receipts/normalize-scan.ts`). `lib/ai/client/image-payload.ts` base64-encodes (defensive downscale fallback) or sends the Storage URL if already uploaded. User cancel / empty scan never reaches the queue. Backend extracts amount, merchant, and description only; mobile assigns the default wallet and its currency.

## Chat routing (on-device)

Heuristic-first — no LLM call for most messages:

| Input                                                                         | Route                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Photo attached                                                                | Always extract                                                           |
| Question-like text (`?`, how/what/am I, analyze/review/budget) without amount | Analyze                                                                  |
| Amount/merchant patterns                                                      | Extract                                                                  |
| Default text                                                                  | Extract → if `skipped`, retry analyze → if both fail, clarify with chips |

Snapshot builder: `lib/ai/snapshot/finance-metrics.ts` (deterministic metrics from transactions + budgets — never raw tx rows sent to the model). Each snapshot is keyed by ISO currency; mobile and the chat prompt must never sum, compare, or infer a first/default currency across keys.
