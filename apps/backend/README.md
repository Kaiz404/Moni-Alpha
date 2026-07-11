# Moni AI Backend (Go + Gin)

Stateless inference gateway: receives AI requests from the mobile app, routes them to [Groq](https://console.groq.com), and returns normalized transaction extractions. It never touches the database — the mobile client inserts `proposed_transactions` itself and the user approves them in the review modal.

## Endpoints

All `/v1` routes require `Authorization: Bearer <supabase-user-jwt>`.

| Method | Path | Purpose | Model |
| --- | --- | --- | --- |
| GET | `/healthz` | Liveness (no auth) | — |
| POST | `/v1/extract/text` | Transaction from free text | `llama-3.1-8b-instant` (fallback `llama-3.3-70b-versatile`) |
| POST | `/v1/extract/image` | Transaction from receipt image (base64 or URL) | `meta-llama/llama-4-scout-17b-16e-instruct` |
| POST | `/v1/extract/notification` | Transaction from Android notification | `llama-3.1-8b-instant` |
| POST | `/v1/insights/finance-assistant` | 3-agent finance insights | `llama-3.3-70b-versatile` |

Extraction responses are a discriminated union: `{ status: "ok", extraction }`, `{ status: "skipped", reason }`, or `{ status: "unavailable", reason }`. Errors use `{ error, details? }`. The wire contract mirrors `apps/mobile/lib/ai/client/types.ts`.

## Auth

Supabase signs user access tokens with an asymmetric ES256 key. The backend verifies them statelessly against the project JWKS (`$SUPABASE_URL/auth/v1/.well-known/jwks.json`) with a 15-minute key cache — no shared JWT secret, no Supabase round-trip per request. A per-user in-memory token bucket (20 req/min, burst 8) protects the org-level Groq quota.

## Run locally

```bash
cd apps/backend
cp .env.example .env   # fill in SUPABASE_URL + GROQ_API_KEY
go run ./cmd/server    # or: pnpm --filter backend dev
```

Test with a real user token:

```bash
curl -X POST http://localhost:8080/v1/extract/text \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"spent 25 ringgit on lunch with cash","wallets":[{"id":"<uuid>","name":"Cash"}]}'
```

## Test / lint

```bash
go test ./...
go vet ./...
```

## Deploy (Google Cloud Run)

Scale-to-zero keeps this free/cheap at ~1000 users; the app tolerates cold starts because AI work is queued on-device.

```bash
gcloud run deploy moni-ai-backend \
  --source apps/backend \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars SUPABASE_URL=https://<project-ref>.supabase.co \
  --set-secrets GROQ_API_KEY=groq-api-key:latest \
  --memory 256Mi --cpu 1 --max-instances 2
```

(`--allow-unauthenticated` is required because the app does its own JWT auth; store `GROQ_API_KEY` in Secret Manager.)

Then set `EXPO_PUBLIC_AI_API_URL` in `apps/mobile/.env` to the Cloud Run URL.

## Model allocation rationale

See [docs/AI.md](../../docs/AI.md) for latency/cost/rate-limit analysis. Short version: live UX flows (text, receipts) use the fastest models with tight retry windows and fail fast to `unavailable` (the mobile queue retries); notification processing tolerates longer 429 waits; insights favor prose quality over speed.
