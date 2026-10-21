# Wave 5 brief for screen tracks

Every Wave 5 agent reads this file before its PLAN.md sections. It holds the rules that every screen track shares. The track prompt names the units and the boards.

## Read first

1. `docs/redesign/PLAN.md`. Read the "Fast execution mode" section, the "Operator actions and owner decisions" list, and your units' sections in full.
2. `.cursor/rules/project-overview.mdc`, `docs-maintenance.mdc`, `mobile-expo.mdc`. If your track touches `apps/mobile/lib/notifications/**` or `apps/mobile/index.js`, also read `mobile-headless-js.mdc`. If it touches `packages/types/**`, also read `shared-types.mdc`.
3. `docs/REDESIGN.md`, especially "Rules that apply to every screen". Then `docs/redesign/tokens.md` and `docs/redesign/glossary.md`.
4. Your boards. Sources are at `~/.local/share/moni-canvas/artifact-files/project/<Board>.dc.html`. Renders are at `~/.local/share/moni-canvas/renders/r6/all/<Board>.png`. Board data in `renderVals()` is sample data, so never hardcode it.
5. Load the `expo-animation` skill before you write any gesture, spring, or sheet motion.

## What already exists on main

Use these. Do not rebuild them.

- Text and tokens. `components/ui/text.tsx` has ten variants. Colours live in `global.css`, and `pnpm --filter moni gen:tokens` regenerates the JS copy. Springs are in `lib/motion/tokens.ts`. Haptic moments are in `lib/haptics`.
- Chrome. `components/ui/page.tsx` has the header kinds `home`, `tabRoot`, `pushed`, `task`, and `bare`. Also use `press.tsx` (it requires a `TestId`), `button.tsx`, and `header-icon-button.tsx` (`HeaderIconButton`, `MoniButton`).
- Sheets. `openSheet(request)` in `lib/sheet/sheet-store.ts` supports the kinds `category`, `wallet`, `currency`, `walletType`, `notificationApp`, `date`, and `confirm`. The host components are in `components/ui/sheet/`. `PickerField` opens a picker sheet.
- Rows and states. `components/ui/` has `TransactionRow`, `HoldMenu`, `ListCard`, `ListSection`, `NavRow`, `Chip`, `Segmented`, `ProgressBar`, `StatusPill`, `Banner`, `SyncBanner`, `Skeleton`, `EmptyTile`, `NotFound`, and toasts (`showToast`).
- Data. G added main currency (`useMainCurrency`), `selectUpcomingBills`, `metadata.source` and `kind`, `createBalanceCorrection`, the Later status, auto-add rules, merchant aliases, `record_location`, and capture statuses. Tables gated on a migration throw on write until the migration exists. That is expected.
- Formatting. `lib/finance/format-money.ts` and `lib/dates/day-label.ts`.
- testIDs. Every control gets `tid(screen, ...parts)` from `lib/test-ids.ts`. The exempt list is empty, and CI fails on a control without a testID.

## Fences

Seven tracks run at the same time. Merge conflicts cost more than anything else here.

- Edit only the routes your units own, and put new components in `components/<area>/`.
- Edit `components/ui/**` only to fix a bug. Keep the fix small, and name it in your report. Build any new shared component inside your own area. The coordinator promotes it later.
- Add a value to the `Screen` union in `lib/test-ids.ts` only if your area has none yet. Keep that edit on one line.
- Do not edit `app/_layout.tsx` or `app/(tabs)/_layout.tsx` unless your unit section requires it.
- Docs: update `docs/DESIGN_SYSTEM.md` and `apps/mobile/README.md` only for the sections your screens own. Leave the status line in `docs/REDESIGN.md` to the coordinator.
- A data change outside what G landed goes schema first. Edit `packages/types`, then add the migration file (never push it), then the store. Name it in your report.

## Process

- Work in your worktree. Start at `origin/main` with `git fetch origin && git reset --hard origin/main`. Commit on your worktree branch in conventional style, one commit per verifiable step. Never push. Never add Co-Authored-By or "Generated with" lines.
- Toolchain. Run `source apps/mobile/scripts/device/env.sh`, then `pnpm install --frozen-lockfile`.
- Keep a `decisions.tsv` trail in the worktree root per `.claude/skills/show-me-your-work/SKILL.md`. Do not commit it.
- Owner decisions D1 to D11 have defaults in PLAN.md. Build the default, and list the affected spots in your report.

## Verification contract

- Run your units' **Verify, unit** boxes.
- Run `pnpm lint` (0 errors), `pnpm check-types`, and `pnpm test`.
- In `apps/mobile`, run `lint:copy`, `lint:test-ids`, `lint:unreferenced`, and `lint:tokens`.
- Write a Maestro flow for each screen under `apps/mobile/.maestro/flows/<area>/`. Run `maestro check-syntax` on it.
- Build the e2e APK once at your final commit with `apps/mobile/scripts/device/build-apk.sh`, so it is cached.
- Touch the phone only through `apps/mobile/scripts/device/with-device.sh`. Never touch `com.anonymous.moni`. Respect the hold file. If the phone is asleep or refuses an install, report "device check pending operator" and move on.
- When the phone works, save a screenshot of each screen next to its board render, at the same scroll position.

## Report

Keep it under 300 words. Give the worktree, the branch, and the commit SHAs. Say what each screen does against its board, and list every fence you crossed with the reason. Give the gate results, the Maestro flow paths, the cached APK path, and the decisions.tsv path. List the owner decisions you touched.
