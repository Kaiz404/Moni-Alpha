# Web app: monorepo, build, test and deploy tooling

Read-only audit of `/home/kaiz404/projects/moni` on 2026-11-19 (HEAD `1e67703`). It covers how packages are consumed, the apps/web keep/delete audit, testing and CI, deployment, the docs and rules that must change, and deepening candidates.

## Verdict

Rebuild `apps/web` from scratch inside the existing workspace slot. Keep only the Supabase SSR cookie plumbing, about 80 lines of it. Every `apps/web` file except the SSR clients fails the deletion test: deleting it removes nothing the new app needs, and its API routes actively corrupt the mobile sync model. Shared code should ship as **source-TS workspace packages**, the way `@repo/types` already does. Metro and Next both consume them today with no build step. The real risks are the React version split (19.2.3 vs 19.2.0) and the TypeScript split (6.0 vs 5.9).

---

## 1. Package consumption mechanics

### How packages are consumed today

- `packages/types/package.json` `exports` maps every subpath straight to `.ts` source (`".": "./src/index.ts"`, `"./wallet": "./src/wallet.ts"`, …). There is no `build` script and no `dist`. Its only script is `check-types: tsc --noEmit`.
- The imports inside the package are extensionless (`packages/types/src/index.ts`: `export * from './api'`). That works under `moduleResolution: Bundler` (`packages/types/tsconfig.json`) and does not work under Node's native type stripping. This matters for picking a test runner (section 3).
- pnpm links workspace packages as symlinks: `apps/mobile/node_modules/@repo/types -> ../../../../packages/types`. There is no `.npmrc`, so pnpm's default isolated linker is in use.

### Metro (mobile)

- It works today with no extra config. Mobile has 128 `@repo/types` imports under `apps/mobile/lib`, and `apps/mobile/metro.config.js` sets no `watchFolders`. Expo's `getDefaultConfig` (SDK 52 and later) detects the monorepo root and watches it. Metro honors `exports` by default.
- Jest follows the same path. `jest-expo` transforms `@repo/types` because the symlink resolves to a real path outside `node_modules`. Finance tests such as `apps/mobile/lib/finance/__tests__/spend-history.test.ts` already import it.
- **React pinning seam.** `apps/mobile/metro.config.js` overrides `resolveRequest` so that `react`, `react-dom` and `react-native` always resolve from `apps/mobile`. Its comment says this keeps `@legendapp/state` from picking up `react@19.2.0` from the web app. `apps/mobile/jest.config.js` does the same through `moduleNameMapper` for `react` and `react/jsx-*`. On mobile, a shared package that imports `react` therefore gets the mobile copy whatever pnpm links.

### Next.js (web)

- `apps/web/next.config.js` has `transpilePackages: ['@repo/types']`. A new shared package must be added to that list, or Next must be configured with a wildcard. Next 16 builds with Turbopack by default. The list is still the documented switch for workspace TS and costs nothing.
- **There is no React pin on web.** Next resolves `react` from the importing file's real path. For a shared package that is `packages/<x>/node_modules/react`, whatever pnpm linked there.

### React versions: the dual-React risk

| | React | react-dom | @types/react | TypeScript |
|---|---|---|---|---|
| `apps/mobile/package.json` | `19.2.3` exact | `19.2.3` | `~19.2.10` (19.2.14 installed) | `~6.0.3` |
| `apps/web/package.json` | `^19.2.0` (lock: 19.2.0) | `^19.2.0` | `19.2.2` | `5.9.2` |
| root, `packages/types` | — | — | — | `5.9.2` |

`node_modules/.pnpm` holds both `react@19.2.0` and `react@19.2.3`, and two copies of `@tanstack/react-query@5.90.21`, one per React version.

**Rule for any shared package that touches React:** declare `react` as a `peerDependency`, and put it in `devDependencies` at the exact version both apps use. **Bump web to `react`/`react-dom` `19.2.3` exact and `@types/react` `~19.2.10`.** One version in the store means a single copy for every resolver. After that, the Metro pin stops being load-bearing for web contamination. Keep it anyway for `@legendapp/state`. If a hook package is shared, this is the difference between working and an "Invalid hook call" from two Reacts in the web bundle.

The preferred shape is still **React-free shared packages**: pure TS domain logic, Zod schemas and formatters. Each app writes its own thin React **adapter**. The mobile data layer is Legend-State, MMKV and synced observables (`apps/mobile/lib/store/index.ts`), which is not portable to web anyway. Web needs its own store adapter whatever happens.

### The TypeScript split

Mobile type-checks shared source with **TS 6.0** (`apps/mobile/tsconfig.json` sets `ignoreDeprecations: "6.0"` for `baseUrl`). Web and `packages/types` use **5.9.2**. Because `exports` points at `.ts`, each app's `tsc` also checks the shared source. Code must therefore compile under both compilers. Today it does: `pnpm check-types` runs in CI. Aligning the repo on 6.0 is optional. It is cheap to do with the web rebuild (root `package.json`, web and `packages/*`).

### Can one TS config serve shared packages for RN and DOM?

Yes, but not `base.json` as it stands. `packages/typescript-config/base.json` sets `lib: ["es2022", "DOM", "DOM.Iterable"]` and `module/moduleResolution: NodeNext`. DOM in `lib` lets shared code reference `window` or `document` and still type-check, then crash on Hermes. NodeNext would demand `.js` extensions that Metro and the existing package don't use. `packages/types/tsconfig.json` already overrides to `Bundler`.

**Add `packages/typescript-config/shared.json`:** extends base, sets `lib: ["es2022"]` (no DOM), `module: ESNext`, `moduleResolution: Bundler`, `noEmit: true`. Every platform-free package uses it. The compiler then enforces the platform-free promise, so no lint rule is needed. Leave `nextjs.json` for web. `react-library.json` (`jsx: react-jsx`, DOM lib) fits only a DOM-only UI package.

### Can one ESLint config serve both?

For pure-TS shared packages, yes: `@repo/eslint-config/base` (`packages/eslint-config/base.js`: TS recommended, prettier, turbo env rule) has no React, DOM or RN assumptions. `packages/types` has no `lint` script today. Add one. Three caveats:

- `base.js` loads `eslint-plugin-only-warn`, which turns every error into a warning. Web lints with `--max-warnings 0`, so web fails anyway. Mobile uses its own `eslint-config-expo` stack (`apps/mobile/eslint.config.js`) and never extends `@repo/eslint-config`. Shared packages should lint with `--max-warnings 0` too.
- `packages/eslint-config/package.json` pins `@next/eslint-plugin-next ^15.5.0` against `next 16.1.5`. Bump it with the rebuild.
- `next.js` and `react-internal.js` duplicate `js.configs.recommended`, prettier and tseslint, which are already in `baseConfig`. This is harmless.

A `no-restricted-imports` ban on `react-native`, `expo-*`, `next/*` and `react-dom` in the shared config would catch platform leaks. The `lib: es2022` tsconfig already catches DOM globals. The ban covers module imports.

---

## 2. `apps/web` audit (keep / delete)

### What exists (about 3,000 lines)

- Pages: `/` (`src/app/page.tsx`: "Sign in / Create account" card), `/login`, `/register`, `/dashboard` (overview stat cards), `/dashboard/wallets`, `/dashboard/transactions`. The README and the cursor rule describe `(auth)`/`(dashboard)` route groups plus `analytics/`, `settings/`. **None of those exist**, so the docs are already wrong.
- API routes (`src/app/api/**`): `auth/{login,register,logout,profile}`, `wallets`, `wallets/[id]`, `transactions`, `transactions/[id]`, `categories`, `tags`, `analytics/overview`, and `src/app/auth/callback/route.ts` (OAuth/PKCE code exchange).
- Lib: `supabase/{client,server,middleware}.ts`, `api/{client,errors,middleware}.ts`, `query/query-client.tsx`, `auth/auth-context.tsx`, `hooks/use-*.ts`, `database.types.ts` (942 lines).
- Styling: hand-written `globals.css` (433 lines) and `page.module.css` with Inter and Geist fonts. **No Tailwind**, although the cursor rule says "Standard Tailwind CSS" and `cn()` from `@/lib/utils`, which doesn't exist.
- `public/` contains only Turborepo and Vercel starter SVGs.

### How stale it is

- **Schema.** `src/lib/database.types.ts` has 8 public tables. `supabase/migrations/` (33 files, latest `20261116000000`) has 14. Missing: `ai_insights`, `auto_add_rules`, `category_budgets`, `debts`, `debt_activities`, `merchant_aliases`, `proposed_transactions`, `recurring_overrides`. It also bundles the whole `storage` schema.
- **Sync model (a correctness bug, not just staleness).** None of the route handlers mention the `deleted` soft-delete column (`20260707000000_legend_state_prep.sql`), so they list rows the phone has deleted. `src/app/api/transactions/[id]/route.ts:168` hard-`.delete()`s rows. Mobile's Legend-State sync relies on soft deletes and `last-sync` tracking (`docs/ARCHITECTURE.md` line 29), so a hard delete from web would never reach a phone's cache.
- **Money and locale.** `src/app/dashboard/page.tsx` prints `$` with `toLocaleString('en-US')`. Moni is RM-first, and `@repo/types` has `formatMoney` and minor units (`packages/types/src/money.ts`).
- **Design.** Nothing matches the Cream & Capsule system, Funnel Display, tokens, the mascot, or the web-r1 locked design.
- **Build.** The last recorded `next build` failed: `apps/web/.turbo/turbo-build.log` (28 Sep) shows "Error occurred prerendering page /login … exiting the build". CI runs `lint` and `check-types` but never `build`, so the failure went unnoticed. Root `pnpm dev` excludes web (`"dev": "turbo run dev --filter=!web"`).
- **Next 16.** `middleware.ts` is the deprecated name. Next 16 renamed it to `proxy.ts`.

### Keep / delete (the deletion test)

| File(s) | Verdict | Why |
|---|---|---|
| `src/lib/supabase/server.ts` (cookie branch), `src/lib/supabase/middleware.ts` (`updateSession` with `getClaims()`), `src/lib/supabase/client.ts` | **Keep, move into the new app** | This is the standard `@supabase/ssr` pattern. It uses the publishable key correctly, with no secret key in the browser. Rename `middleware.ts` to `proxy.ts` and rewrite the path lists for the new routes. Drop the Bearer-token branch in `server.ts`: it existed so mobile or curl could call web's API, which is now off-model. |
| `src/app/auth/callback/route.ts` | **Keep** (about 30 lines) | Needed for the Google OAuth and PKCE exchange. Mobile signs in with Google, and `supabase/config.toml` already lists `http://localhost:3000/auth/callback`. |
| `next.config.js`, `tsconfig.json`, `eslint.config.js`, `.env.example`, `package.json` | **Keep, edit** | Thin. Bump React and types, add shared packages to `transpilePackages`, add test scripts. |
| `src/app/api/**` (all 12 route files, about 1,200 lines) | **Delete** | These are shallow pass-through modules: auth check, Zod parse, a PostgREST call, then field renaming. The interface is nearly as wide as the implementation. RLS already enforces ownership, so a browser or server client against Supabase directly does the same job with less code. They also violate the soft-delete model. Deleting them loses nothing. |
| `src/lib/api/*`, `src/lib/hooks/*`, `src/lib/query/*`, `src/lib/auth/auth-context.tsx` | **Delete** | They exist only to call the deleted routes. The auth context duplicates what the SSR session gives. |
| `src/lib/database.types.ts` | **Delete** | Stale. If generated DB types are wanted, run `supabase gen types` once into a shared package (see deepening candidate D). |
| All pages, `globals.css`, `page.module.css`, `fonts/Geist*`, `public/*.svg` | **Delete** | Off-design, `$` formatting, and starter assets. |
| `scripts/create-test-user.mjs` | **Delete** | The dev Supabase project and mobile's e2e seed (`apps/mobile/scripts/e2e/`) already cover test data. It is also the only consumer of `SUPABASE_SECRET_KEY` in web. |

**Is it simpler to rebuild from scratch?** Yes. About 120 of roughly 3,000 lines survive. Do it as `git rm -r apps/web/src apps/web/public apps/web/scripts`, then lay out the new app tree in the same `web` package slot. That keeps the workspace name, `pnpm --filter web`, the lockfile entry and the CI wiring.

---

## 3. Testing and CI

### Today

- **Mobile.** `apps/mobile/package.json` `test` = `node --test scripts/lint/*.test.mjs scripts/e2e/*.test.mjs && jest --runInBand`. Jest is 29 with the `jest-expo` preset (`apps/mobile/jest.config.js`), and `TZ` is pinned to `Asia/Kuala_Lumpur`. Maestro flows run on device through the `moni-device` skill.
- **Backend.** `go test ./...`, wired through `apps/backend/package.json`.
- **Web.** Nothing: no test script and no runner.
- **packages/types.** No tests and no lint script.
- **Turbo.** `turbo.json` `test` has `dependsOn: ["^build"]`, which is a no-op because no package has a build. The `build` task's `inputs` include `.env*`, but `NEXT_PUBLIC_*` is not declared as `env`. The `turbo/no-undeclared-env-vars` rule only warns, so turbo's build cache can serve a web build compiled against a different Supabase project.
- **CI.** `.github/workflows/ci.yml` runs three advisory jobs on PRs and `main`:
  - `quality`: `pnpm lint`, `pnpm check-types`, and the mobile custom lints
  - `test`: `pnpm test`
  - `android-debug`

  Web is covered by `lint` and `check-types` only. No job runs `next build`.

### Recommendation

- **Shared packages: Vitest.** It runs extensionless ESM TS with zero config and needs no Babel. It doesn't touch the RN or Hermes transform. Its API is jest-compatible: of the 25 files in `apps/mobile/lib/finance/__tests__`, only 2 use `jest.fn/mock/spyOn/useFakeTimers`, so porting tests along with moved code is mechanical (`vi.*`). Each package gets `"test": "vitest run"`, which `turbo run test` and therefore CI's existing `pnpm test` job pick up with no workflow edit.
  - Rejected: `node --test` with type stripping. The extensionless imports in `packages/types/src/index.ts` break it.
  - Rejected: running shared tests inside mobile's jest by adding a `roots` entry. The tests would only run under the RN preset and would hide DOM or Node assumptions.
  - Set `TZ=Asia/Kuala_Lumpur` in the Vitest config wherever date logic moves, to match mobile.
- **Web: Vitest** for unit tests of web adapters. Add **Playwright** later for the key flows: sign-in, the deletion page, a Home render. Playwright's screenshots can also match the web-r1 board renders at 1440 px.
- **CI additions** for the same change:
  - a `pnpm --filter web build` step in `quality`, with dummy `NEXT_PUBLIC_SUPABASE_*` as repo variables, so the `/login` prerender class of failure is caught
  - `env: ["NEXT_PUBLIC_*"]` on the turbo `build` task

---

## 4. Deployment

### Current hosting

- The backend runs on **Cloud Run** `asia-southeast3`, auto-deployed by the Cloud Build trigger through `cloudbuild.yaml` (`apps/backend/README.md` §Deploy).
- `render.yaml` (Render free, Singapore, `moni-ai-backend`) is a **leftover**: the docs name only Cloud Run. It fails the deletion test, so delete it in the same change.
- `eas.json` holds mobile builds only.
- `supabase/config.toml` sets `site_url = "http://localhost:3000"` and `additional_redirect_urls` includes `localhost:3000/auth/callback`.

### Hosting options for web

| Option | Fit | Cost / caveats |
|---|---|---|
| **Vercel** | Native Next 16 support: Turbopack builds, `proxy.ts`, ISR, image optimization, preview deploys per push, and monorepo root detection with `pnpm --filter web build`. Least config. | The Hobby plan's terms forbid commercial use, and Moni intends a paid tier, so it needs Pro (about $20/mo) at launch. Pick region `sin1` (Singapore) to sit near Supabase and Malaysian users. |
| **Cloud Run** (beside the backend) | One cloud, one bill, scale-to-zero, the existing Cloud Build trigger pattern, and `asia-southeast3` near users. | Needs `output: 'standalone'` in `next.config.js`, a Dockerfile that runs `pnpm deploy`/turbo prune from the monorepo root (the backend's build context is `apps/backend` only), a second `cloudbuild` trigger filtered to `apps/web/**` and `packages/**`, and a CDN or cache for static assets. Cold starts hit the landing page. No preview deploys. |
| **Render** | Possible, with the same Docker story. | The free tier sleeps after idle with about 30 s cold starts, which is unacceptable for a landing page the stores link to. No reason to bring it back. |

**Recommendation: Vercel for web** with a `sin1` function region. Keep the backend on Cloud Run. The web app holds no secrets beyond the publishable key and makes no backend-shaped calls, so the second vendor adds little operational surface. Revisit Cloud Run only if Vercel cost or the commercial terms bite.

### Env vars

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the publishable `sb_publishable_…` key, safe in the browser. RLS enforces ownership.
- `NEXT_PUBLIC_AI_API_URL`, if web calls the Go backend for Moni chat or extraction. The backend authenticates with the user's Supabase JWT, which the browser client holds, so it needs no server secret. The backend must then allow the web origin through **CORS**. Check `apps/backend` for a CORS middleware before shipping web chat.
- `SUPABASE_SECRET_KEY`: **none in the web app** after `create-test-user.mjs` is deleted. Per `project-overview.mdc` and `docs/SETUP.md` (secret key "server-side scripts only"), it must never be `NEXT_PUBLIC_`.
- After the first deploy:
  - set Supabase Auth `site_url` to the production web origin
  - add `https://<web>/auth/callback` to the redirect URLs, both in the dashboard and in `config.toml` for local
  - add the web origin to the Google OAuth web client's authorized JavaScript origins and redirect URIs (`docs/SETUP.md` §Google)

### Landing page and account deletion (issue #56)

Issue #56 needs two things: in-app deletion on mobile and web under Profile › Privacy and data, and a **public web URL** for the Play listing. Two pieces of tooling matter:

- **Where the delete runs.** The delete needs admin rights: removing the `auth.users` row and the storage objects in the `receipts` bucket (`20260323000000_storage_receipts_bucket.sql`). Three placements are possible:
  - A Next route handler with `SUPABASE_SECRET_KEY` would put a secret in web. It would also make mobile call web, which breaks "mobile and web never talk".
  - The Go backend is ruled out because it is stateless with "no database access" (`docs/ARCHITECTURE.md` line 33).
  - **Recommended: one Supabase Edge Function (`delete-account`)**, called with the user's JWT by both clients. The secret stays in Supabase's function env, and both clients share one **seam**. A SECURITY DEFINER SQL RPC could delete the rows and the `auth.users` row. Supabase blocks deleting storage objects through SQL, so the receipts need the Storage API, which favors the Edge Function.
- **The public page.** `/delete-account` on web is a public route: it explains what is deleted and offers sign-in, then Export, typed confirmation, and a call to the function. It must be in the `proxy.ts` public-path list next to `/`, `/privacy` and `/terms`. A signed-in `/settings/privacy` reuses the same flow. The landing page (`BRIEF-LANDING.md`) is also public and static, so give it a `(marketing)` route group rendered statically. Keep it out of the `(app)` group that the session proxy guards.

---

## 5. Docs and rules that become false (change them in the same change)

`.cursor/rules/docs-maintenance.mdc` says: "If a cursor rule … states something this change makes false, fix the rule too." These become false:

| File | False statement | Becomes |
|---|---|---|
| `.cursor/rules/web-nextjs.mdc` | Whole file: "The web app is isolated. Its API routes serve only its own dashboard…", "deprioritized", a directory tree with `(auth)`/`(dashboard)`/`analytics`/`settings`, the "authenticate → validate → query → respond" API route pattern, `withAuth` at a nonexistent `@/lib/api-middleware.ts`, `src/lib/errors.ts`, "Standard Tailwind… `cn()` from `@/lib/utils`" | Rewrite for the new structure: route groups, Supabase direct with RLS and soft deletes honored, shared packages, tokens, `proxy.ts`, and testing |
| `.cursor/rules/project-overview.mdc` | `apps/web/ Next.js 16 dashboard — ISOLATED, deprioritized`. "Mobile and web never talk to each other. Web's API routes serve only the web dashboard." | Web is a first-class Supabase client sharing `packages/*`. Keep "never talk to each other" (still true) and drop the API-routes clause. Add the new packages to the tree. |
| `.cursor/rules/shared-types.mdc` | Example uses `currency default('USD')`, `initialBalance: z.number()`, `amount: z.number().positive()` | These predate `MinorAmount`. Fix them while touching the package (`packages/types/src/money.ts`). |
| `AGENTS.md` rule map | Lists only the current globs | Add a glob → rule entry for each new `packages/*` |
| `docs/ARCHITECTURE.md` | Line 3 "an isolated Next.js dashboard". Diagram node `web[Next.js dashboard isolated]` with `web <-->|"own API routes"| supa`. Line 32 "self-contained dashboard with its own API routes". Line 82 "isolated, deprioritized". Line 66 says sessions are cookies on web, which stays true. Hosting line 96 names only Cloud Run. | Web is a Supabase client like mobile, sharing domain packages. Add web hosting. Add the delete-account Edge Function. |
| `docs/SETUP.md` | §`apps/web/.env` lists `SUPABASE_SECRET_KEY`. The CI paragraph (line 228) lists three jobs with no web build. | Drop the secret, add `NEXT_PUBLIC_AI_API_URL` if used, document the web build in CI and the Vercel setup |
| `apps/web/README.md` | "Isolated from the mobile app… its own API routes… deprioritized", a nonexistent `(auth)`/`(dashboard)` structure, the create-test-user script | Rewrite |
| `README.md` (root) | Line 9 "Isolated from mobile; talks to Supabase through its own API routes. Deprioritized for now." Line 60 claims Tailwind on web. | Update |
| `render.yaml` | Describes a Render deploy that is no longer used | Delete |
| `package.json` (root) | `"dev": "turbo run dev --filter=!web"` | Decide whether web joins `pnpm dev` |

---

## 6. Deepening candidates

**A. Platform-free domain package (`packages/finance` or similar).** `apps/mobile/lib/finance/` has 28 modules. Only 4 import platform or store code (`selectors.ts`, `integrity.ts`, `main-currency.ts`, `projection.ts`). The other 24, among them `budget-month.ts`, `chart-ticks.ts`, `calendar-heat.ts` and `bills.ts`, are pure functions with jest tests. Move the pure ones into a source-TS package (`exports` → `.ts`, `shared.json` tsconfig, Vitest) and leave the Legend selectors in mobile as the **adapter**. Locality improves: both apps compute "safe to spend" or the budget month one way. The web store adapter (TanStack Query or a small store over Supabase) feeds the same pure functions. Without this, the web rebuild re-derives every number the boards show. Files: `apps/mobile/lib/finance/*`, `apps/mobile/lib/dates/*`, `packages/types/src/money.ts`.

**B. Design tokens as one module with two outputs.** Token values live only in `apps/mobile/global.css`, in uniwind `@variant light/dark` blocks. `apps/mobile/scripts/tokens/gen-theme-tokens.mjs` already parses them into `constants/theme-tokens.generated.ts`, and `lint:tokens` guards drift in CI. Two changes:
- Move the source of truth to `packages/tokens`: a CSS or JSON file holding the values.
- Have the generator emit the mobile TS, the mobile CSS `@theme` block, and a plain-CSS or Tailwind v4 `@theme` file for web. The web side uses `prefers-color-scheme` or a `[data-theme]` selector, because uniwind's `@variant light` is not standard Tailwind.

Leverage: one edit re-themes both apps, and the existing `--check` mode keeps CI honest. Without this, web would hand-copy hex values from `docs/redesign/tokens.md`.

**C. One account-deletion seam.** A `supabase/functions/delete-account` Edge Function is called by mobile Profile and by web `/delete-account` and settings. This is the only place a secret key runs for user-initiated actions. It passes the deletion test the other way: without it, two clients would each grow their own partial delete. It closes issue #56 for both stores. Files: new `supabase/functions/`, `apps/mobile/app/profile.tsx`.

**D. Generated DB types in a shared spot (optional).** The web's stale `database.types.ts` shows that copied DB types rot. If web reads Supabase directly, a single `supabase gen types typescript` output in `packages/types` (or `packages/db`), regenerated by a script and checked in CI the way `lint:tokens` is, gives both clients typed PostgREST calls. Mobile's Legend sync plugin could use them too. Skip it if the Zod row parsers in `@repo/types` already cover every read web makes.

### Tooling checklist for the rebuild change

1. Delete `apps/web/src`, `apps/web/public` and `apps/web/scripts`. Keep and move the SSR client files and `auth/callback`. Rename `middleware.ts` to `proxy.ts`.
2. In `apps/web/package.json`, pin `react`/`react-dom` `19.2.3` and `@types/react ~19.2.10`. Add `vitest` and a `test` script.
3. Add `packages/typescript-config/shared.json` (no DOM, Bundler). Give shared packages `lint` (`@repo/eslint-config/base`, `--max-warnings 0`), `check-types` and `test` (Vitest).
4. Add each new package to `transpilePackages`. Metro needs nothing.
5. Add `env: ["NEXT_PUBLIC_*"]` to the turbo `build` task. Add a web `build` step to `ci.yml`.
6. Delete `render.yaml`. Rewrite the rule and docs rows from section 5 in the same commit.
