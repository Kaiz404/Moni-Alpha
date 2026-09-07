# Moni AI Backend (Go + Gin)

Stateless inference gateway: receives AI requests from the mobile app, routes them to [Groq](https://console.groq.com), and returns normalized transaction extractions. It never touches the database — the mobile client decides on-device whether to insert a `proposed_transactions` row for review or, for routine notifications, a transaction directly.

## Endpoints

All `/v1` routes require `Authorization: Bearer <supabase-user-jwt>`.

| Method | Path                       | Purpose                                          | Model                                              |
| ------ | -------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| GET    | `/healthz`                 | Liveness (no auth)                               | —                                                  |
| POST   | `/v1/extract/text`         | Transaction from free text                       | `openai/gpt-oss-20b` (fallback `qwen/qwen3.8-27b`) |
| POST   | `/v1/extract/image`        | Transaction from receipt image (base64 or URL)   | `qwen/qwen3.8-27b`                                 |
| POST   | `/v1/extract/notification` | Transaction from Android notification            | `openai/gpt-oss-20b` (fallback `qwen/qwen3.8-27b`) |
| POST   | `/v1/chat/analyze`         | Concise finance Q&A from pre-aggregated snapshot | `qwen/qwen3.8-27b`                                 |

Extraction responses are a discriminated union: `{ status: "ok", extraction }`, `{ status: "skipped", reason }`, or `{ status: "unavailable", reason }`. Chat analyze returns `{ status: "ok", reply, modelId }` or `{ status: "unavailable", reason }`. Errors use `{ error, details? }`. The wire contract mirrors `apps/mobile/lib/ai/client/types.ts`.

## Auth

Supabase signs user access tokens with an asymmetric ES256 key. The backend verifies them statelessly against the project JWKS (`$SUPABASE_URL/auth/v1/.well-known/jwks.json`) with a 15-minute key cache — no shared JWT secret, no Supabase round-trip per request. A per-user in-memory token bucket (20 req/min, burst 8) protects the org-level Groq quota.

## Run locally

```bash
cd apps/backend
cp .env.example .env   # fill in SUPABASE_URL + GROQ_API_KEY
pnpm --filter backend dev   # Go server + ngrok tunnel (for physical devices)
# or: pnpm --filter backend dev:server   # localhost only
```

`dev` starts the server on `:8080` and, once the port is listening, runs `ngrok http --url=slang-compound-landmass.ngrok-free.dev 8080`. Requires [ngrok](https://ngrok.com/) installed and authenticated. Point the mobile app at `EXPO_PUBLIC_AI_API_URL=https://slang-compound-landmass.ngrok-free.dev`.

From the monorepo root, `pnpm dev` runs this via Turborepo alongside the Expo app (`--filter=!web`).

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

`go test ./...` is offline: `cmd/server/router_test.go` drives every endpoint through the real router (`newRouter`) with a local JWKS (`internal/auth/authtest`) and a fake Groq server, covering auth, validation, `ok`/`skipped`/`unavailable`, model fallback and the per-user rate limit.

`pnpm test:live` (or `MONI_LIVE_TESTS=1 go test ./cmd/server -run Live -v`) calls the real Groq API with `.env`'s `GROQ_API_KEY`: it checks the key serves every model in `internal/groq/models.go`, then extracts from text, four notifications, the `cmd/server/testdata/receipt.png` receipt, and answers a chat question. Run it after changing models, prompts or keys.

`pnpm bench:llm` compares candidate models on accuracy, latency and cost. It runs 29 labelled cases (11 text, 14 notifications, 4 receipts in `internal/extract/testdata/bench/`) through the production `extract.Service`, once per model in `benchTargets` (`internal/extract/bench_test.go`), and writes a scorecard to `bench-results/` (gitignored). Groq models need `GROQ_API_KEY`; OpenRouter models need `OPENROUTER_API_KEY` and are skipped without it. `MONI_BENCH_RUNS=1` shortens a run and `MONI_BENCH_MODELS=qwen,glm` keeps only matching models. Free-tier Groq hits per-minute token limits, so a full run takes 10 to 20 minutes; the bench waits out 429s and reports them in their own column instead of as failures.

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

See [docs/AI.md](../../docs/AI.md) for latency/cost/rate-limit analysis. Short version: live UX flows (text, receipts) use the fastest models with tight retry windows and fail fast to `unavailable` (the mobile queue retries); notification processing tolerates longer 429 waits; chat analysis favors concise prose over speed.
