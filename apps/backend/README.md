# Moni AI Backend (Go + Gin)

Stateless inference gateway: receives AI requests from the mobile app, routes them to [OpenRouter](https://openrouter.ai), and returns normalized transaction extractions. It never touches the database — the mobile client decides on-device whether to insert a `proposed_transactions` row for review or, for routine notifications, a transaction directly.

## Endpoints

All `/v1` routes require `Authorization: Bearer <supabase-user-jwt>`.

| Method | Path                       | Purpose                                          | Model                          |
| ------ | -------------------------- | ------------------------------------------------ | ------------------------------ |
| GET    | `/health`                  | Liveness (no auth), always 200; `authKeys` is `loaded` or `loading`. `/healthz` answers the same locally, but Cloud Run's frontend keeps that path and returns 404 | —           |
| POST   | `/v1/extract/text`         | Transaction from free text                       | `deepseek/deepseek-v4.1-flash` |
| POST   | `/v1/extract/image`        | Transaction from receipt image (base64 or URL)   | `deepseek/deepseek-v4.1-flash` |
| POST   | `/v1/extract/notification` | Transaction from Android notification            | `deepseek/deepseek-v4.1-flash` |
| POST   | `/v1/chat/analyze`         | Concise finance Q&A from pre-aggregated snapshot | `deepseek/deepseek-v4.1-flash` |

Extraction responses are a discriminated union: `{ status: "ok", extraction }`, `{ status: "skipped", reason }`, or `{ status: "unavailable", reason }`. Chat analyze returns `{ status: "ok", reply, modelId }` or `{ status: "unavailable", reason }`. Errors use `{ error, details? }`. The wire contract mirrors `apps/mobile/lib/ai/client/types.ts`.

## Auth

Supabase signs user access tokens with an asymmetric ES256 key. The backend verifies them statelessly against the project JWKS (`$SUPABASE_URL/auth/v1/.well-known/jwks.json`) with a 15-minute key cache — no shared JWT secret, no Supabase round-trip per request. A per-user in-memory token bucket (20 req/min, burst 8) protects the shared OpenRouter credit.

An unreachable JWKS does not stop the process. This matters when a free-tier Supabase project pauses and its hostname stops resolving ([docs/SETUP.md](../../docs/SETUP.md#supabase)).

- Startup waits at most 5s for the first fetch, then starts the server either way. A healthy cold start therefore serves its first request with keys.
- A background loop retries from 2s, doubling up to 60s, until a fetch returns at least one key. After that the JWKS cache refreshes on its own and keeps the last good keys when a refresh fails.
- Until keys load, a `/v1` request with a bearer token gets `503 { "error": "Auth keys are not loaded yet", "details": { "retryAfterSeconds": 30 } }` and `Retry-After: 30`. No request reaches a handler without a verified token (`internal/auth/keys_test.go`). The mobile client reads a 503 as `unavailable` and keeps the capture queued.

## Run locally

```bash
cd apps/backend
cp .env.example .env   # fill in SUPABASE_URL + OPENROUTER_API_KEY
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

`go test ./...` is offline: `cmd/server/router_test.go` drives every endpoint through the real router (`newRouter`) with a local JWKS (`internal/auth/authtest`) and a fake OpenRouter server, covering auth, validation, `ok`/`skipped`/`unavailable`, the retry and the per-user rate limit.

`pnpm test:live` (or `MONI_LIVE_TESTS=1 go test ./cmd/server -run Live -v`) calls the real OpenRouter API with `.env`'s `OPENROUTER_API_KEY`: it checks OpenRouter still serves `llm.Model` (`internal/llm/models.go`), then extracts from text, four notifications, the `cmd/server/testdata/receipt.png` receipt, and answers a chat question. Run it after changing models, prompts or keys.

`pnpm bench:llm` compares candidate models on accuracy, latency and cost. It runs 29 labelled cases (11 text, 14 notifications, 4 receipts in `internal/extract/testdata/bench/`) through the production `extract.Service`, once per model in `benchTargets` (`internal/extract/bench_test.go`), and writes a scorecard to `bench-results/` (gitignored). Groq models need `GROQ_API_KEY`; OpenRouter models need `OPENROUTER_API_KEY` and are skipped without it. `MONI_BENCH_RUNS=1` shortens a run and `MONI_BENCH_MODELS=qwen,glm` keeps only matching models. Free-tier Groq hits per-minute token limits, so a full run takes 10 to 20 minutes; the bench waits out 429s and reports them in their own column instead of as failures.

## Deploy (Google Cloud Run)

Scale-to-zero keeps this free/cheap at ~1000 users; the app tolerates cold starts because AI work is queued on-device.

```bash
gcloud run deploy moni-ai-backend \
  --source apps/backend \
  --region asia-southeast3 \
  --allow-unauthenticated \
  --set-env-vars SUPABASE_URL=https://<project-ref>.supabase.co \
  --set-secrets OPENROUTER_API_KEY=openrouter-api-key:latest \
  --memory 256Mi --cpu 1 --max-instances 1
```

(`--allow-unauthenticated` is required because the app does its own JWT auth; store `OPENROUTER_API_KEY` in Secret Manager.)

`asia-southeast3` (Bangkok) is a Tier 1 region, the cheapest one near Malaysia (Kuala Lumpur isn't available on Cloud Run). `--max-instances 1` keeps the in-memory rate limiter correct.

The live service runs with min instances 0, max 1, concurrency 20, a 300s request timeout, 1 CPU with startup boost and 256 MiB. Its startup probe is TCP on 8080, so no health path is configured. A cold start took about 1.2s from instance start to listening (10 Nov 2026). Check a deployed service with `GET /health`; Cloud Run's frontend answers `/healthz` itself with a 404 that never reaches the container.

After the first deploy, pushes to `main` that touch `apps/backend/**` redeploy automatically: the `Moni-Backend` Cloud Build trigger runs the root `cloudbuild.yaml`, which builds this Dockerfile and runs `gcloud run deploy --image`, keeping the env vars and secret above.

Then set `EXPO_PUBLIC_AI_API_URL` in `apps/mobile/.env` to the Cloud Run URL.

## Model allocation rationale

See [docs/AI.md](../../docs/AI.md) for latency/cost/rate-limit analysis. Short version: live UX flows (text, receipts) use the fastest models with tight retry windows and fail fast to `unavailable` (the mobile queue retries); notification processing tolerates longer 429 waits; chat analysis favors concise prose over speed.
