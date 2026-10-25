# Moni E2E verification map

This directory holds the recipes for verifying Moni's user-facing features on the phone. Read this index, then the feature file, before you drive a feature. The flows the recipes name live in `apps/mobile/.maestro/flows/`.

## Baseline preconditions

- `apps/mobile/scripts/device/doctor.sh` ends with `OK device ...`, and `~/.local/share/moni-device/hold` does not exist.
- The e2e APK for your commit is cached: `apps/mobile/scripts/device/build-apk.sh` prints `built <key>` or `cached <key>`.
- `apps/mobile/.env.e2e` in the main checkout sets `E2E_EMAIL` and `E2E_PASSWORD`. `node apps/mobile/scripts/e2e/seed.mjs --query user` prints the e2e user.
- Each run starts from `run-flows.sh`, which resets the seed and clears the app's data. A recipe names its seed, `full` or `empty`.
- Never drive `com.anonymous.moni`, the owner's daily app.

## Driving conventions

- Run flows with `apps/mobile/scripts/device/run-flows.sh --sha <key> [--seed full|empty] --out /tmp/<lane> <flow.yaml>`.
- Select controls by testID (`id:`), never by coordinates. Text selectors are fine for copy the glossary fixes, such as `All caught up`.
- Start a new flow with `- runFlow: ../../subflows/launch.yaml`, which signs in when needed.
- Run any other adb command through `apps/mobile/scripts/device/with-device.sh -- <command>`.

## Proof and skip reporting

- Report the flow path, the `<passed>/<total>` line, and the run directory.
- Pair each screenshot with its board render through `review-pair.sh`.
- Prove a write with a second view: a `seed.mjs --query` result, or the row on another screen.
- A flow tagged `needs-speech`, `needs-posted-alert`, or `needs-ai` needs a person, a posted alert, or the real backend. Report it as skipped with the tag. Do not report it as passed through another path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph on what the user sees. It then has four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with run-flows.sh`, and `Gotchas`.

## Features

- [Sign in](./sign-in.md) covers the email sign-in, sign-out, and the wrong-password state.
- [Add a transaction](./add-transaction.md) covers Type it from the + chooser.
- [Review captures](./review-deck.md) covers the Review deck's buttons, swipes, and the card editor.
- [Say it and Scan a receipt](./capture-say-scan.md) covers the live captures that the e2e mock answers.
