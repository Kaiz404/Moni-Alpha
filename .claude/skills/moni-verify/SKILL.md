---
name: moni-verify
description: The verification contract for any change to the Moni monorepo, run by agents without the owner. The static gate (types, lint, tests, mobile lints, Go vet, web build), screenshot parity that proves the phone app did not change, device evidence for changes that should show, and the web checks. Use before every commit, for "verify", "prove it", "is mobile unchanged", or when briefing a subagent.
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

## 2. Pick the phone proof by what the change should do

| The change | Proof |
| --- | --- |
| Should not change what the phone shows (a refactor, moving code into `packages/*`, shared tokens) | Screenshot parity against the commit before it |
| Should change what the phone shows (an issue fix, a feature) | Flows for the screens it touches on Moni E2E, screenshots beside the board renders, and parity on the areas it must not touch |
| Touches no phone code (`apps/web`, docs, `apps/backend` only) | None. Say so. |

### Screenshot parity

```bash
apps/mobile/scripts/device/parity.sh --base <commit before the change> --head <your commit> home budget activity debts chat
```

It builds Moni E2E at both commits with the boards' pinned clock (14 Oct 2026), runs each area's flows on a fresh seed, and compares every named `takeScreenshot` by file name. It ignores the status bar and antialiasing noise. The last line is `parity same …` or `parity CHANGED …` with the evidence folder. Every changed screenshot gets a side-by-side PNG (base left, head right) under `diff/<area>/`. Open each one and explain it. A change the task names as intended is fine (say which); any other change is a regression to fix. Omit the areas to run all of them. Areas are the folders in `apps/mobile/.maestro/flows/`.

Builds are cached by commit, so a base you already built costs only the flows. The phone has one lock; when another lane holds it, the script waits.

### Device evidence

Use the `moni-device` skill: `run-flows.sh` for flows, `review-pair.sh` for a screenshot beside its board. Write or extend a Maestro flow for a new behaviour so the next parity run covers it, and take a `takeScreenshot` with a stable name.

## 3. Web

- Unit: Vitest in the package or `apps/web`, called through the module's interface with literal inputs and literal expected outputs.
- Screens: the `web-verify` skill once the shell exists (Playwright at 1440, 1024, 820 and 390 wide against the board renders in `~/.local/share/moni-canvas/web-r1/renders/`).

## 4. Backend and database

- `apps/backend`: `go test ./...` and `go vet ./...` (both in the gate). A push to `main` deploys to Cloud Run, so keep old clients working.
- A migration: push it to the dev project (`supabase db push`), run `pnpm gen:db-types`, and commit both. The `@repo/types` test fails when the types predate the newest migration.

## Report

For each commit: the gate's last line, the parity line or the flows' `<passed>/<total>` line, evidence paths, and every intended visible change with its screenshot.
