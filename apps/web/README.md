# Moni web app

Next.js 16 App Router app with the same features as the phone app plus desktop-only ones. It is being rebuilt to the locked design: the handoff is [`docs/WEB.md`](../../docs/WEB.md) and the architecture and build order are [`docs/web/PLAN.md`](../../docs/web/PLAN.md).

## Develop

```bash
pnpm --filter web dev     # http://localhost:3000
pnpm --filter web test    # Vitest
pnpm --filter web build
```

Env: copy `.env.example` to `.env` (Supabase URL and publishable key only).

## Structure

- `src/proxy.ts`: refreshes the Supabase cookie session on every request and sends signed-out visitors on private paths to `/login?next=…`. The public paths are in `src/lib/routes.ts`.
- `src/lib/supabase/`: `client.ts` (browser) and `server.ts` (Server Components and route handlers), both typed with `@repo/types/database`.
- `src/app/auth/callback/route.ts`: the PKCE code exchange for Google sign-in and email links.

The web reads and writes Supabase directly under RLS, as the phone does, and never hard-deletes a synced row. Shared logic comes from workspace packages listed in `next.config.js` `transpilePackages`.
