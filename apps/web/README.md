# Moni web app

Next.js 16 App Router app with the same features as the phone app plus desktop-only ones. It is being rebuilt to the locked design: the handoff is [`docs/WEB.md`](../../docs/WEB.md) and the architecture and build order are [`docs/web/PLAN.md`](../../docs/web/PLAN.md).

## Develop

```bash
pnpm --filter web dev     # http://localhost:3000
pnpm --filter web test    # Vitest
pnpm --filter web build
pnpm --filter web verify  # Playwright drive: every route, width and theme; last line PASS or FAIL
```

Env: copy `.env.example` to `.env` (Supabase URL, publishable key, and the phone app's URL scheme for the sign-in QR). The verify drive needs Chromium once (`npx playwright install chromium`) and reads the dev project's keys from `apps/mobile/.env.e2e`; see `.claude/skills/web-verify/SKILL.md`.

## Structure

- `src/proxy.ts`: refreshes the Supabase cookie session on every request, sends signed-out visitors on private paths to `/login?next=…`, and sends signed-in visitors on `/` and the sign-in pages to the app. The path lists are in `src/lib/routes.ts`.
- `src/lib/supabase/`: `client.ts` (browser) and `server.ts` (Server Components and route handlers), both typed with `@repo/types/database`.
- `src/app/auth/callback/route.ts`: the PKCE code exchange for Google sign-in and email links.
- `src/app/layout.tsx`: `@repo/design/tokens.css`, Funnel Display from `public/fonts/` (declared in `globals.css`; the build Google serves Chrome on Windows and Linux, which the boards render with, not the Mac build `next/font/google` fetches, which sets text about 5% wider), and two inline scripts that run before paint: the theme (`src/lib/theme.ts`, stored in `localStorage` as on the phone, light by default) and the layout (`src/lib/layout.ts`).
- `src/app/(auth)/login/…`: sign in and create account (one page, `?mode=create`), `forgot`, `verify` and `reset`, in `src/components/auth/`. Create account checks the 18+ rule with `@repo/types`. The QR panel (`qr-panel.tsx`, `src/lib/qr-sign-in.ts`) calls the `qr-start` and `qr-poll` Edge Functions, rotates the code, and finishes with `verifyOtp`.
- `src/app/delete-account/` and `src/app/(app)/settings/delete-account/`: Delete your account (issue #56), public for the Play listing and under Settings, both on `src/components/account/delete-account-form.tsx`. Signed out, the public page emails a sign-in link back to itself (`shouldCreateUser: false`, the same answer either way). The form calls the `delete-account` Edge Function with the browser's access token (`src/lib/account-functions.ts`, parsed with `@repo/types`), then `signOut` from `shell-store.ts`, the one sign-out path, and leaves for `/delete-account/done`. Export data has no web builder yet, so the page points to the phone's.
- `src/lib/moni-store.ts` and `src/components/store/store-sync.tsx`: the shared Legend-State store (`@repo/data`'s `createMoniStore`) on the browser client with `memoryPersist()`, one per tab. `StoreSync`, mounted in the `(app)` layout, observes every table and pulls the ledger once a session exists; `signOut` in `shell-store.ts` runs `signOutEverywhere`, which clears the store before ending the session. Read it with `useValue` from `@legendapp/state/react`, as `useWalletCount` (`src/lib/use-wallet-count.ts`) does for Home. `src/lib/__tests__/moni-store.live.test.ts` pulls the e2e user's wallets from the dev project (skipped without `apps/mobile/.env.e2e`).
- `src/app/(app)/…`: the signed-in app. Its layout reads the profile on the server and renders `Shell` (`src/components/shell/`). Each section is a page with its title and its W2-Empty empty state until its screen is built.

## The shell

- **One tree for every layout.** `src/lib/layout.ts` holds the breakpoints (phone under 700 wide or 500 tall, rail with one column to 1024, rail to 1360, sidebar beyond). It generates the media queries that show the sidebar, rail or tab bar (`data-only="…"`) and the script that sets `<html data-layout>`. Nothing remounts when the layout changes, so a half-typed field survives.
- **Where you are lives in the URL**: the route, and `?pane=chat|add` for the docked Moni chat and the Add drawer. Drafts and the open overlay live in `shell-store.ts`, as do toasts (one at a time; the Mint bar's end closes it, so pointing at it pauses both).
- **One list of places** (`src/lib/nav.ts`) feeds the sidebar, rail, tab bar, Ctrl K palette (`src/lib/commands.ts`), the G-then-letter keys and the shortcuts dialog (`src/lib/keys.ts`). Keys: Ctrl K, /, N, ?, Esc, Ctrl Z, G then H A B D R S. They rest while you type, except Ctrl K and Esc.
- **Motion** uses the shared spring curves (`--ease-*`, `--duration-*` from `tokens.css`); under `prefers-reduced-motion` panes and dialogs fade. The theme switch opens as a circle through view transitions.
- **Brand**: `src/components/brand.tsx` inlines `@repo/brand`'s SVG and wordmark strings. A page cat is drawn twice (Deep mint and Paper) and CSS shows the one for the theme. Icons are `@mdi/js` paths by the phone's kebab names (`src/lib/icons.ts`).

The web reads and writes Supabase directly under RLS, as the phone does, and never hard-deletes a synced row. Shared logic comes from workspace packages listed in `next.config.js` `transpilePackages`.
