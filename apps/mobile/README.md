# Moni — mobile app

Primary Moni client: Expo SDK 54 + expo-router, offline-first via Legend-State observables synced directly to Supabase (MMKV persistence).

## Develop

```bash
pnpm install                # repo root
pnpm --filter moni dev      # Metro / Expo
pnpm --filter moni android  # native dev client (required — Expo Go won't work)
```

Env: copy `.env.example` to `.env` (Supabase publishable key, AI backend URL, Google web client ID — see [docs/SETUP.md](../../docs/SETUP.md)).

## Map

| Path | Role |
| --- | --- |
| `app/` | expo-router routes: `(auth)`, `(tabs)` (Wallets / Summary / Moni Agent / Profile), `(routes)` (wallet, transaction, budget, notifications, debug) |
| `lib/store/` | Legend-State synced observables — the data layer |
| `lib/supabase/` | Supabase client (publishable key) + CRUD helpers over the store |
| `lib/auth/` | Auth context (email/password + native Google Sign-In) |
| `lib/mmkv/` | MMKV instances: auth session, store cache, upload queue |
| `lib/ai/` | Processing queue, background processor, AI client (HTTP ↔ Go backend, mock fallback) |
| `lib/notifications/` | Deterministic notification prefilter (shared with headless task) |
| `lib/receipts/` | Local receipt image save + Storage upload queue |
| `index.js` | Android headless notification listener (registered before expo-router) |

## AI

Input (chat text, receipt photo, notification) → MMKV queue → background processor → Go backend (`EXPO_PUBLIC_AI_API_URL`) → `proposed_transactions` → review modal. Details: [docs/AI.md](../../docs/AI.md).

**Transfers:** manual entry via New Transaction → Transfer (from/to wallet pickers), or natural language in Moni Agent (e.g. "transfer 200 from Cash to Maybank"). Transfers are excluded from income/expense analytics.

## Tests

```bash
pnpm --filter moni test:notification-detection   # 1000-case prefilter suite
npx tsc --noEmit                                 # typecheck (run in apps/mobile)
```
