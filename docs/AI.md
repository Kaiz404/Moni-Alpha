# AI Pipeline

Moni turns natural language, receipt photos, and (on Android) bank notifications into **reviewable transaction proposals**. The Chat tab also answers finance questions using pre-aggregated metrics. Inference runs on the Go backend (`apps/backend`) against Groq; nothing is committed to the ledger without user approval.

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
  → proposed_transactions (unreviewed)
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

## Wire contract

Defined in `apps/mobile/lib/ai/client/types.ts`. Extraction structs mirror `apps/backend/internal/extract/types.go`; chat analyze mirrors `apps/backend/internal/chat/types.go`. **Keep these in sync manually.**

Every extract endpoint returns:

```ts
type ExtractResult =
  | {
      status: "ok";
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
  | { status: "skipped"; reason: string } // input isn't a transaction
  | { status: "unavailable"; reason: string }; // backend model failure (mobile queue retries)
```

Chat analyze (`POST /v1/chat/analyze`):

```ts
// Request
{ message: string; snapshot: FinanceAssistantToolSnapshot; history?: { role: "user"|"assistant"; content: string }[] }

// Response
{ status: "ok"; reply: string; modelId: string } | { status: "unavailable"; reason: string }
```

`type` is `income` | `expense` | `transfer`. Transfers use `walletId` as the source wallet and `transferToWalletId` as the destination (either may be `null` for user completion in the review UI). Receipt and notification extraction remain income/expense only; **text** extraction detects transfers (e.g. "move 500 from Maybank to savings").

Auth: `Authorization: Bearer <supabase-user-jwt>`, verified via JWKS (ES256). Errors: `{ error, details? }`.

## Model allocation

| Flow                       | Endpoint                         | Model                                                      | Why                                                                                                       |
| -------------------------- | -------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Text extraction (live)     | `/v1/extract/text`               | `llama-3.1-8b-instant`, fallback `llama-3.3-70b-versatile` | Fastest inference + highest free/dev-tier request ceiling (14.4K RPD); fallback covers unparseable output |
| Receipt images (live)      | `/v1/extract/image`              | `meta-llama/llama-4-scout-17b-16e-instruct`                | Groq's vision model; 30K TPM absorbs image-token cost                                                     |
| Notifications (background) | `/v1/extract/notification`       | `llama-3.1-8b-instant`                                     | Cheap + efficient; latency doesn't matter, honors long 429 retry waits                                    |
| Chat finance analysis      | `/v1/chat/analyze`               | `llama-3.3-70b-versatile`                                  | Concise prose; snapshot context keeps tokens bounded                                                      |

All calls use Groq's OpenAI-compatible endpoint with `response_format: json_object`, temperature ≤ 0.4, and Go-side JSON validation (`groq.CompleteJSON` strips fences and rejects malformed output).

### Rate limits and cost (Groq Developer tier, ~1000 users)

- Limits are **per organization**, not per key. Developer tier ≈ 10x free-tier limits; free tier is ~30 RPM which is not enough for production.
- The backend rate-limits per user (20 req/min, burst 8) so one client can't drain the org quota.
- Live flows retry a 429 only within a short window (3–5s) then return `unavailable`; the mobile queue retries later. Notifications wait up to 30s.
- Cost: `llama-3.1-8b-instant` ≈ $0.05/M input tokens. At 1000 users doing a few extractions/day this is low single-digit dollars per month; receipts (vision) dominate but stay cheap because the client already perspective-crops + grayscale/contrast-filters + downscales to a single ≤1024px JPEG on-device before it's ever sent.

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

| Input | Route |
| ----- | ----- |
| Photo attached | Always extract |
| Question-like text (`?`, how/what/am I, analyze/review/budget) without amount | Analyze |
| Amount/merchant patterns | Extract |
| Default text | Extract → if `skipped`, retry analyze → if both fail, clarify with chips |

Snapshot builder: `lib/ai/snapshot/finance-metrics.ts` (deterministic metrics from transactions + budgets — never raw tx rows sent to the model).
