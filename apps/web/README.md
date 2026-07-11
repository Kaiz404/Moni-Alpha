# Moni — web dashboard

Next.js 16 App Router dashboard. **Isolated from the mobile app**: it serves its own pages through its own API routes (`src/app/api/**`) against Supabase, and nothing else consumes those routes. Currently deprioritized — mobile and the Go AI backend are the focus.

## Develop

```bash
pnpm --filter web dev   # http://localhost:3000
```

Env: copy `.env.example` to `.env` (Supabase URL + publishable key; secret key only for `scripts/create-test-user.mjs`).

## Structure

- `src/app/(auth)` — login/register (Supabase Auth, cookie sessions via `@supabase/ssr`)
- `src/app/(dashboard)` — overview, wallets, transactions
- `src/app/api/**` — REST route handlers validated with `@repo/types` Zod schemas
- `src/lib/supabase/` — browser/server/middleware clients (publishable key, RLS enforced)

## Scripts

```bash
node scripts/create-test-user.mjs [email] [password] [name]   # admin-creates a confirmed user
```
