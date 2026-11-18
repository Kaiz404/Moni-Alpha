# Prompt: build the Moni web app

Copy everything below the line into a new agent session started in the repository root (`/home/kaiz404/projects/moni`).

---

You are building Moni's web app and the shared packages it needs, in this Turborepo + pnpm monorepo. Moni is a personal finance app with a mature Expo phone app (`apps/mobile`) and a Go AI gateway (`apps/backend`), backed by Supabase. The web app's design is locked; your job is to implement it on shared logic so that nothing is written twice except the views.

## Owner decisions (made 19 Nov 2026)

- Data layer: **Option C.** The web shares the phone's Legend-State store through `createMoniStore({ supabase, persist })`; MMKV on the phone and IndexedDB (or memory at first) on the web are the persistence adapters.
- Hosting: **Vercel Pro in Singapore (`sin1`).** Ask the owner to create the Vercel project and set the environment variables when you reach deployment; never handle their account credentials yourself.

## Read first, in this order

1. `AGENTS.md`, then every `.cursor/rules/*.mdc` it lists as always-apply, and the rule for each area you touch (`mobile-expo.mdc`, `web-nextjs.mdc`, `shared-types.mdc`, `backend-go.mdc`). Where `web-nextjs.mdc` describes the old API-route pattern, `docs/web/PLAN.md` wins; you rewrite that rule in phase 0.
2. `docs/WEB.md`: the design handoff (canvas boards, layouts, rules, open owner decisions).
3. `docs/web/PLAN.md`: the architecture, the packages, the deep modules, the build order. This is your plan. Follow it; if the code proves a step wrong, say so with evidence and adjust, don't silently diverge.
4. `docs/web/explore/*.md`: the evidence, with file and line references.
5. `docs/redesign/tokens.md`, `docs/redesign/glossary.md`, `docs/REDESIGN.md`: values, words and the phone app's rules, which the web keeps unless `docs/WEB.md` says otherwise.
6. The canvas boards for each screen before you build it (`docs/WEB.md`, "Reading the canvas"). Match them closely; where a board is silent, design in the same style and list the gap in your report.

## How to work

- Work phase by phase from `docs/web/PLAN.md`. Each phase ends in a verifiable state; verify it before starting the next.
- Commit straight to `main` with conventional, descriptive messages, one logical change per commit, and push. No feature branches or PRs. Use git worktrees if you run parallel subagents, and land their commits on `main` yourself. Never add Co-Authored-By or "Generated with" lines to commits.
- When code moves into a package, migrate every caller and delete the old copy in the same change. No re-export shims, no compatibility layers, no duplicate implementations left behind.
- Keep the phone app working after every phase: its jest suites pass, `pnpm turbo check-types` and lint pass, and any screen a change could affect is proved on the device with the `moni-device` skill (Moni E2E build). Mobile behaviour must not change except the bug fixes the plan names.
- Tests call a module's interface with literal inputs and assert literal outputs. A test that would pass if the module returned `undefined` is not a test.
- Pushes touching `apps/backend/**` deploy to Cloud Run automatically. Make backend changes small, tested, and only in the phases that call for them. The linked Supabase project is the dev project: push migrations to it directly, and generate types from it.
- Update the docs in the same change as the code, per `.cursor/rules/docs-maintenance.mdc`. `docs/WEB.md`'s status line says what is built.
- Ask the owner only for the decisions listed in `docs/WEB.md` under "Open owner decisions" when you reach the phase that needs them; decide everything else yourself and report it.

## Phases (summary; details in PLAN.md)

0. Subtract and set up: rebuild `apps/web` from the kept auth files; pin React 19.2.3; shared tsconfig; Vitest; web build in CI; generated database types; fix the `wallet_balances` view; rewrite the stale web rules and docs.
1. `@repo/core` calendar and glossary, then ledger rules. Fix Moni chat counting debt repayments as spending (GitHub issue #68; test it; close it with `Fixes #68`).
2. `@repo/core` money month and read model.
3. `@repo/design` tokens and `@repo/brand`; mobile output generated with no visual change.
4. `@repo/data` and write plans; Edge Function `delete-account` and in-app deletion (GitHub issue #56).
5. `@repo/ai`: Zod wire contract with a golden fixture tested from TypeScript and Go; zero data retention (#55); AI consent gate (#57).
6. Web shell: auth (email, Google, QR sign-in via Edge Functions), sidebar, rail and phone layouts with the breakpoint switch, Ctrl K, toasts, motion.
7. Web screens: Home, Activity, Review, Budget, Debts, Where you spend, Moni chat, Settings and data.
8. Edges: landing page, public deletion page, onboarding, states and empty states, phone layout for every screen, privacy and terms pages.

## Verifying the web app

Drive the real app with Playwright for each screen and state the board shows, at 1440, 1024, 820 and 390 wide, and compare against the board renders in `~/.local/share/moni-canvas/web-r1/renders/` (or render the board yourself). Check keyboard paths (Ctrl K, N, /, J, K, A, X, L, Esc, Ctrl Z), reduce-motion, light and dark, and that crossing 700 px keeps the route and a half-typed field. Once the shell exists, generate a project verify skill (`/create-verification-skill`) and use it from then on.

## Reporting

After each phase, report in plain words: what changed for the user and for the next engineer, the commits, the tests and device or browser checks you ran with their results, any deviation from the boards or the plan and why, and the next phase. Report failures as failures, with the output.
