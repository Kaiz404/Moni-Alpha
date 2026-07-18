# Moni

Local-first, privacy-focused personal finance app. Track wallets and transactions, and let AI turn natural language, receipt photos, and (on Android) bank notifications into **reviewable transaction proposals** — nothing hits your ledger without your approval.

## How it fits together

- **`apps/mobile`** — Expo / React Native app, the primary client. Syncs directly to Supabase via Legend-State (offline-first, MMKV-persisted).
- **`apps/backend`** — Go + Gin AI gateway. Verifies your Supabase JWT, routes AI requests to Groq, returns structured extractions. Stateless — no DB access.
- **`apps/web`** — Next.js dashboard. Isolated from mobile; talks to Supabase through its own API routes. Deprioritized for now.
- **`packages/types`** — `@repo/types`: Zod schemas + inferred TypeScript types shared by mobile and web.
- **`supabase/`** — migrations, RLS policies, storage buckets.

Mobile and web never talk to each other; shared needs go through Supabase (data) or the Go backend (AI).

## Quickstart

```bash
pnpm install

# fill in env files (see docs/SETUP.md)
cp apps/mobile/.env.example apps/mobile/.env.local
cp apps/web/.env.example apps/web/.env
cp apps/backend/.env.example apps/backend/.env

pnpm dev                       # everything, or:
pnpm --filter moni dev         # mobile
pnpm --filter backend dev      # Go AI backend (:8080)
pnpm --filter web dev          # web dashboard (:3000)
```

Requires Node >= 18, pnpm 9, Go >= 1.26. Mobile needs a native dev client (`npx expo run:android` locally, or GitHub Actions for CI APKs) — Expo Go doesn't support the native modules. On Windows, build Android from WSL — see [apps/mobile/README.md](apps/mobile/README.md).

## Development workflow

`main` is releasable, but direct pushes are allowed. Normal work uses short-lived branches and PRs:

- Branches: `feat/<name>`, `fix/<name>`, or `chore/<name>`.
- Commits follow Conventional Commits (for example, `feat: add receipt scan`). PRs merge with merge commits and are deleted after merge.
- GitHub Actions runs lint, typechecks, and a debug Android build on every PR and push to `main`. These checks are advisory; investigate failures before the next release.
- Successful `main` and manually dispatched runs upload a debug APK for seven days. It is a development build and needs Metro; a standalone tester build comes later through Google Play Internal Testing. See [docs/SETUP.md](docs/SETUP.md#github-actions-android-ci).

## Documentation

| Doc                                              | Covers                                        |
| ------------------------------------------------ | --------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)     | System design, data flows, core decisions     |
| [docs/SETUP.md](docs/SETUP.md)                   | Environment setup, env vars, Google Maps keys |
| [docs/DATABASE.md](docs/DATABASE.md)             | Schema, RLS, sync columns, storage            |
| [docs/AI.md](docs/AI.md)                         | AI pipeline, model allocation, prompts, costs |
| [apps/backend/README.md](apps/backend/README.md) | Backend endpoints, auth, Cloud Run deploy     |

## Stack

|            |                                                                               |
| ---------- | ----------------------------------------------------------------------------- |
| Mobile     | Expo SDK 57, expo-router, Legend-State + MMKV, Uniwind (Tailwind), Reanimated |
| AI backend | Go 1.26, Gin, Groq (Llama 3.1/3.3 + Llama 4 Scout vision)                     |
| Data       | Supabase (Postgres, Auth with ES256 JWTs, Storage, Realtime)                  |
| Web        | Next.js 16 App Router, Tailwind, TanStack Query                               |
| Monorepo   | Turborepo + pnpm workspaces (Go integrated via package scripts)               |
