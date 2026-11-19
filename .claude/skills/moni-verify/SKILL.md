---
name: moni-verify
description: The verification contract for any change to the Moni monorepo, run by agents without the owner. The static gate (types, lint, tests, mobile lints, Go vet, web build), render parity and the affected areas that prove the phone app did not change without the phone, screenshot parity on the phone for what they can't see, device evidence for changes that should show, and the web checks. Use before every commit, for "verify", "prove it", "is mobile unchanged", or when briefing a subagent.
---

# Verify a Moni change

A change lands on `main` only with the evidence below. Each step is a command whose last line says pass or fail; paste that line in the report. Never report a check you didn't run.

Prepend Node first in every shell: `export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"`.

## 1. Static gate, every change

```bash
scripts/verify/gate.sh          # check-types, lint, mobile custom lints, go vet, all tests, web build
scripts/verify/gate.sh --fast   # the same without tests and the web build, while iterating
```

The last line is `gate passed` or `gate FAILED: <checks>`, with each failing log's tail above it. A failure that exists on `main` before your change is still yours to fix or report; don't land on a red gate.

## 2. Prove the phone app in tiers, phone last

The phone is one device that one lane uses at a time, and a Maestro area takes 5 to 15 minutes on it. Prove what you can without it.

| Tier | When | Command | Cost |
| --- | --- | --- | --- |
| 1. Render parity | Every change, with the gate | `scripts/verify/render-parity.sh --base <before> --head <your commit>` | About a minute a commit, then cached |
| 2. Affected areas on the phone | The change is visual in ways render parity can't see (layout, colour from a class, motion, gestures, drawing, native), or it is large | `apps/mobile/scripts/device/parity.sh --base <before> --head <your commit> --affected` | 5 to 15 minutes an area it reaches |
| 3. Every area on the phone | Before a preview build for the owner, or a change too large to trust tiers 1 and 2: design tokens, navigation, native modules, the app config | `parity.sh` with no areas | Every area |

A change should show (an issue fix, a feature) or should not (a refactor, moving code into `packages/*`). Both run the same tiers. A change that should show also needs device evidence for the screens it changes (below). A change that touches no phone code (`apps/web`, docs, `apps/backend` only) prints `areas: none` from `affected.mjs`; say so.

### 1. Render parity

Commit first; it compares commits. It mounts every route in `apps/mobile/__tests__/routes.test.tsx` at both commits (full and empty seed, light and dark, the pinned clock) and diffs what each showed: text, testIDs, labels, roles, selected state, `className`, icon names, and colour and font styles. Each route prints `same` or its changed lines, and the last line is `render-parity same …` or `render-parity CHANGED …`. Explain every changed line. A change the task names as intended is fine (say which); any other change is a regression to fix.

It sees each route's first screen only. A sheet, a second step, a pressed state, a chart's drawing, an animation, and how a class lays out are invisible to it.

### 2. Which areas, then the phone

```bash
node scripts/verify/affected.mjs --base <before> --head <your commit>
```

It prints each changed file that reaches a phone screen with its areas, then `render parity covers: …`, `needs pixels: …` and `areas: …`. A file needs pixels when it matches a pixel path in `apps/mobile/scripts/device/areas.json` or imports a drawing, motion, or gesture library; the line names the reason. Read the diff of each such file. If the change there is copy or data only, render parity covers it and the phone adds nothing. Otherwise run `parity.sh --affected`, which runs exactly the areas `affected.mjs` printed, and prints `parity skipped: no phone screen reached` when there are none.

### Screenshot parity

`parity.sh` builds Moni E2E at both commits with the boards' pinned clock (14 Oct 2026), runs each area's flows on a fresh seed, and compares every named `takeScreenshot` by file name. It ignores the status bar and antialiasing noise. The last line is `parity same …` or `parity CHANGED …` with the evidence folder. Every changed screenshot gets a side-by-side PNG (base left, head right) under `diff/<area>/`. Open each one and explain it, as for render parity. Name areas to run only those, pass `--affected`, or omit both to run all of them. Areas are the folders in `apps/mobile/.maestro/flows/`.

Builds are cached by commit, so a base you already built costs only the flows. The phone has one lock; when another lane holds it, the script waits.

### Device evidence

Use the `moni-device` skill: `run-flows.sh` for flows, `review-pair.sh` for a screenshot beside its board. Write or extend a Maestro flow for a new behaviour so the next parity run covers it, and take a `takeScreenshot` with a stable name.

## 3. Web

- Unit: Vitest in the package or `apps/web`, called through the module's interface with literal inputs and literal expected outputs.
- Screens: the `web-verify` skill. `pnpm --filter web verify` builds and starts the app, signs in as the e2e user, drives every route at 1440, 1024, 820 and 390 wide in light and dark, the keyboard paths, reduced motion and a resize across 700 with a half-typed field, and runs a real QR sign-in. Runs take turns on one lock (`flock`), because each reseeds the same web e2e user; a second run waits for the first. The last line is `web-verify PASS (<n> checks)` or `web-verify FAIL: …`. Screenshots and board pairs land in `~/.local/share/moni-canvas/web-r1/renders/app/<commit>/`; open the pairs and name every difference.

## 4. Backend and database

- `apps/backend`: `go test ./...` and `go vet ./...` (both in the gate). A push to `main` deploys to Cloud Run, so keep old clients working.
- A migration: push it to the dev project (`supabase db push`), run `pnpm gen:db-types`, and commit both. The `@repo/types` test fails when the types predate the newest migration.

## Report

For each commit: the gate's last line, the `render-parity` line, the `areas:` line, the `parity` line when the phone ran (or why it didn't), the flows' `<passed>/<total>` line, evidence paths, and every intended visible change with its screenshot or dump line.
