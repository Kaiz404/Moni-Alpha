# AI Pipeline

Moni turns natural language, receipt photos, and (on Android) bank notifications into **reviewable transaction proposals**. Inference runs on the Go backend (`apps/backend`) against Groq; nothing is committed to the ledger without user approval.

## Flow

```
Input (chat text / receipt photo / notification)
  → MMKV processing queue                 apps/mobile/lib/ai/processing-queue.ts
  → background processor (Android FG svc) apps/mobile/lib/ai/background-processor.ts
  → run-orchestration                     apps/mobile/lib/ai/run-orchestration.ts
  → AiClient                              apps/mobile/lib/ai/client/
  → Go backend                            apps/backend (Gin, stateless)
  → Groq
  → proposed_transactions (pending)
  → ProposalReviewModal → approve/reject
```

If `EXPO_PUBLIC_AI_API_URL` is unset, the mobile client falls back to a mock that returns `unavailable` — AI features degrade cleanly.

## Wire contract

Defined in `apps/mobile/lib/ai/client/types.ts` and mirrored by Go structs in `apps/backend/internal/extract/types.go`. **These two files must be kept in sync manually.**

Every extract endpoint returns:

```ts
type ExtractResult =
  | { status: 'ok'; extraction: { amount, type, currency, merchant, description,
      walletHint, categoryHint, walletId, confidence, reasoning } }
  | { status: 'skipped'; reason: string }      // input isn't a transaction
  | { status: 'unavailable'; reason: string }  // backend/model failure (mobile queue retries)
```

Auth: `Authorization: Bearer <supabase-user-jwt>`, verified via JWKS (ES256). Errors: `{ error, details? }`.

## Model allocation

| Flow | Endpoint | Model | Why |
| --- | --- | --- | --- |
| Text extraction (live) | `/v1/extract/text` | `llama-3.1-8b-instant`, fallback `llama-3.3-70b-versatile` | Fastest inference + highest free/dev-tier request ceiling (14.4K RPD); fallback covers unparseable output |
| Receipt images (live) | `/v1/extract/image` | `meta-llama/llama-4-scout-17b-16e-instruct` | Groq's vision model; 30K TPM absorbs image-token cost |
| Notifications (background) | `/v1/extract/notification` | `llama-3.1-8b-instant` | Cheap + efficient; latency doesn't matter, honors long 429 retry waits |
| Finance assistant | `/v1/insights/finance-assistant` | `llama-3.3-70b-versatile` | Low volume, better prose; 3 agents run in parallel |

All calls use Groq's OpenAI-compatible endpoint with `response_format: json_object`, temperature ≤ 0.4, and Go-side JSON validation (`groq.CompleteJSON` strips fences and rejects malformed output).

### Rate limits and cost (Groq Developer tier, ~1000 users)

- Limits are **per organization**, not per key. Developer tier ≈ 10x free-tier limits; free tier is ~30 RPM which is not enough for production.
- The backend rate-limits per user (20 req/min, burst 8) so one client can't drain the org quota.
- Live flows retry a 429 only within a short window (3–5s) then return `unavailable`; the mobile queue retries later. Notifications wait up to 30s.
- Cost: `llama-3.1-8b-instant` ≈ $0.05/M input tokens. At 1000 users doing a few extractions/day this is low single-digit dollars per month; receipts (vision) dominate but stay cheap because images are downscaled to ≤1280px JPEG on-device before upload.

## Extraction pipeline details

- **Prompts** live in `apps/backend/internal/extract/prompts.go` and `internal/insights/prompts.go` (ported from the former on-device pipeline; git history has `apps/mobile/lib/ai/BACKEND_AI.md` if you need the archaeology).
- **Wallet resolution ladder** (`internal/extract/wallet_resolver.go`) — deterministic first, LLM last:
  1. Only one wallet → auto-select
  2. Merge `wallet_hint` + user context / notification text
  3. Whole-word wallet-name match
  4. Substring match
  5. Token-overlap heuristic
  6. LLM (`{action, walletId, reason}`, IDs validated against the provided list)
  7. `walletId = null` → user picks in the review modal
- **Notification rule:** mobile skips proposals without a resolved wallet (`run-orchestration.ts`), so unattributable notifications never create noise.
- **Notification prefilter stays on-device** (`apps/mobile/lib/notifications/notification-filter.js`): requires a money-amount signal AND a transfer signal before an LLM ever sees it. Test suite: `pnpm --filter moni test:notification-detection`.
- **Receipt images:** mobile downscales/compresses (`lib/ai/client/image-payload.ts`), sends base64 for local files or the URL if already uploaded to the `receipts` Storage bucket.

## Insights

The mobile app computes deterministic metric snapshots (`lib/ai/insights/*-metrics.ts`) so models only ever see pre-aggregated numbers — never raw transactions. The backend runs three agents in parallel (Trend Strategist, Budget Advisor, Spending Story) and returns a `moni_finance_assistant_v1` payload validated against `@repo/types` (`ai-insight.ts`). Mobile falls back to deterministic copy when the backend is unavailable.
