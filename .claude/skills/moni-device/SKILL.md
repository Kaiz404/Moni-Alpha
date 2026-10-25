---
name: moni-device
description: Drive the Moni E2E Android app on the owner's Redmi phone over Tailscale from WSL, the way a user does. Connect adb, run the doctor, build and install the e2e APK, reset the e2e seed, run Maestro flows or the smoke suite, and collect screenshots, JUnit reports, and logs beside the design board renders. Use for any Moni change that alters what the phone shows, for a device check, a smoke run, or a screenshot.
---

# Drive Moni on the phone

This skill drives **Moni E2E** (`com.anonymous.moni.e2e`), a release build that installs beside the owner's daily `com.anonymous.moni` app and runs without Metro. The phone is the owner's Redmi Note 13 Pro 5G (HyperOS, Android 16) on the tailnet at `100.127.128.74`. adb, Maestro, and Gradle run in WSL. Every command below runs from the repo root of your git worktree.

This directory is a real directory in `.claude/skills/`. The pstack entries beside it (`poteto-mode`, `how`, `principle-*`, and the rest) are symlinks to `.cursor/skills/`, so read those through either path. `.cursor/skills/moni-device` is a symlink back to this directory, so Cursor loads it too. Edit this skill here.

## Rules

- Touch the phone only through `apps/mobile/scripts/device/with-device.sh` or `run-flows.sh`, which takes the device lock itself. Only one lane uses the phone at a time.
- Never install, clear, or drive `com.anonymous.moni`. That is the owner's daily app with real data. `install.sh` refuses any other package.
- If `~/.local/share/moni-device/hold` exists, the owner is using the phone. The scripts exit 4. Do not delete the file. Report "device check pending operator" and move on.
- Never run `build-apk.sh` in the main checkout `/home/kaiz404/projects/moni`, because `expo prebuild --clean` rewrites its `android/`. The script refuses with exit 3.
- Never print `apps/mobile/.env.e2e` or the e2e password. Name the variables, not their values.

## Launch

Load the toolchain and install dependencies once per shell:

```bash
source apps/mobile/scripts/device/env.sh   # nvm node 22, corepack pnpm, adb, Maestro on PATH
pnpm install --frozen-lockfile
```

Build the e2e APK for your commit. The first build takes several minutes. A rebuild of a cached key returns at once:

```bash
apps/mobile/scripts/device/build-apk.sh
# built <key> ~/.cache/moni-apk/<key>/app-release.apk in <n> s   or   cached <key> <apk>
```

The key is the `HEAD` SHA, or `<sha>-dirty-<hash>` when the tree has changes. Pass that key as `--sha` below.

Connect adb. Android picks a new Wireless debugging port after each reboot and each time Wireless debugging turns on. Ask the operator for the port shown under **Developer options > Wireless debugging > IP address & Port**, then:

```bash
apps/mobile/scripts/device/connect.sh 100.127.128.74:<port>   # prints: connected 100.127.128.74:<port>
```

`connect.sh` saves the serial in `~/.local/share/moni-device/serial`, so later scripts reuse the port. Exit 3 means adb is down: the port changed, or the phone rebooted and needs the operator.

Ready means `doctor.sh` ends with `OK device ...`, the next section.

## Doctor

Run this first, and again whenever anything looks off:

```bash
apps/mobile/scripts/device/doctor.sh
```

It is read-only on the phone except for one wake key. Each line is `ok` or `FAIL`. The last line on success is `OK device 100.127.128.74:<port> android 16 hyperos OS3.0`. Read the failures this way:

- `FAIL hold ...` means the operator holds the phone. Stop.
- `FAIL port-5037 held by Windows pid <n>` means a Windows adb server owns the port. Ask the operator to run `adb.exe kill-server` on Windows, then run `connect.sh`.
- `FAIL device ... not connected, run connect.sh` means the port rotated. Get the new port and run `connect.sh <host:port>`.
- `FAIL tailscale-ping` means the phone is off the tailnet or asleep with Tailscale killed. Ask the operator.
- `note keyguard showing` means the phone is locked. The scripts never unlock it. Ask the operator to unlock it and to turn on **Developer options > Stay awake**, so the screen stays on while it charges.

## Drive

### Run flows

`run-flows.sh` is the one entry point for Maestro on the phone:

```bash
apps/mobile/scripts/device/run-flows.sh --sha <key> --tag smoke --out /tmp/<lane>       # the v2 smoke suite
apps/mobile/scripts/device/run-flows.sh --sha <key> --area review --out /tmp/<lane>     # every flow in .maestro/flows/review/
apps/mobile/scripts/device/run-flows.sh --sha <key> --seed empty --area home            # the first-run flows
apps/mobile/scripts/device/run-flows.sh --sha <key> .maestro/flows/capture/type-it.yaml # one flow
```

It takes the device lock and runs the doctor. Then it installs the key if the phone has a different one, resets the e2e user's data with `seed.mjs --reset --profile <full|empty>` (default `full`), clears the app's data, grants the camera, microphone, and location permissions again, and pushes the receipt fixtures to `/sdcard/Pictures/moni-e2e/`. Then it runs Maestro with JUnit output. Each flow signs in on its own through `.maestro/subflows/launch.yaml`.

It leaves out flows tagged with the other seed and flows tagged `needs-speech`, `needs-posted-alert`, `needs-ai`, or `perf`. Pass `--tag <that tag>` to include one. Areas are the folders under `apps/mobile/.maestro/flows/`. Run `run-flows.sh --area x` to list them.

The smoke suite is `flows/smoke/`: `launch`, `sign-in`, `tabs`, `chooser`, `transaction`, and `review`. Run it after any change to the app shell, sign-in, or navigation.

### Write a flow

- Put it in `apps/mobile/.maestro/flows/<area>/<name>.yaml`. Start it with `- runFlow: ../../subflows/launch.yaml` and give it one seed tag, `seed-full`, `seed-empty`, or `seed-any`. `node apps/mobile/scripts/codemods/maestro-flows.mjs --check` fails when you forget either.
- Select by `id:` only with testIDs that `tid()` in `apps/mobile/lib/test-ids.ts` builds, such as `home.avatar`, `nav.tab.activity`, `nav.plus`, `nav.chooser.type`, `review.card`, or `'activity\.transaction\..*'` with `index: 0`. Maestro reads `id:` as a regex. `pnpm --filter moni lint:flow-ids` fails on an id that no `tid()` call renders.
- Check syntax with `maestro check-syntax <flow.yaml>`.
- Read the live tree when a selector does not match: `maestro --device "$MONI_DEVICE_SERIAL" hierarchy` under `with-device.sh`.

### Data

The e2e user is `E2E_EMAIL` in `apps/mobile/.env.e2e` on the dev Supabase project `yucjcjquwpwkgowzthhn`. The `full` seed is the canvas sample: Maybank Savings, Touch 'n Go eWallet, and Cash in MYR, Wise USD, about 46 transactions, budgets, three bills, three debts (Mei, Aiman, Hana), and four pending captures (two Maybank alerts, a receipt, and a chat capture with no wallet). Dates move so that the sample's Wed 14 Oct 2026 is today. Read state without the phone:

```bash
node apps/mobile/scripts/e2e/seed.mjs --query counts             # also: user, wallets, latest-transaction, pending-proposals, debts, bills
node apps/mobile/scripts/e2e/seed.mjs --reset --profile full     # reset by hand, prints row counts before and after
```

### AI without the backend

The e2e build has no AI backend. The mock client answers fixed inputs from `apps/mobile/lib/ai/client/mock-fixtures.ts`: the sentence `paid 6 ringgit parking at KLCC` (Say it and chat), any scanned image (the mamak receipt, RM15.30), a Maybank `You've spent RM<amount> at <merchant> on <dd/mm>` alert, and the chat question `How much on Transport this month`. Anything else reads as unavailable.

### Bank alerts

The `full` seed links Maybank to `com.android.shell`, so a notification that adb posts acts as a Maybank alert. Moni E2E needs notification access first. Try the command, and ask the operator to grant **Moni E2E** in Android settings if it fails (operator action O5):

```bash
apps/mobile/scripts/device/with-device.sh -- adb shell cmd notification allow_listener com.anonymous.moni.e2e/com.lesimoes.androidnotificationlistener.RNAndroidNotificationListener
apps/mobile/scripts/device/with-device.sh -- adb shell cmd notification post -S bigtext -t Maybank e2e-grab "MAYBANK: You've spent RM12.00 at GRAB on 14/10 12:41."
```

## Evidence

Each `run-flows.sh` call writes `~/.local/share/moni-runs/<key>/<timestamp>/`:

- `report.xml`, the JUnit report with one `testcase` per flow. A failed flow has a `failure` element with Maestro's message.
- `maestro.log`, Maestro's console output. `seed.log` holds the seed's row counts.
- `maestro/`, Maestro's output: the commands JSON with each step's status and timing, `logs/`, and `takeScreenshot/` with every `takeScreenshot` PNG.

The last line printed is `<passed>/<total> flows passed, report <path>`, and the exit code is Maestro's. `--out <dir>` copies every PNG to `<dir>`. Maestro's command log holds the typed e2e password, so never paste the commands JSON into a report.

Proof standards:

- Drive the real user path. Tap the controls a user taps. Do not open a route by deep link when the test is about the control that opens it.
- Capture the action and the state after it, not only the last screen.
- Check side effects outside the screen. After a write, run `seed.mjs --query latest-transaction` or `--query pending-proposals`, and read `adb logcat -d -s ReactNativeJS` for errors under `with-device.sh`.
- Pair each screenshot with its design board. Board renders are `~/.local/share/moni-canvas/renders/r6/all/<Board>.png`, for example `V2H-Home`, `V2A-Activity`, `XA-Review`, `V2P-Debts`. Take the device screenshot at the same scroll position, then:

```bash
apps/mobile/scripts/device/review-pair.sh <slug> <Board> <device.png> --out /tmp/<lane>/pairs
# prints <out>/<slug>-board.png and <out>/<slug>-device.png
```

For one screenshot outside a flow, use `apps/mobile/scripts/device/with-device.sh -- apps/mobile/scripts/device/screenshot.sh /tmp/<lane>/<slug>.png`.

## Cleanup

`run-flows.sh` leaves the app signed in on the seed. Nothing else needs tearing down: the lock frees when the command exits, and the next run resets the seed and clears the app's data. Do not delete `~/.local/share/moni-runs/`, because it holds the evidence. Stop only processes you started, by PID.

## When the phone needs a person

Only the operator can answer these. Report them, and keep working on what does not need the phone.

- **Install prompts.** A first install, or an install after a signature change, can show a HyperOS **Install via USB** confirmation or a **Google Play Protect** "Send app for a security check?" dialog. `install.sh` waits up to `MONI_INSTALL_TIMEOUT` seconds (default 300), then exits 4 and names both prompts.
- **Port rotation.** After a reboot, `connect.sh` exits 3. The operator reads the new port, or runs `adb tcpip 5555` over USB (O2).
- **Stay awake and the lock screen.** A locked phone fails every flow at `launchApp`. The operator unlocks it and turns on **Stay awake**.
- **The hold file.** `touch ~/.local/share/moni-device/hold` is the operator's way to take the phone. Wait for them to delete it.

## Helpers

All under `apps/mobile/scripts/device/` unless named otherwise, each with usage on a bad argument:

- `env.sh` sets `PATH` and `MONI_DEVICE_SERIAL`. Source it.
- `connect.sh [host[:port]]`, `doctor.sh [--toolchain]`, `with-device.sh [--pr <id>] [--lane <name>] [--skip-doctor] -- <command>`.
- `build-apk.sh [--clean-prebuild]`, `install.sh <key>`.
- `run-flows.sh [--sha <key>] [--seed full|empty] [--out <dir>] [--tag <tag>]... [--area <area>]... [<flow or dir>...]`.
- `screenshot.sh <out.png>`, `screenrecord.sh <seconds> <out.mp4>`, `review-pair.sh <slug> <Board> <device.png> [--out <dir>]`.
- `perf.sh --sha <key> [--flow <flow.yaml>]` and `perf-compare.mjs base.json head.json --rule <metric>=<limit>` for cold start, APK size, and jank.
- `apps/mobile/scripts/e2e/seed.mjs --reset --profile <full|empty>` and `--query <name>`.
- `taildrop.sh <file>` sends a file to the phone when adb is down.

`bash apps/mobile/scripts/device/test/device-scripts.test.sh` tests these scripts with stubs and no phone. The full reference is `apps/mobile/README.md`, sections "Drive the phone over Tailscale" through "Maestro flows".

## Feature map

`features/README.md` indexes recipes for each user-facing feature, with the selectors, seed, and proof for each. Read the matching file before you drive a feature.
