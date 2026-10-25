# Moni Redesign v2 plan

This plan rebuilds the Moni Android app to the Redesign v2 boards on the design canvas, for the owner and every later Moni user.
The program first builds a way to prove each change on the owner's Redmi Note 13 Pro 5G over Tailscale, then deletes dead code, then rebuilds the app in place, area by area.
Its rule is that every PR ends in a working Android app with its own device evidence, and no PR keeps v1 and v2 side by side.
PR ids in stack order are V1, V2, V3, V4, S1, F1, F2, F3, F4, N1, G1, H1, A1, A2, C1, C2, G2, R1, R2, H2, B1, B2, D1, K1, K2, G3, K3, M1.
V is the verification scaffold. S subtracts. F lands foundations. N is the navigation shell. G is a data gap, schema first.
H, A, C, R, B, D, K, and M are the screen areas Home and chat, Activity, Capture, Review, Budget, Debts, Account, and Map.

## Fast execution mode (from 21 Oct 2026)

The owner replaced the per-PR stack below with this mode after V1 landed. Where this section and the program checklist disagree, this section wins. Each PR section's Files, Build, You see, and Verify, unit boxes stay the spec.

- Work lands on `main` as commits. There are no feature branches and no PRs. Each unit's agent works in its own git worktree and commits there. The coordinator verifies, rebases the commits onto `main`, and pushes. Agents never push.
- Units run in parallel waves. A unit starts when its real dependencies have landed, not when the unit before it in the list has.
  - Wave 1: V2, V3, S1, and G (G1, G2, and G3 as one data unit, schema, migration files, store, and helpers, with no screens).
  - Wave 2: F1, and V4 once V3 has landed and the operator has done O4.
  - Wave 3: F2, then F3 and F4 in parallel.
  - Wave 4: N1.
  - Wave 5, in parallel tracks: H1 and H2. A1 and A2. C1, C2, R1, and R2. B1 and B2. D1. K1, K2, and K3. M1.
- The verification contract for one unit. Run the unit's **Verify, unit** boxes plus `pnpm lint`, `pnpm check-types`, and `pnpm test`. A unit that changes what the phone shows also builds the e2e APK with `apps/mobile/scripts/device/build-apk.sh` once V3 has landed, runs the Maestro flows it adds or touches through `with-device.sh`, and saves screenshots beside the board render. The ten-lane swarm, the per-unit perf block, and the per-unit review gate are dropped. The coordinator runs one independent check before landing, and a perf check (cold start, APK size, bundle size) once per wave.
- The phone is one shared device. Only `with-device.sh` touches it, and agents keep their phone time short.
- Migrations are committed as files only. Pushing them to a Supabase project is the operator's action (O4 and O7).
- No commit carries a Co-Authored-By or "Generated with" line.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `.claude/skills/poteto-mode/playbooks/autopilot-stack.md`. No owner merges. Every PR from V1 to M1 stops at STACK-READY, and the root appends it to one linear base-branch stack. The operator, who is the repo owner, reviews and lands the stack bottom-up.

The skill paths in this plan use `.claude/skills/<name>/`. Each of those directories is a symlink to `.cursor/skills/<name>/`, so a `git show` command must use the `.cursor/skills/` path.

In every regression lane, "trunk" means the PR's base. That base is the parent branch tip in the stack, or `main` for V1. The operator lands the stack at the end, so `main` alone would lack every earlier PR of the program.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on the operator's explicit go.
- [ ] Read these from trunk at program start. Re-read them at every tick.
  - [ ] `git show origin/main:.cursor/skills/poteto-mode/playbooks/autopilot-stack.md`
  - [ ] `git show origin/main:.cursor/skills/swarm/SKILL.md`
  - [ ] `git show origin/main:.claude/skills/moni-device/SKILL.md`. V4 created this skill as a real directory under `.claude/skills/`, and `.cursor/skills/moni-device` is a symlink to it, so `git show` needs the `.claude/` path.
  - [ ] `git show origin/main:.cursor/skills/poteto-mode/playbooks/opening-a-pr.md`
  - [ ] `git show origin/main:.cursor/skills/show-me-your-work/SKILL.md`
  - [ ] `git show origin/main:.cursor/skills/create-verification-skill/SKILL.md`
  - [ ] `git show origin/main:.cursor/skills/technical-writing/SKILL.md` and `git show origin/main:.cursor/skills/unslop/SKILL.md`
  - [ ] `git show origin/main:.cursor/skills/no-comments/SKILL.md`, `git show origin/main:.cursor/skills/how/SKILL.md`, and `git show origin/main:.cursor/skills/interrogate/SKILL.md`
  - [ ] `git show origin/main:docs/REDESIGN.md`, `git show origin/main:docs/redesign/tokens.md`, and `git show origin/main:docs/redesign/glossary.md`
- [ ] On the operator's go, arm the audit tick as `/loop 1h` with the tick prompt below. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook from trunk. Audit the operation against it and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then post a short status message to the operator in chat only when the audit found a tracked change that no earlier status message reported, such as a PR opened, a code-ready head, a round launched or closed, a verdict, a merge, a stuck agent and the action taken, a blocker added or cleared, or a decision only the operator can make. Name every such change and nothing else. Do not repeat a table, the merged list, or an unchanged blocker. If the audit found none, end the turn with no reply text. Either way, log this tick's row in your decision trail. The row names the items reported, or none."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once. Also create `~/.local/share/moni-device/hold` so no lane takes the phone.

### Spawn owners

- [ ] Spawn one owner per PR with the full lifecycle the execution playbook names. Use `subagent_type: "poteto-agent"` and omit `model`, so every owner runs on the parent model.
- [ ] Follow this dependency graph. The stack is linear, so each PR bases on its parent branch. Owners may build in parallel when their files do not overlap, but the root appends in this order.
  - [ ] V1 is first. It branches from `main` as `redesign/v1-device-link`.
  - [ ] V2 after V1. V3 after V2. V4 after V3.
  - [ ] S1 after V4. F1 after S1. F2 after F1. F3 after F2. F4 after F3.
  - [ ] N1 after F4. G1 after N1. H1 after G1. A1 after H1. A2 after A1.
  - [ ] C1 after A2. C2 after C1. G2 after C2. R1 after G2. R2 after R1. H2 after R2.
  - [ ] B1 after H2. B2 after B1. D1 after B2.
  - [ ] K1 after D1. K2 after K1. G3 after K2. K3 after G3. M1 after K3.
- [ ] Name each branch `redesign/<id>-<slug>`. The branches are `v1-device-link`, `v2-ci-gates`, `v3-e2e-apk`, `v4-e2e-data-and-smoke`, `s1-subtract`, `f1-tokens`, `f2-press-and-chrome`, `f3-sheets`, `f4-rows-and-feedback`, `n1-nav-shell`, `g1-currency-bills-source`, `h1-home`, `a1-activity`, `a2-txn-detail`, `c1-type-it`, `c2-say-and-scan`, `g2-review-data`, `r1-review-deck`, `r2-review-notification`, `h2-moni-chat`, `b1-budget`, `b2-bills`, `d1-debts`, `k1-profile`, `k2-wallets`, `g3-account-data`, `k3-capture-sources`, and `m1-map`.
- [ ] Hold the file boundaries.
  - [ ] V1 and V3 touch only `apps/mobile/scripts/device/**`, `apps/mobile/app.config.ts`, `apps/mobile/.gitignore`, `apps/mobile/.env.e2e.example`, `apps/mobile/README.md`, and `docs/SETUP.md`.
  - [ ] V2 touches only `.github/workflows/ci.yml`, the root `package.json`, `apps/mobile/package.json`, `apps/mobile/scripts/lint/**`, `apps/mobile/lib/test-ids.ts`, `.cursor/rules/mobile-expo.mdc`, `apps/mobile/README.md`, and `docs/SETUP.md`.
  - [ ] G PRs touch `packages/types/**`, `supabase/migrations/**`, `apps/mobile/lib/**`, `docs/DATABASE.md`, and `docs/REDESIGN.md`. A G PR changes a screen only to migrate a caller of the shape it changes.
  - [ ] Screen PRs touch `apps/mobile/app/**`, `apps/mobile/components/**`, `apps/mobile/.maestro/**`, the two lint lists under `apps/mobile/scripts/lint/`, and the docs that `docs/REDESIGN.md` names. No screen PR touches `apps/backend/**`.
- [ ] Hold the review gate. F1, F2, F3, F4, N1, H1, A1, A2, C1, C2, R1, R2, H2, B1, B2, D1, K1, K2, K3, and M1 change an interaction. They wait for the operator's review in chat with screenshots and a video before the operator lands them.

### PR mechanics, for every PR

- [ ] Resolve the forge once. Default to `gh`; if `command -v origin` succeeds and Origin can resolve the repository, use `origin pr` for every PR operation. Record any fallback to `gh`. Never require `gt`.
- [ ] Open the PR ready, never draft, per **Opening a PR**. Use the run's built-in PR tool when it has one, else `origin pr create --status open --base <base-branch>` or `gh pr create --base <base-branch>` according to the resolved forge. A stack child targets its parent branch.
- [ ] Work in a git worktree off the parent branch. Never build or prebuild in the owner's main checkout at `/home/kaiz404/projects/moni`, because `expo prebuild --clean` rewrites `apps/mobile/android/`.
- [ ] Run `pnpm lint`, `pnpm check-types`, and `pnpm test` once before the PR-facing push. Push with hooks on.
- [ ] Run `/deslop` before each commit, marked `skip: not installed` because this repo does not vendor it. Run `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment per `.claude/skills/poteto-mode/references/bugbot-triage.md`.
- [ ] Rebase onto the current parent tip before the code-ready report and babysit. Keep that merge base in fix rounds. Rebase again only at merge prep, on a `git merge-tree` conflict with the parent, or on a CI failure that comes from a change below.
- [ ] Update the docs the change touches in the same PR, per `.cursor/rules/docs-maintenance.mdc`. Every screen PR updates the status line in `docs/REDESIGN.md`, the matching section of `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`. Every PR that leaves an owner decision open lists the affected spots in its PR body.
- [ ] Add a `testID` from `tid()` in `apps/mobile/lib/test-ids.ts` to every control the PR adds, and delete the PR's files from `apps/mobile/scripts/lint/test-id-exempt.txt` and its fixed hits from `apps/mobile/scripts/lint/copy-allow.txt`. V2 makes CI enforce both lists.
- [ ] Update every Maestro flow under `apps/mobile/.maestro/` that the PR's screen change breaks, in the same PR.

### Verdict and merge, for every PR

- [ ] At the code-ready head SHA and at each later push that changes the patch, run the swarm per `.claude/skills/swarm/SKILL.md`. One gates lane. The ten live lanes from the PR's **Verify, live** block. The perf lane from its **Verify, perf** block. Two or more audit lanes, each with its own focus, that read the diff and the receipts and distrust the PR body. The root audits the receipts in the STACK-READY report before the verdict.
- [ ] Clean only when every lane is `PASS`. Findings go back to the owner, including a defect that a lane filed as a note. A new head gets a fresh swarm and a fresh verdict, except for results that stay valid under the patch-id rule in `.claude/skills/poteto-mode/playbooks/shipping.md`.
- [ ] On a clean verdict, the root appends the PR to the stack. The root fetches the parent, rebases the child onto that exact parent tip, checks `git ls-remote`, pushes with `--force-with-lease`, and sets the PR base to the parent branch. A rebase that changes the patch-id voids the verdict. Re-run mergeability and CI after every rewritten push. No owner merges, arms auto-merge, or closes.

### Boot recipe, for every live lane

Each live lane runs on this WSL machine at the PR head, not on a cloud VM. There is one phone, the owner's Redmi Note 13 Pro 5G at `100.127.128.74:5555` on the tailnet. Tailscale runs on Windows. adb, Maestro, and Gradle run in WSL, which shares the tailnet through mirrored networking. A lane that touches the phone takes the device lock through `apps/mobile/scripts/device/with-device.sh`, so the phone lanes run one at a time in lane order. A lane that does not touch the phone runs in parallel. This is how the swarm's ten lanes run on one device. Lanes drive the phone through the `moni-device` skill at `.claude/skills/moni-device/SKILL.md` from V4 on. V1, V2, and V3 lanes call the scripts their own PR adds.

- [ ] `git fetch origin <head-branch> && git worktree add /tmp/swarm-<pr-id>/worker-<n>/wt <head SHA>`.
- [ ] Load the WSL toolchain with `source apps/mobile/scripts/device/env.sh`, then run `pnpm install --frozen-lockfile`. `env.sh` selects nvm node 22, the corepack `pnpm`, and `ANDROID_HOME=$HOME/Android/Sdk`.
- [ ] Build or reuse the e2e APK for the head SHA and for the base SHA with `apps/mobile/scripts/device/build-apk.sh`. The script builds once per SHA and caches the APK at `~/.cache/moni-apk/<sha>/app-release.apk`.
- [ ] Run each phone lane as `apps/mobile/scripts/device/with-device.sh -- apps/mobile/scripts/device/run-flows.sh --sha <sha> --seed <profile> --out /tmp/swarm-<pr-id>/worker-<n> <flow.yaml>`. The command takes the lock, runs `doctor.sh`, installs the APK when the phone has a different SHA, resets the e2e seed, and runs Maestro with JUnit output.
- [ ] Deliver input only through Maestro flows under `apps/mobile/.maestro/` and the scripts under `apps/mobile/scripts/device/`. The read-only diagnostics are `adb logcat -d -s ReactNativeJS`, `maestro --device <serial> hierarchy`, `adb shell dumpsys gfxinfo com.anonymous.moni.e2e`, `adb shell dumpsys vibrator_manager`, and `apps/mobile/scripts/e2e/seed.mjs --query <name>`.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths with the report.

### Operator actions and owner decisions

Only the operator can do these actions. Each owner that hits one parks the affected lane as `BLOCKED` with the box id and keeps building.

- [ ] O1. Arm the phone once over USB before V1's live lanes. In **Developer options**, turn on **USB debugging**, **USB debugging (Security settings)**, and **Install via USB**, then reboot. Attach the phone through `usbipd`, run `adb tcpip 5555` in WSL, and accept the RSA prompt with **Always allow**. In the Tailscale app, set battery use to **No restrictions** and turn on **Autostart**.
- [ ] O2. Repeat the `adb tcpip 5555` step of O1 after every phone reboot. `doctor.sh` reports `adb down` when the phone needs it.
- [ ] O3. Turn on **Send files** (Taildrop) in the Tailscale admin console, for the fallback install path.
- [x] O4. Settled by the owner on 25 Oct 2026: there is no separate `moni-e2e` project. The linked project `yucjcjquwpwkgowzthhn` is dev-only with no real users, and it holds the e2e data under one user, `E2E_EMAIL` in the main checkout's `apps/mobile/.env.e2e`. `apps/mobile/scripts/e2e/seed.mjs` creates that user with the secret key and deletes or writes only that user's rows. It refuses any `E2E_EMAIL` that does not start with `e2e`. The original box follows. Before V4's live lanes, create a second free-tier Supabase project named `moni-e2e`. Run `npx supabase db push --db-url <e2e-connection-string>` to apply every migration, which leaves the production link untouched. Put its URL, publishable key, and secret key in `apps/mobile/.env.e2e`, which git ignores.
  - [x] Superseded by the O4 decision above. If the operator declines a second project, V4 uses the production project with one dedicated user, `E2E_EMAIL` in `.env.e2e`. RLS limits that user to its own rows. `seed.mjs --shared-project` then signs in as that user with the publishable key and deletes or writes only that user's rows. Migrations then reach production first, so G2, B2, and G3 wait for O7 before their live lanes.
- [ ] O5. Grant notification access to **Moni E2E** once in Android settings if `adb shell cmd notification allow_listener` fails on HyperOS. G2, R2, and K3 need it.
- [ ] O6. Before M1, add `com.anonymous.moni.e2e` with the SHA-1 of the build keystore to the Android Maps API key restrictions, if the key has restrictions. Without it, the e2e map renders blank.
- [x] O7. Settled by the owner on 25 Oct 2026: the linked project is the dev project, and `npx supabase migration list --linked` shows every migration through `20261021000300` applied there. The original box follows. Run `npx supabase db push` against the production project for the migrations in G2, B2, and G3 before landing the first app build that syncs them. Open finding from V4: `proposed_transactions.transfer_to_wallet_id` does not exist on that project (PostgREST error 42703), although `20260712000000_add_transfer_to_proposed_transactions.sql` is recorded as applied.
- [ ] O8. To use the phone during a run, `touch ~/.local/share/moni-device/hold`. Phone lanes wait until the file is gone. Delete it to resume.
- [ ] O9. Land the stack bottom-up after reviewing each review-gated PR's screenshots and video.

These are owner calls that no experiment settles. Each PR implements the default and lists the affected spots in its PR body. The owner can change a default by replying in chat with the decision in plain words.

- [ ] D1. "Left this month" subtracts debts due, as the boards draw it, with the label "bills and RM40 to Mei". Default is to subtract and label. Affects H1 and B1.
- [ ] D2. Budgets show as rings on the Budget tab root. Default is rings, as drawn. Affects B1.
- [ ] D3. Brand logo, mascot, reactions, and a logging streak stay out of the app. Default is none, per `docs/REDESIGN.md`. Affects no PR.
- [ ] D4. Home keeps both the ask box and the Moni header button. Default is both, as drawn. Affects H1.
- [ ] D5. Debts hero tiles filter the list in place, and Nudge opens the Android share sheet. Default is filter in place, as drawn, and the share sheet, because Moni has no way to send a message. Affects D1.
- [x] D6. Review keeps its history. The owner decided on 25 Oct 2026 to keep reviewed proposals instead of deleting them. Approve and Not mine stamp `status`, `reviewed_at`, and, for Approve, `transaction_id`, and keep the row. The Review page lists the last 30 days under "Recently reviewed", and the app soft-deletes rows reviewed more than 90 days ago. Built by G4. The earlier default (session results from memory, then a soft delete) is replaced.
- [ ] D7. The Review deck shows a blank card at scale 0.96 under the top card, with no content, as `XA-Review` and `CG-Guide` draw it. `docs/redesign/tokens.md` says "No peek of the next card". Default is the board, and R1 fixes the tokens.md line.
- [ ] D8. Motion has six tokens, five springs plus `drag` at 1:1, as tokens.md lists. `V2F-Motion` says "five springs". Default is the tokens.md table. Affects F1.
- [x] D9. Reversed by the owner on 25 Oct 2026: follow canvas thread 8cd5c2da and drop the "Edit" link beside Budgets on `V2P-InsightsMonth`. Each ring opens its category page, where the monthly budget edits in place and a "No budget yet" ring offers **Set a budget**. The Budgets heading carries a routing chevron into `V2P-BudgetEdit` for the monthly total and every cap at once, and the empty tile's **Set budgets** opens the same page. The earlier default (keep the link as drawn) is replaced. Affects B1.
- [ ] D10. The dev-only `debug/` route has no board. Default is to keep it, reachable from Profile only when `__DEV__` is true. Affects K1.
- [ ] D11. `V2A-CaptureScan` draws an in-app camera with a detection frame. Default differs from the board here. C2 keeps the ML Kit document scanner for the camera stage, because that scanner already finds the receipt edges and captures on its own, and an in-app camera needs a new native camera dependency. C2 builds the reading, result, added, and failed pages as drawn.

## Arm the device link over the tailnet (V1)

**Depends on.** None. V1 is the stack root and branches from `main` as `redesign/v1-device-link`.

**Files.**

- [ ] Create `apps/mobile/scripts/device/env.sh`.
- [ ] Create `apps/mobile/scripts/device/doctor.sh`.
- [ ] Create `apps/mobile/scripts/device/connect.sh`.
- [ ] Create `apps/mobile/scripts/device/with-device.sh`.
- [ ] Create `apps/mobile/scripts/device/screenshot.sh`.
- [ ] Create `apps/mobile/scripts/device/taildrop.sh`.
- [ ] Create `apps/mobile/scripts/device/test/device-scripts.test.sh`.
- [ ] Edit `apps/mobile/README.md` with a section that tells how to drive the phone over Tailscale.
- [ ] Edit `docs/SETUP.md` with the WSL toolchain and the phone settings.

**Build.**

- [ ] Prove adb over the tailnet before writing any script. This is the first unproven question in Appendix A. After O1, run `adb connect 100.127.128.74:5555`, then `adb -s 100.127.128.74:5555 shell input keyevent KEYCODE_WAKEUP`. Record both outputs in the decision trail.
  - [ ] If the connect is refused, try Android Wireless debugging. Pair on the LAN address, then `adb connect 100.127.128.74:<port>`.
  - [ ] If both fail, use the Windows adb server that Maestro documents, `adb -a -P 5037 nodaemon server` on Windows and `ADB_SERVER_SOCKET` in WSL. Record which path works in `env.sh`.
- [ ] Close the WSL toolchain gaps in `env.sh`. Source `$HOME/.nvm/nvm.sh` and run `nvm use 22`. Run `corepack enable` so `pnpm` resolves inside WSL and not to the Windows shim under `/mnt/c/`. Export `ANDROID_HOME=$HOME/Android/Sdk` and put `platform-tools` first on `PATH`. Export `MONI_DEVICE_SERIAL`, default `100.127.128.74:5555`, and `MONI_DEVICE_NAME`, default `redmi-note-13-pro-5g`.
- [ ] Make `connect.sh` idempotent. It runs `adb connect`, retries three times, and exits 0 only when `adb -s "$MONI_DEVICE_SERIAL" get-state` prints `device`. On failure it exits 3 and prints `adb down, run taildrop.sh or ask the operator for O2`.
- [ ] Make `doctor.sh` read-only. It checks that `tailscale.exe status` lists the phone, that `tailscale.exe ping --c 1 100.127.128.74` answers, that adb is 37.x, Maestro is 2.11.0, and Java is 17 or higher, that the device state is `device`, that `input keyevent KEYCODE_WAKEUP` raises no `SecurityException`, that the battery is above 30 percent, that no Windows `adb.exe` server holds port 5037, and that no hold file exists. It prints `getprop ro.build.version.release` and `ro.mi.os.version.name`. `--toolchain` also fails when `node` or `pnpm` resolves under `/mnt/c/`.
- [ ] Make `with-device.sh -- <cmd>` take `flock -w 2700 ~/.local/share/moni-device/redmi.lock`, write the holder's PID, PR id, and lane to `redmi.owner`, exit 4 while `~/.local/share/moni-device/hold` exists, run `doctor.sh`, then run the command. The kernel releases the lock when the process exits, so a killed lane leaves no stale lock.
- [ ] Make `screenshot.sh <out.png>` run `adb exec-out screencap -p`.
- [ ] Make `taildrop.sh <file>` run `tailscale.exe file cp "$(wslpath -w <file>)" redmi-note-13-pro-5g:`.

**You see.**

- [ ] `doctor.sh` prints `OK device 100.127.128.74:5555` with the Android and HyperOS versions, then exits 0.
- [ ] A second `with-device.sh` started while the first holds the lock prints `waiting for device lock held by <pid> <pr-id> <lane>`.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/mobile/scripts/device/test/device-scripts.test.sh` gains four cases. A lock holder killed with `kill -9` frees the lock within 2 s. The hold file makes `with-device.sh` exit 4. `connect.sh` exits 3 for the unreachable serial `127.0.0.1:1`. `doctor.sh --toolchain` fails when a fake `pnpm` under a `/mnt/c/` path comes first on `PATH`. Run `bash apps/mobile/scripts/device/test/device-scripts.test.sh`.
- [ ] Every script passes `bash -n`. Run `for f in apps/mobile/scripts/device/*.sh; do bash -n "$f"; done`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Trunk has no device scripts, so record that fact. Gate the head path from a cold adb server. Run `adb kill-server`, `connect.sh`, `doctor.sh`, then `screenshot.sh`. Save `v1-l1-connected.png`. Pass when `doctor.sh` exits 0 and the PNG has the size that `adb shell wm size` prints.
- [ ] Lane 2. Prove input injection. Run `adb shell input keyevent KEYCODE_HOME`, then `adb shell am start -a android.settings.SETTINGS`. Save `v1-l2-settings.png`. Pass when no `SecurityException` appears and the screenshot shows Android Settings.
- [ ] Lane 3. Start two `with-device.sh -- sleep 20` commands at once. Save `v1-l3-lock-wait.png` from inside the first holder. Pass when the second command starts at least 20 s after the first and `redmi.owner` shows both holders in order.
- [ ] Lane 4. Kill a lock holder with `kill -9` after 5 s, then start a new `with-device.sh`. Save `v1-l4-after-kill.png`. Pass when the new command takes the lock within 2 s.
- [ ] Lane 5. Create the hold file, run `with-device.sh -- true`, delete the file, and run it again. Save `v1-l5-hold-released.png`. Pass when the first run exits 4 with `operator hold` and the second exits 0.
- [ ] Lane 6. Run `connect.sh` three times in a row, then `adb disconnect` and `connect.sh` once more. Save `v1-l6-reconnected.png`. Pass when every run exits 0 and `adb devices` lists the serial exactly once.
- [ ] Lane 7. Put the phone to sleep with `adb shell input keyevent KEYCODE_SLEEP`, wait 5 minutes, then run `doctor.sh` and `screenshot.sh`. Save `v1-l7-after-sleep.png`. Pass when `doctor.sh` exits 0 within 30 s and the screenshot is not black.
- [ ] Lane 8. Point `MONI_DEVICE_SERIAL` at port 5556 and run `connect.sh`, then send a 1 MB file with `taildrop.sh`. Restore the serial, open the Tailscale app's received files, and take a screenshot. Save `v1-l8-taildrop-received.png`. Pass when `connect.sh` exits 3 with the fallback message, `tailscale file cp` exits 0, and the Tailscale app lists the file. Tailscale on Android holds received files in its app until the user saves them, so the file does not appear under `/sdcard/Download/`.
- [ ] Lane 9. Run `env -i HOME="$HOME" bash -lc 'source apps/mobile/scripts/device/env.sh && apps/mobile/scripts/device/doctor.sh --toolchain' > v1-l9-toolchain.log`. Save `v1-l9-toolchain.log`. Pass when the log shows WSL paths for `node`, `pnpm`, `adb`, and `maestro`, and the only `/mnt/c/` path is `tailscale.exe`.
- [ ] Lane 10. Start the Windows `adb.exe` server, run `doctor.sh`, stop that server, and run `doctor.sh` again. Save `v1-l10-doctor.log`. Pass when the first run names the port 5037 conflict and exits non-zero, and the second exits 0.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Seconds from a disconnected state to the `device` state through `connect.sh`, and the wall time of `doctor.sh`. Trunk has no scripts, so the trunk side is a raw `adb connect` and the diff-added work is the retry and checks around it.
- [ ] Probe. Run ten rounds. Each round runs `adb disconnect` and a timed raw `adb connect 100.127.128.74:5555`, then `adb disconnect` and a timed `connect.sh`, then a timed `doctor.sh`. Use `/usr/bin/time -f %e`.
- [ ] Baseline. Record the median of the raw `adb connect` times first.
- [ ] Rule. Fail when the median `connect.sh` time exceeds the raw median by more than 1 s, or when the median `doctor.sh` time exceeds 10 s.

**Review gate.** None. V1 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] The head is based on `main` after the verdict, and the patch-id is unchanged.
- [ ] The root records V1 as the stack root against `main` and reports STACK-READY. The operator lands the stack bottom-up.

## Gate CI on tests, copy, and testIDs (V2)

**Depends on.** V1.

**Files.**

- [ ] Edit `.github/workflows/ci.yml` to add a `test` job and two lint steps in the `quality` job.
- [ ] Edit the root `package.json` to add `"test": "turbo run test"`.
- [ ] Edit `apps/mobile/package.json` to add `lint:copy` and `lint:test-ids`, and to run `node --test scripts/lint` inside `test`.
- [ ] Create `apps/mobile/scripts/lint/copy-rules.mjs`, `apps/mobile/scripts/lint/check-copy.mjs`, and `apps/mobile/scripts/lint/copy-allow.txt`.
- [ ] Create `apps/mobile/lib/test-ids.ts`.
- [ ] Create `apps/mobile/scripts/lint/check-test-ids.mjs` and `apps/mobile/scripts/lint/test-id-exempt.txt`.
- [ ] Create `apps/mobile/scripts/lint/check-copy.test.mjs` and `apps/mobile/scripts/lint/check-test-ids.test.mjs`.
- [ ] Edit `.cursor/rules/mobile-expo.mdc` with one line each for `tid()` and the copy lint.
- [ ] Edit `apps/mobile/README.md` and `docs/SETUP.md` to name the new CI checks.

**Build.**

- [ ] Add a CI job named `Tests` that runs `pnpm install --frozen-lockfile` and `pnpm test`, with Node 22 and Go set up as the `quality` job does. Root `pnpm test` fans out through turbo to `jest --runInBand` in `apps/mobile` and `go test ./...` in `apps/backend`.
- [ ] Port the rules in `~/.local/share/moni-canvas/tools/lint_terms.py` to `copy-rules.mjs`. Drop the `greeting` rule and the `TODAY_AT` rule, because both test the canvas sample time of 2:06 pm. Keep every other rule, its regex, and its reason.
- [ ] Make `check-copy.mjs` parse every `.ts` and `.tsx` file under `apps/mobile/app/` and `apps/mobile/components/` with the TypeScript compiler API, skip `__tests__`, and test only JSX text and string literals that reach JSX or `accessibilityLabel`. It prints `<file>:<line>: <term>: <text>`. A hit listed in `copy-allow.txt` passes. A listed hit that no longer exists fails as `stale allow entry`, so the list only shrinks.
- [ ] Define the testID convention in `lib/test-ids.ts`. `Screen` is a string union of screen keys such as `'auth'`, `'nav'`, `'home'`, `'activity'`, `'txn'`, `'capture'`, `'review'`, `'chat'`, `'budget'`, `'debts'`, `'profile'`, `'wallet'`, `'sheet'`, and `'map'`. `TestId` is the template literal type `` `${Screen}.${string}` ``. `tid(screen, ...parts)` joins kebab-case parts with dots, for example `tid('home', 'recent', 'row', id)`.
- [ ] Make `check-test-ids.mjs` fail when a JSX `Pressable`, `TextInput`, or `Switch`, or a v2 control named in its `CONTROLS` list, has no `testID` prop, or has a `testID` that is not a `tid()` call. Files listed in `test-id-exempt.txt` pass. Seed that list with every current file that fails. The script fails when the list has more lines than `git show origin/main:apps/mobile/scripts/lint/test-id-exempt.txt` or the parent's copy, so the list only shrinks.

**You see.**

- [ ] The PR shows three green checks, `Lint and typecheck`, `Tests`, and `Android debug build`.
- [ ] `pnpm --filter moni lint:copy` prints `0 new copy hits` and the number of allowed v1 hits.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `check-copy.test.mjs` asserts these exact results. JSX text `Declined` fails with term `Decline`. `−RM45.90` passes. `-RM45.90` fails with term `hyphen before RM`. `RM 42` fails with term `RM space`. The identifier `insightsRoute` passes. The string `'summary'` passed to `router.push` passes. Run `node --test apps/mobile/scripts/lint`.
- [ ] `check-test-ids.test.mjs` asserts that a new file with `<Pressable onPress={f}>` and no `testID` fails, that `testID="raw"` fails, that `testID={tid('home', 'x')}` passes, and that an exempt list with one more line than its base fails. Run `node --test apps/mobile/scripts/lint`.
- [ ] Root `pnpm test` runs both suites and exits 0. Record the Jest and Go test counts in the trail.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `pnpm lint && pnpm check-types` at trunk and at head. Trunk has no `Tests` job and no copy or testID lint, so record that and gate `pnpm test` plus both lints at head. Save `v2-l1-quality.log`. Pass when lint and typecheck exit 0 at both SHAs and the three new commands exit 0 at head.
- [ ] Lane 2. Push a scratch branch `scratch/v2-copy` from head that adds the JSX text `Declined` to `app/(tabs)/index.tsx`, then delete the branch after CI finishes. Save `v2-l2-ci-copy-fail.log` from `gh run view --log-failed`. Pass when the `quality` job fails on `lint:copy` and names `Decline`.
- [ ] Lane 3. Push `scratch/v2-jest` with one failing Jest assertion in `lib/finance/__tests__`. Save `v2-l3-ci-jest-fail.log`. Pass when the `Tests` job fails and names that test.
- [ ] Lane 4. Push `scratch/v2-go` with one failing Go test in `apps/backend/internal/chat`. Save `v2-l4-ci-go-fail.log`. Pass when the `Tests` job fails and names that test.
- [ ] Lane 5. Push `scratch/v2-testid` that adds a new component file with a `Pressable` and no `testID`. Save `v2-l5-ci-testid-fail.log`. Pass when the `quality` job fails on `lint:test-ids` and names the file.
- [ ] Lane 6. Push `scratch/v2-stale` that changes one allowed v1 copy hit but leaves its line in `copy-allow.txt`. Save `v2-l6-ci-stale-allow.log`. Pass when `lint:copy` fails with `stale allow entry`.
- [ ] Lane 7. Feed the same fixture of glossary lines to `lint_terms.py` rules and to `copy-rules.mjs`, with the two dropped rules removed from the Python side. Save `v2-l7-rule-parity.log`. Pass when both produce the same set of hits.
- [ ] Lane 8. Run `pnpm test` in a clean WSL login shell that sources `env.sh`. Save `v2-l8-wsl-test.log`. Pass when it exits 0 with no Windows `node` in the log.
- [ ] Lane 9. Run `pnpm --filter moni test -- --verbose` without `MONI_CHAT_BENCH_EXPORT` or `MONI_CHAT_BENCH_REPLIES`. Save `v2-l9-live-bench-skipped.log`. Pass when both tests in `chat-bench-live.test.ts` show as skipped.
- [ ] Lane 10. Read the `Android debug build` job of the head CI run and of the trunk run with `gh run view --log`. Save `v2-l10-android-job.log`. Pass when the job is green and its duration is within 2 minutes of the trunk run.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. CI wall time per run, as the longest job, plus the `Tests` job duration. Trunk has no `Tests` job, so its duration is an absolute budget.
- [ ] Probe. Trigger `gh workflow run CI` three times on trunk and three times on head, alternating, and read durations with `gh run list --workflow CI --json databaseId,createdAt,updatedAt`.
- [ ] Baseline. Record the trunk median of the longest job first.
- [ ] Rule. Fail when the head median of the longest job exceeds the trunk median by more than 2 minutes, or when the `Tests` job median exceeds 6 minutes.

**Review gate.** None. V2 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the V1 tip after the verdict, patch-id unchanged.
- [ ] The root appends V2 on `redesign/v1-device-link` and reports STACK-READY. The operator lands the stack bottom-up.

## Build a standalone e2e APK beside the daily install (V3)

**Depends on.** V2.

**Files.**

- [ ] Edit `apps/mobile/app.config.ts` to read `APP_VARIANT`.
- [ ] Create `apps/mobile/scripts/device/build-apk.sh`.
- [ ] Create `apps/mobile/scripts/device/install.sh`.
- [ ] Create `apps/mobile/scripts/device/perf.sh` and `apps/mobile/scripts/device/perf-compare.mjs`.
- [ ] Create `apps/mobile/scripts/device/screenrecord.sh`.
- [ ] Create `apps/mobile/.env.e2e.example`.
- [ ] Edit `apps/mobile/.gitignore` to ignore `.env.e2e`.
- [ ] Edit `apps/mobile/scripts/device/test/device-scripts.test.sh`.
- [ ] Edit `apps/mobile/README.md` and `docs/SETUP.md`.

**Build.**

- [ ] In `app.config.ts`, when `APP_VARIANT === 'e2e'`, set `name` to `Moni E2E`, `android.package` to `com.anonymous.moni.e2e`, `ios.bundleIdentifier` to `com.anonymous.moni.e2e`, and `scheme` to `moni-e2e`. The distinct scheme keeps `moni://` links going to the daily app with no chooser. Without the variable the config is unchanged.
- [ ] Leave `EXPO_PUBLIC_AI_API_URL` empty in `.env.e2e.example`, so the e2e build uses `lib/ai/client/mock.ts` and never calls the production backend.
- [ ] Make `build-apk.sh` refuse to run in the main worktree, where `git rev-parse --git-dir` equals `git rev-parse --git-common-dir`, unless `--allow-main` is passed. It loads `apps/mobile/.env.e2e`, runs `APP_VARIANT=e2e npx expo prebuild --platform android --clean --no-install`, then `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`. It copies the APK to `~/.cache/moni-apk/<sha>/app-release.apk` with a `build.json` that records the SHA, the byte count, and the build seconds. A dirty tree uses the key `<sha>-dirty-<diff hash>`. A cached key skips the build.
- [ ] Make `install.sh <sha>` refuse any package other than `com.anonymous.moni.e2e`. It runs `adb install -r -d`, grants `CAMERA`, `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, and `POST_NOTIFICATIONS` with `pm grant`, and writes the SHA to `/data/local/tmp/moni-e2e.sha`. It skips the install when that file already holds the SHA.
- [ ] Make `perf.sh --sha <sha> [--flow <flow.yaml>]` write `perf.json` with these fields. `coldStartMs` is the median `TotalTime` of ten `am force-stop` and `am start -W -n com.anonymous.moni.e2e/.MainActivity` runs. `apkBytes` is the APK size. `bundleBytes` is the size of `assets/index.android.bundle` from `unzip -l`. With `--flow`, it runs `dumpsys gfxinfo com.anonymous.moni.e2e reset`, the flow, then `dumpsys gfxinfo`, and records `jankyPct`, `p50Ms`, `p90Ms`, and `p95Ms`. It also records the battery temperature from `dumpsys battery` and refuses to measure above 40 C.
- [ ] Make `perf-compare.mjs base.json head.json --rule <name>=<limit>` print one line per metric and exit 1 when any rule fails.
- [ ] Make `screenrecord.sh <seconds> <out.mp4>` run `adb shell screenrecord --time-limit <seconds>` and pull the file.

**You see.**

- [ ] The phone's launcher shows two icons, `Moni` and `Moni E2E`. `adb shell pm list packages | grep moni` lists `com.anonymous.moni` and `com.anonymous.moni.e2e`.
- [ ] `Moni E2E` opens to the sign-in screen with Metro stopped.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `device-scripts.test.sh` gains these cases. `install.sh` exits non-zero when the APK's package is `com.anonymous.moni`. `build-apk.sh` exits non-zero in the main worktree. A second `build-apk.sh` for a cached SHA exits 0 in under 5 s. `APP_VARIANT=e2e npx expo config --type public --json` prints `com.anonymous.moni.e2e` for `android.package` and `moni-e2e` for `scheme`, and the same command without the variable prints `com.anonymous.moni` and `moni`. Run `bash apps/mobile/scripts/device/test/device-scripts.test.sh`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Trunk cannot build an e2e APK, so record that and never install a trunk release build, because it would replace the daily app. Gate the head install. Read `lastUpdateTime` from `adb shell dumpsys package com.anonymous.moni`, install the head e2e APK, and read it again. Save `v3-l1-both-icons.png`. Pass when both icons show and the daily app's `lastUpdateTime` is unchanged.
- [ ] Lane 2. Stop any Metro process, start `Moni E2E` with `am start`, and wait 10 s. Save `v3-l2-sign-in.png`. Pass when the sign-in screen shows and `adb logcat -d -s ReactNativeJS` has no `Metro` or `packager` error.
- [ ] Lane 3. Send `adb shell input keyevent KEYCODE_MENU` inside `Moni E2E`. Save `v3-l3-no-dev-menu.png`. Pass when no dev menu and no LogBox toast appear.
- [ ] Lane 4. Run `adb shell am start -a android.intent.action.VIEW -d moni-e2e://` and then `-d moni://`. Save `v3-l4-deep-links.png`. Pass when the first opens `Moni E2E`, the second opens `Moni`, and no app chooser appears.
- [ ] Lane 5. Install the same APK twice and open **App info** for `Moni E2E` with `am start -a android.settings.APPLICATION_DETAILS_SETTINGS -d package:com.anonymous.moni.e2e`. Save `v3-l5-permissions.png`. Pass when the second install is skipped by the SHA check and `dumpsys package` shows the five permissions as `granted=true`.
- [ ] Lane 6. Run `build-apk.sh` twice for the head SHA. Save `v3-l6-cache.log`. Pass when the second run exits 0 in under 5 s and prints `cached`.
- [ ] Lane 7. Run `build-apk.sh` inside `/home/kaiz404/projects/moni`. Save `v3-l7-main-refused.log`. Pass when it exits non-zero and `git -C /home/kaiz404/projects/moni status --porcelain apps/mobile/android` is unchanged.
- [ ] Lane 8. Run `perf.sh --sha <head>` at the sign-in screen. Save `v3-l8-perf.json`. Pass when the file has non-null `coldStartMs`, `apkBytes`, and `bundleBytes`.
- [ ] Lane 9. Run `screenrecord.sh 20 v3-l9-launch.mp4` while a cold start runs, and take a screenshot at the end. Save `v3-l9-after-record.png`. Pass when the MP4 is larger than 100 KB and the screenshot shows the sign-in screen.
- [ ] Lane 10. Send the head APK with `taildrop.sh` while adb is up, then open **Downloads** in the Files app. Save `v3-l10-taildrop-apk.png`. Pass when `adb shell ls -l /sdcard/Download/` shows the APK with the same byte count as the cache copy.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Cold and warm build seconds, `apkBytes`, `bundleBytes`, and `coldStartMs` of the e2e release APK. Trunk has no release build path, so these are absolute budgets for the diff-added work, and V3's numbers become the baseline for every later PR.
- [ ] Probe. Run `build-apk.sh` once with an empty Gradle cache and three times warm with a one-line JS change between runs, then run `perf.sh` five times. Record the battery temperature for each sample.
- [ ] Baseline. Record that trunk has no e2e build, then record the head values as the program baseline in the trail.
- [ ] Rule. Fail when the warm build exceeds 6 minutes, the cold build exceeds 25 minutes, `apkBytes` exceeds 120 MB, or the median `coldStartMs` exceeds 3,000 ms. These budgets are guesses from the 288 MB multi-ABI debug APK. Replace each with the measured value plus 20 percent once V3 records it.

**Review gate.** None. V3 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the V2 tip after the verdict, patch-id unchanged.
- [ ] The root appends V3 on `redesign/v2-ci-gates` and reports STACK-READY. The operator lands the stack bottom-up.

## Seed e2e data, write the moni-device skill, and record the v1 baseline (V4)

**Depends on.** V3.

**Files.**

- [ ] Create `apps/mobile/scripts/e2e/seed.mjs`, `apps/mobile/scripts/e2e/fixtures.mjs`, and `apps/mobile/scripts/e2e/seed.test.mjs`.
- [ ] Create `apps/mobile/lib/ai/client/mock-fixtures.ts` and edit `apps/mobile/lib/ai/client/mock.ts`.
- [ ] Create `apps/mobile/lib/ai/client/__tests__/mock.test.ts`.
- [ ] Create `apps/mobile/.maestro/config.yaml`, `apps/mobile/.maestro/subflows/sign-in.yaml`, and `apps/mobile/.maestro/subflows/launch.yaml`.
- [ ] Create `apps/mobile/.maestro/flows/smoke/launch.yaml`, `sign-in.yaml`, `add-transaction.yaml`, and `approve-proposal.yaml`.
- [ ] Create `apps/mobile/.maestro/flows/perf/cold-start.yaml` and `apps/mobile/.maestro/flows/perf/scroll-list.yaml`.
- [ ] Create `apps/mobile/scripts/device/run-flows.sh` and `apps/mobile/scripts/device/review-pair.sh`.
- [ ] Create `.cursor/skills/moni-device/SKILL.md`, `.cursor/skills/moni-device/features/README.md`, and one feature file each for sign-in, add a transaction, and approve a proposal. Create the symlink `.claude/skills/moni-device` to `../../.cursor/skills/moni-device`, as the repo does for every other skill.
- [ ] Edit `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/components/nav/tab-bar.tsx`, `apps/mobile/components/nav/capture-button.tsx`, `apps/mobile/app/transaction/new.tsx`, and `apps/mobile/components/proposal/proposal-summary-sheet.tsx` to add `tid()` testIDs on the controls the smoke flows touch.
- [ ] Edit `.cursor/rules/mobile-expo.mdc` with one line that names the `moni-device` skill, and edit `apps/mobile/README.md` and `docs/SETUP.md`.

**Build.**

- [ ] Operator box O4 must be done or declined before the live lanes run.
- [ ] Sign Maestro in with an email and password test user. `app/(auth)/login.tsx` already calls `signIn`, which calls `supabase.auth.signInWithPassword` in `lib/auth/auth-context.tsx`. That path ships today, so the flows test real code and the binary gains no test-only entry. Google sign-in stays out of the flows. `subflows/sign-in.yaml` types `${E2E_EMAIL}` and `${E2E_PASSWORD}`.
- [ ] Make `seed.mjs --reset [--profile default|empty|heavy]` idempotent. It refuses to run when `SUPABASE_URL` equals the production URL in `apps/mobile/.env`, unless `--shared-project` is passed. With a secret key it creates the user through the admin API with a confirmed email. It deletes the user's rows in dependency order, then writes the profile's fixtures. A second run converges to the same rows.
- [ ] Make `fixtures.mjs` mirror the canvas sample in `~/.local/share/moni-canvas/v2/sample-data.json`, so a device screenshot and a board render show the same names. Shift every sample date by the days between Wed 14 Oct 2026 and today. The `default` profile has the four sample wallets including Wise in USD, about 60 transactions, budgets, one detected recurring bill, two debts, and three pending `proposed_transactions` rows. `empty` has only the user. `heavy` has 2,000 transactions. The Maybank wallet links `notification_package` to `com.android.shell`, so `adb shell cmd notification post` acts as a bank alert in later PRs.
- [ ] Make `seed.mjs --query <name>` print named read-only queries as JSON, such as `latest-transaction` and `pending-proposals`.
- [ ] Make the mock AI client return fixed extractions from `mock-fixtures.ts` for known inputs, such as `paid 6 ringgit parking at KLCC`, a Maybank alert text, and the receipt fixture's image hash. Unknown input keeps today's `unavailable` result. The mock already ships as the fallback when `EXPO_PUBLIC_AI_API_URL` is empty, so this adds no new path.
- [ ] Make `run-flows.sh` take `--sha`, `--seed`, and `--out`. It calls `install.sh`, `seed.mjs --reset`, then `maestro --device "$MONI_DEVICE_SERIAL" test <flows> --format junit --output <run>/report.xml --test-output-dir <run>/maestro -e E2E_EMAIL=... -e E2E_PASSWORD=...`. The run directory is `~/.local/share/moni-runs/<sha>/<timestamp>/`. It copies every `takeScreenshot` PNG to `--out`.
- [ ] Make `review-pair.sh <pr-id> <slug> <board> [--state <json>] <device.png>` render the board with `~/.local/share/moni-canvas/tools/render/render.sh --state <json>` and copy both PNGs to `~/.local/share/moni-runs/review/<pr-id>/` as `<pr-id>-review-<slug>-board.png` and `<pr-id>-review-<slug>-device.png`.
- [ ] Write the `moni-device` skill with `.claude/skills/create-verification-skill/SKILL.md`. It has the sections Launch, Doctor, Drive, Evidence, Cleanup, and Helpers, with the real commands above. Prove it once end to end per that skill's step 4.
- [ ] Record the trunk baseline. Run the four smoke flows and `perf.sh --flow flows/perf/scroll-list.yaml` on the v1 app, and store the outputs as `~/.local/share/moni-runs/baseline/v1/`.

**You see.**

- [ ] `run-flows.sh --seed default flows/smoke` prints `4/4 flows passed` and writes a `report.xml` with four test cases.
- [ ] `seed.mjs --query pending-proposals` prints three rows after a reset.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `seed.test.mjs` asserts that the date shift maps Wed 14 Oct 2026 to today and keeps the day-of-week order of the sample, and that the guard rejects the production URL with exit code 2. Run `node --test apps/mobile/scripts/e2e`.
- [ ] `mock.test.ts` asserts that `extractFromText({ text: 'paid 6 ringgit parking at KLCC' })` returns `status: 'ok'` with `amount: 6` and merchant `KLCC Parking`, and that an unknown text returns `status: 'unavailable'`. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Trunk has no flows, so record that and gate the smoke suite on the head APK. Run `flows/smoke`. Save `v4-l1-smoke-home.png`. Pass when `report.xml` shows 4 passed and 0 failed.
- [ ] Lane 2. Run `flows/smoke/sign-in.yaml`. Save `v4-l2-signed-in.png`. Pass when the Wallets tab shows `Maybank`, `Touch 'n Go`, `Cash`, and `Wise`.
- [ ] Lane 3. Run `flows/smoke/add-transaction.yaml`, which adds a RM12.50 expense through the v1 FAB. Save `v4-l3-added.png`. Pass when the row shows in the list and `seed.mjs --query latest-transaction` returns amount 12.5.
- [ ] Lane 4. Run `flows/smoke/approve-proposal.yaml` on a seeded pending proposal. Save `v4-l4-approved.png`. Pass when `pending-proposals` drops from 3 to 2 and the ledger has the approved amount.
- [ ] Lane 5. Run `seed.mjs --reset` twice and print row counts after each. Save `v4-l5-seed-twice.log`. Pass when both counts are equal.
- [ ] Lane 6. Run `seed.mjs --reset` with `SUPABASE_URL` set to the production URL. Save `v4-l6-prod-guard.log`. Pass when it exits 2 and writes nothing.
- [ ] Lane 7. Give a fresh subagent only `.claude/skills/moni-device/SKILL.md` and the task "approve one proposal on the phone". Save `v4-l7-cold-skill.png`. Pass when the subagent's run passes without reading any other repo doc.
- [ ] Lane 8. List the run directory with `find`. Save `v4-l8-run-tree.log`. Pass when it has `report.xml`, one `commands.json` per flow, and the PNGs copied to `--out`.
- [ ] Lane 9. Start two `run-flows.sh flows/smoke` commands at once. Save `v4-l9-serial.png`. Pass when the second waits for the lock and both reports show 4 passed.
- [ ] Lane 10. Run `review-pair.sh v4 home V2H-Home <lane 2 screenshot>`. Save `v4-l10-pair-board.png`. Pass when both review PNGs exist and the render line prints `errors=0`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Smoke suite wall time and flake count, plus `coldStartMs` and `timeToHomeMs`. `timeToHomeMs` is the time from `launchApp` to the first visible tab in `commands.json` of `flows/perf/cold-start.yaml`. The base has no flows, so the suite has an absolute budget, and the testID edits must not move start time.
- [ ] Probe. Run `flows/smoke` five times in a row. Run `perf.sh --flow flows/perf/cold-start.yaml` on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base `coldStartMs` and `timeToHomeMs` first.
- [ ] Rule. Fail on any failed flow in the five runs, on a suite median above 6 minutes, or on a head `coldStartMs` median more than 10 percent above the base.

**Review gate.** None. V4 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the V3 tip after the verdict, patch-id unchanged.
- [ ] The root appends V4 on `redesign/v3-e2e-apk` and reports STACK-READY. The operator lands the stack bottom-up.

## Delete dead code and collapse the three token sources (S1)

**Depends on.** V4.

**Files.**

- [ ] Create `apps/mobile/scripts/lint/find-unreferenced.mjs` and add `lint:unreferenced` to `apps/mobile/package.json` and the CI `quality` job.
- [ ] Delete `apps/mobile/components/summary/summary-charts.tsx`, `summary-pinmap.tsx`, and `deferred-section.tsx`.
- [ ] Delete `apps/mobile/components/transaction/proposal-card.tsx`, `apps/mobile/components/finance/starting-balance-field.tsx`, `apps/mobile/components/wallets/wallet-card-style-picker.tsx`, and `apps/mobile/components/ui/external-link.tsx`.
- [ ] Delete `apps/mobile/hooks/use-color-scheme.ts`, `use-color-scheme.web.ts`, `use-notification-processor.ts`, and `use-proposed-transactions.ts`.
- [ ] Delete `apps/mobile/notif.json`, which holds a real notification with a person's name, and `apps/mobile/assets/images/icon_old.png`, `favicon_old.png`, and `grain.png` when `find-unreferenced.mjs` confirms no reference.
- [ ] Create `apps/mobile/scripts/tokens/gen-theme-tokens.mjs` and `apps/mobile/constants/theme-tokens.generated.ts`.
- [ ] Edit `apps/mobile/hooks/use-theme-tokens.ts`. Delete `apps/mobile/constants/theme.ts` after its callers move.
- [ ] Create `apps/mobile/lib/theme/__tests__/theme-tokens.test.ts`.
- [ ] Edit `apps/mobile/scripts/lint/copy-allow.txt` and `test-id-exempt.txt` to drop the deleted files, and edit `apps/mobile/README.md` and `docs/DESIGN_SYSTEM.md`.

**Build.**

- [ ] Make `find-unreferenced.mjs` list every module under `components/`, `hooks/`, `constants/`, and `assets/` that no file imports or requires, ignoring `app/` route files. Delete what it lists. Then make it a CI check that fails on any listed module.
- [ ] Keep `app/scan/listen.tsx` for now. It has no inbound link, but C2 replaces it with the Say it page and deletes it in the same PR.
- [ ] Make `global.css` the only file that holds token values. `gen-theme-tokens.mjs` reads the `@variant light` and `@variant dark` blocks and writes `theme-tokens.generated.ts` with the token-name union and both value maps. `useThemeTokens()` takes its name list and fallbacks from the generated file. A `lint:tokens` CI step fails when the generated file differs from a fresh run.
- [ ] Settle the Appendix A question on first render. If `useCSSVariable` returns values on the first render, the hook drops the fallbacks entirely.

**You see.**

- [ ] `node apps/mobile/scripts/lint/find-unreferenced.mjs` prints `0 unreferenced modules`.
- [ ] Every v1 screen looks the same as at the base.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `theme-tokens.test.ts` asserts that the generated light `canvas` and dark `canvas` values equal the literals in `global.css`, and that the token-name list has the same length as the old `constants/theme.ts` list. Run `pnpm --filter moni test`.
- [ ] Run `node apps/mobile/scripts/tokens/gen-theme-tokens.mjs --check` and `pnpm --filter moni lint:unreferenced`. Both exit 0.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke` on the base APK and the head APK. Save `s1-l1-smoke.png`. Pass when both show 4 passed.
- [ ] Lane 2. Dump `maestro hierarchy` on the Wallets tab at base and head. Save `s1-l2-wallets.png`. Pass when the hierarchies have the same texts and bounds.
- [ ] Lane 3. Open the Insights tab at base and head. Save `s1-l3-summary.png`. Pass when the hierarchies match and the chart colours match by eye in the two screenshots.
- [ ] Lane 4. Switch to dark in Profile at base and head. Save `s1-l4-dark.png`. Pass when the hierarchies match and no surface shows a light fallback colour.
- [ ] Lane 5. Open the heatmap from the Insights tab. Save `s1-l5-heatmap.png`. Pass when the map screen opens.
- [ ] Lane 6. Open a wallet's detail page. Save `s1-l6-wallet.png`. Pass when the hierarchies match.
- [ ] Lane 7. Open the proposal sheet from a seeded proposal. Save `s1-l7-proposal.png`. Pass when the hierarchies match.
- [ ] Lane 8. Open the Chat tab. Save `s1-l8-chat.png`. Pass when the hierarchies match.
- [ ] Lane 9. Set `adb shell cmd uimode night yes` and cold start with the system theme. Save `s1-l9-cold-dark.png`. Pass when the first screenshot after launch shows dark surfaces.
- [ ] Lane 10. Record a 10 s cold start with `screenrecord.sh` at head. Save `s1-l10-first-frame.png`. Pass when no frame shows a fallback colour flash, judged on the video.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. `bundleBytes`, `apkBytes`, and `coldStartMs`.
- [ ] Probe. Run `perf.sh` on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base values first.
- [ ] Rule. Fail when head `bundleBytes` exceeds the base by more than 2 KB, or when the head `coldStartMs` median exceeds the base by more than 5 percent. Metro drops unreferenced modules, so expect the bundle to change only by the token edit.

**Review gate.** None. S1 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the V4 tip after the verdict, patch-id unchanged.
- [ ] The root appends S1 on `redesign/v4-e2e-data-and-smoke` and reports STACK-READY. The operator lands the stack bottom-up.

## Land v2 tokens, Funnel Display, springs, and haptics (F1)

**Depends on.** S1.

**Files.**

- [ ] Edit `apps/mobile/global.css` with the v2 colour roles for light and dark, the radii, the spacing, and the font families.
- [ ] Edit `apps/mobile/constants/theme-tokens.generated.ts` by rerunning `gen-theme-tokens.mjs`.
- [ ] Edit `apps/mobile/package.json` to add `@expo-google-fonts/funnel-display`.
- [ ] Edit `apps/mobile/app/_layout.tsx` to load the fonts and hold the splash screen until they load.
- [ ] Create `apps/mobile/components/ui/text.tsx`.
- [ ] Create `apps/mobile/scripts/codemods/text-to-v2.mjs`.
- [ ] Edit every file under `apps/mobile/app/` and `apps/mobile/components/` that imports `Text` from `react-native`, through the codemod.
- [ ] Create `apps/mobile/lib/motion/tokens.ts` and `apps/mobile/lib/motion/__tests__/tokens.test.ts`.
- [ ] Edit `apps/mobile/lib/haptics/index.ts` and create `apps/mobile/lib/haptics/__tests__/haptics.test.ts`.
- [ ] Edit `apps/mobile/components/nav/capture-button.tsx` and every caller of the four old haptic helpers.
- [ ] Edit `docs/DESIGN_SYSTEM.md` colour, type, and motion sections, `docs/REDESIGN.md` status line, `docs/redesign/tokens.md` if a value drifts, and `apps/mobile/README.md`.

**Build.**

- [ ] Map the v1 semantic names that screens already use to v2 values, so every screen restyles without an edit. `canvas` becomes Cream `#F6F2E9`, `card` becomes Paper `#FFFDF8`, `foreground` becomes Ink `#17181A`, and `muted` becomes Meta `#6B665C`. Add the v2 roles that have no v1 name, such as `sand`, `sand-light`, `hairline`, `ink-2`, `deep-mint`, `mint`, `mint-key`, `lemon`, `lilac`, `peach`, `coral`, `sky`, `aqua`, and `over`. Add the dark values from `V2F-Dark` under `@variant dark` with the same names.
- [ ] Settle the Funnel Display question in Appendix A before the codemod. Load `FunnelDisplay_400Regular`, `FunnelDisplay_600SemiBold`, and `FunnelDisplay_700Bold`. Android picks a custom font file by family name, not by `fontWeight`, so `Text` maps each weight to its own family.
- [ ] Make `Text` take a `variant` from the tokens.md type scale, `hero`, `amountHero`, `screenTitle`, `sectionTitle`, `cardTitle`, `rowTitle`, `body`, `meta`, `smallest`, and `caps`, and set the family, size, and line height for each.
- [ ] Make `text-to-v2.mjs` rewrite every `react-native` `Text` import to `@/components/ui/text` and map `font-semibold` and `font-bold` class names to the matching family. Add a CI lint step that fails on a `Text` import from `react-native` under `app/` or `components/`.
- [ ] Export the five springs and the drag rule from `lib/motion/tokens.ts`. `press` is stiffness 1600 and damping 80. `value` is 700 and 47.6. `control` is 800 and 33.9. `sheet` is 380 and 31.2. `throw` is 157.9 and 17.6. Every spring has mass 1. `drag` is 1:1 with no spring, per D8.
- [ ] Replace the four helpers in `lib/haptics/index.ts` with one function per moment in the tokens.md haptics table, `keypadTap`, `approve`, `notMine`, `thresholdOn`, `thresholdOff`, `scrubStep`, `toggleOn`, `toggleOff`, and `holdCommit`. On Android each calls `performAndroidHapticsAsync` with its `AndroidHaptics` constant from expo-haptics 57. Check the installed typings for the exact names first. Move every caller, including the direct `Haptics.*` calls in `capture-button.tsx`, then delete the old helper names.

**You see.**

- [ ] Every v1 screen shows Funnel Display text on a Cream ground with Paper cards.
- [ ] A keypad press on the v1 amount screen gives the `Keyboard_Tap` haptic.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `tokens.test.ts` asserts each spring equals its literal, for example `press` equals `{ stiffness: 1600, damping: 80, mass: 1 }`. Run `pnpm --filter moni test`.
- [ ] `haptics.test.ts` mocks `expo-haptics` and asserts that `approve()` calls `performAndroidHapticsAsync` with `AndroidHaptics.Confirm` and that `notMine()` calls it with `AndroidHaptics.Reject`. Run `pnpm --filter moni test`.
- [ ] `theme-tokens.test.ts` gains the assertion that light `canvas` is `#F6F2E9`. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke` at base and head. Save `f1-l1-home.png`. Pass when both runs show 4 passed and the head screenshot shows Cream and Paper.
- [ ] Lane 2. Open the Wallets tab at head and pair it with the `V2F-Bible` render through `review-pair.sh`. Save `f1-l2-type.png`. Pass when the row titles are visibly heavier than the meta lines and the glyphs match Funnel Display in the render.
- [ ] Lane 3. Record a cold start with `screenrecord.sh 10`. Save `f1-l3-first-text.png`. Pass when no frame in the video shows the system font before Funnel Display.
- [ ] Lane 4. Open the v1 amount screen, press three keypad digits, and read `adb shell dumpsys vibrator_manager`. Save `f1-l4-keypad.png`. Pass when the dump lists three recent effects with the `Keyboard_Tap` constant.
- [ ] Lane 5. Open the v1 FAB menu and read the vibrator dump. Save `f1-l5-fab.png`. Pass when exactly one effect follows the press.
- [ ] Lane 6. Switch Profile to dark. Save `f1-l6-dark.png`. Pass when every surface uses the `V2F-Dark` values and no text is unreadable.
- [ ] Lane 7. Open the Insights tab. Save `f1-l7-charts.png`. Pass when the charts render with v2 colours and no default black fill.
- [ ] Lane 8. Approve a seeded proposal in the v1 sheet. Save `f1-l8-approve.png`. Pass when the approve completes and the dump shows one `Confirm` effect.
- [ ] Lane 9. Run `pnpm --filter moni lint:copy`, `lint:test-ids`, and the new `Text` import lint at head. Save `f1-l9-lints.log`. Pass when all exit 0.
- [ ] Lane 10. Turn on **Remove animations** with `adb shell settings put global animator_duration_scale 0`, cold start, and restore the setting. Save `f1-l10-no-anim.png`. Pass when the app starts and shows the same screen as lane 1.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. `coldStartMs`, `timeToHomeMs`, `apkBytes`, and `bundleBytes`. The font load is the diff-added work in the start path.
- [ ] Probe. Run `perf.sh --flow flows/perf/cold-start.yaml` on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base values first.
- [ ] Rule. Fail when the head `timeToHomeMs` median exceeds the base by more than 120 ms, `apkBytes` grows by more than 1.5 MB, or `bundleBytes` grows by more than 60 KB.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 1, 2, and 6 screenshots into `~/.local/share/moni-runs/review/f1/` with `review-pair.sh`, beside the `V2F-Bible`, `V2F-Components`, and `V2F-Dark` renders, as `f1-review-<slug>-device.png` and `f1-review-<slug>-board.png`.
- [ ] Record a 30 to 60 second video of a cold start, a tab switch, and three keypad presses with `screenrecord.sh 60`. Save it as `~/.local/share/moni-runs/review/f1/f1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the S1 tip after the verdict, patch-id unchanged.
- [ ] The root appends F1 on `redesign/s1-subtract` and reports STACK-READY. The operator lands the stack bottom-up.

## Replace the press, button, and page chrome components (F2)

**Depends on.** F1.

**Files.**

- [ ] Create `apps/mobile/components/ui/press.tsx`.
- [ ] Create `apps/mobile/components/ui/button.tsx`.
- [ ] Create `apps/mobile/components/ui/header-icon-button.tsx`.
- [ ] Create `apps/mobile/components/ui/page.tsx`.
- [ ] Create `apps/mobile/components/ui/__tests__/press.test.tsx` and `apps/mobile/components/ui/__tests__/button.test.tsx`.
- [ ] Delete `apps/mobile/components/ui/tactile-pressable.tsx`, `primary-button.tsx`, `icon-action.tsx`, `brand-header.tsx`, `screen-shell.tsx`, `surface.tsx`, and `squircle-view.tsx`.
- [ ] Edit every caller of the deleted files under `apps/mobile/app/` and `apps/mobile/components/`.
- [ ] Edit `apps/mobile/package.json` to drop `react-native-fast-squircle` when no caller is left.
- [ ] Edit `apps/mobile/.maestro/` flows whose selectors change, and the two lint lists.
- [ ] Edit `docs/DESIGN_SYSTEM.md`, `docs/REDESIGN.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Make `Press` the only press primitive. It scales to 0.97 on the `press` spring, fills Sand light, and releases on the control. Its `testID` prop has the type `TestId` and is required, so a missing ID fails `tsc`.
- [ ] Make `Button` take `variant` of `primary`, `secondary`, `tertiary`, `approve`, `notMine`, or `destructive`, plus `loading` and `disabled`, at 52 tall per `V2F-Components`.
- [ ] Make `HeaderIconButton` the 44 circle with a 1.5 Hairline border, and `MoniButton` the 44 Ink circle with the Lilac `creation` glyph and the label "Ask Moni".
- [ ] Make `Page` render one of four headers per tokens.md, `home`, `tabRoot`, `pushed`, or `task`, with the real safe-area inset and content from y 104.
- [ ] Inventory callers with `rg` for each deleted file, move each caller, then delete the file. Add `Press`, `Button`, `HeaderIconButton`, and `MoniButton` to the `CONTROLS` list in `check-test-ids.mjs`.

**You see.**

- [ ] Every v1 screen uses the v2 header for its kind, and every button is a v2 capsule.
- [ ] `rg "tactile-pressable|primary-button|icon-action|brand-header|screen-shell" apps/mobile` prints nothing.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `press.test.tsx` renders `Press` with React Native Testing Library, fires `pressIn` and `pressOut`, and asserts that `onPress` ran once and the node has the given `testID`. Run `pnpm --filter moni test`.
- [ ] `button.test.tsx` asserts that a `loading` button ignores presses and that `disabled` sets `accessibilityState.disabled` to `true`. Run `pnpm --filter moni test`.
- [ ] `pnpm --filter moni check-types` fails on a scratch file that renders `Press` without `testID`, and passes once the scratch file is removed.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke` at base and head. Save `f2-l1-smoke.png`. Pass when both show 4 passed.
- [ ] Lane 2. Open each tab root at head. Save `f2-l2-tab-root.png`. Pass when each title is 28/32 left-aligned and the hierarchy shows no deleted component name.
- [ ] Lane 3. Push a wallet's detail page. Save `f2-l3-pushed.png`. Pass when the back button is a 44 circle and the title is left-aligned beside it, as `V2F-Components` page chrome draws it.
- [ ] Lane 4. Press and hold a primary button for 300 ms while `screenrecord.sh 5` runs. Save `f2-l4-pressed.png`. Pass when the video shows the 0.97 squish and the release on lift.
- [ ] Lane 5. Submit the v1 amount screen with an empty amount. Save `f2-l5-disabled.png`. Pass when the save button shows disabled and nothing is written.
- [ ] Lane 6. Sign out and sign in. Save `f2-l6-auth.png`. Pass when the sign-in button uses the `primary` variant and sign-in completes.
- [ ] Lane 7. Open the Chat tab and send a message. Save `f2-l7-chat.png`. Pass when the send control works and has a `chat.` testID in `maestro hierarchy`.
- [ ] Lane 8. Open Profile and toggle the theme. Save `f2-l8-profile.png`. Pass when the theme changes and every row is pressable.
- [ ] Lane 9. Turn on TalkBack with `adb shell settings put secure enabled_accessibility_services` for the TalkBack service, focus each header button, and restore the setting. Save `f2-l9-talkback.png`. Pass when every header button announces a label.
- [ ] Lane 10. Switch to dark and open each tab root. Save `f2-l10-dark.png`. Pass when every header button border and glyph is visible.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. `timeToHomeMs`, `bundleBytes`, and `p90Ms` over `flows/perf/scroll-list.yaml`.
- [ ] Probe. Run `perf.sh --flow flows/perf/scroll-list.yaml` on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base values first.
- [ ] Rule. Fail when the head `p90Ms` median exceeds the base by more than 2 ms, `timeToHomeMs` by more than 5 percent, or `bundleBytes` by more than 40 KB.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, and 4 screenshots into `~/.local/share/moni-runs/review/f2/` with `review-pair.sh` beside the `V2F-Components` render.
- [ ] Record a 30 to 60 second video of tab roots, a pushed page, and button presses. Save it as `~/.local/share/moni-runs/review/f2/f2-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the F1 tip after the verdict, patch-id unchanged.
- [ ] The root appends F2 on `redesign/f1-tokens` and reports STACK-READY. The operator lands the stack bottom-up.

## Replace every sheet and picker with one sheet host (F3)

**Depends on.** F2.

**Files.**

- [ ] Create `apps/mobile/lib/sheet/sheet-store.ts` and `apps/mobile/lib/sheet/__tests__/sheet-store.test.ts`.
- [ ] Create `apps/mobile/components/ui/sheet/sheet-host.tsx` and `apps/mobile/components/ui/sheet/sheet.tsx`.
- [ ] Create `apps/mobile/components/sheets/category-picker-sheet.tsx`, `option-picker-sheet.tsx`, and `confirm-sheet.tsx`.
- [ ] Edit `apps/mobile/app/_layout.tsx` to mount `SheetHost` above the root Stack.
- [ ] Delete `apps/mobile/components/categories/category-picker-content.tsx`, `category-picker-modal.tsx`, and `category-picker-modal.android.tsx`.
- [ ] Delete the currency, wallet, wallet colour, and wallet type picker files under `apps/mobile/components/finance/` and `apps/mobile/components/wallets/`, each in its content, modal, and `.android.tsx` form.
- [ ] Delete `apps/mobile/components/transaction/transaction-details-sheet.tsx`, `transaction-details-sheet.android.tsx`, `transaction-details-sheet-content.tsx`, and `apps/mobile/components/ui/bottom-sheet-primary-action.tsx`.
- [ ] Edit every caller, including `app/transaction/new.tsx`, `app/transaction/[id].tsx`, `app/wallet/new.tsx`, `app/wallet/[id].tsx`, `components/proposal/proposal-form.tsx`, and `components/profile/default-wallet-picker.tsx`.
- [ ] Edit `apps/mobile/package.json` to drop `@expo/ui` when `rg "@expo/ui" apps/mobile` finds no caller.
- [ ] Edit `docs/DESIGN_SYSTEM.md`, `docs/REDESIGN.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Settle the sheet-over-tab-bar question in Appendix A first. Build two throwaway prototypes on a scratch branch. Prototype A is a JS `SheetHost` above the root Stack. Prototype B is an expo-router `transparentModal` route per sheet. Keep the one where the scrim covers the tab bar, Android back closes the sheet, and the keyboard does not hide the pinned action. Record both screenshots in the trail.
- [ ] Model an open sheet as one typed union in `sheet-store.ts`, `SheetRequest`, with kinds `category`, `wallet`, `currency`, `walletType`, `colour`, and `confirm`, each with its own payload and result type. The store holds at most one open sheet. `openSheet(request)` returns a promise of the result or `null` on dismiss.
- [ ] Make `Sheet` follow tokens.md. Cream, top radius 32, a 36 by 5 grabber, a 22/26 title, a 44 close for pickers, a pinned 56 action, and a scrim of `rgba(23,24,26,0.32)` over the page and the tab bar. It rises on the `sheet` spring and drags 1:1.
- [ ] Make `CategoryPickerSheet` the `V2A-CategoryPick` grid, a 52 search field, three columns of Paper tiles with a 4 progress bar and "RM100 left" or "RM20 over".
- [ ] Move each caller to `openSheet`, then delete the old content, modal, and `.android.tsx` files in this PR.

**You see.**

- [ ] Every picker in the app opens as a Cream sheet that covers the tab bar.
- [ ] `rg -l "\.android\.tsx" apps/mobile/components` lists no picker file.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `sheet-store.test.ts` asserts that `openSheet({ kind: 'confirm', ... })` resolves to `true` when the confirm action runs, resolves to `null` on dismiss, and that a second `openSheet` while one is open resolves the first to `null`. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke` at base and head, where `add-transaction.yaml` picks a category. Save `f3-l1-category-sheet.png`. Pass when both show 4 passed and the head screenshot shows the grid sheet.
- [ ] Lane 2. Open the category picker and type `Tra` in search. Save `f3-l2-search.png`. Pass when only Transport and Travel tiles show.
- [ ] Lane 3. Open the wallet picker from the amount screen. Save `f3-l3-wallet.png`. Pass when the scrim covers the tab bar and the four seeded wallets list.
- [ ] Lane 4. Drag a sheet down past half its height. Save `f3-l4-dismissed.png`. Pass when the sheet closes and nothing changes.
- [ ] Lane 5. Press Android back with a sheet open. Save `f3-l5-back.png`. Pass when the sheet closes and the page stays.
- [ ] Lane 6. Open the currency picker on the new wallet page and focus its search field. Save `f3-l6-keyboard.png`. Pass when the keyboard leaves the pinned action visible.
- [ ] Lane 7. Delete a wallet from its page through the confirm sheet. Save `f3-l7-confirm.png`. Pass when the confirm sheet shows **Keep it** and **Delete** and the wallet is soft-deleted after **Delete**.
- [ ] Lane 8. Pick a colour and a type on the new wallet page. Save `f3-l8-wallet-form.png`. Pass when both values show on the form.
- [ ] Lane 9. Change the default wallet in Profile. Save `f3-l9-default-wallet.png`. Pass when the new default shows after a cold start.
- [ ] Lane 10. Open a picker in dark mode. Save `f3-l10-dark.png`. Pass when the sheet uses the dark Cream value and the scrim shows.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Frame times while a sheet opens and closes ten times, and `bundleBytes`.
- [ ] Probe. Create `flows/perf/sheet-open.yaml` and run `perf.sh --flow` with it on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base `jankyPct` and `p90Ms` first. The base opens v1 native sheets, so this compares two implementations of the same user action.
- [ ] Rule. Fail when the head `jankyPct` exceeds the base by more than 3 points or exceeds 8 percent, or when the head `p90Ms` exceeds 12 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 1, 3, and 6 screenshots into `~/.local/share/moni-runs/review/f3/` with `review-pair.sh` beside the `V2A-CategoryPick` and `V2F-Components` renders.
- [ ] Record a 30 to 60 second video of each picker opening, a drag dismiss, and the keyboard case. Save it as `~/.local/share/moni-runs/review/f3/f3-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the F2 tip after the verdict, patch-id unchanged.
- [ ] The root appends F3 on `redesign/f2-press-and-chrome` and reports STACK-READY. The operator lands the stack bottom-up.

## Replace rows, chips, toggles, progress, toasts, and states (F4)

**Depends on.** F3.

**Files.**

- [ ] Create `apps/mobile/components/ui/list-card.tsx`, `transaction-row.tsx`, `nav-row.tsx`, and `hold-menu.tsx`.
- [ ] Replace `apps/mobile/components/ui/chip.ts` with `chip.tsx`, and create `segmented.tsx`, `progress-bar.tsx`, `status-pill.tsx`, and `banner.tsx`.
- [ ] Create `apps/mobile/components/ui/toast.tsx` and `apps/mobile/lib/toast/toast-store.ts`.
- [ ] Create `apps/mobile/components/ui/skeleton.tsx` and `empty-tile.tsx`.
- [ ] Create tests under `apps/mobile/components/ui/__tests__/` and `apps/mobile/lib/toast/__tests__/`.
- [ ] Delete `apps/mobile/components/profile/settings-row.tsx`, `apps/mobile/components/charts/budget-progress-bar.tsx`, `apps/mobile/components/ui/feedback-state.tsx`, and `apps/mobile/components/providers/sync-status-indicator.tsx`.
- [ ] Edit the callers, including `app/(tabs)/index.tsx`, `app/transaction/index.tsx`, `app/(tabs)/profile.tsx`, `app/(tabs)/summary.tsx`, and `components/budgets/budget-progress-item.tsx`.
- [ ] Edit `docs/DESIGN_SYSTEM.md`, `docs/REDESIGN.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Make `TransactionRow` 66 tall per tokens.md, with a 42 tint bubble, title, meta, and amount, no chevron, and no ellipsis button. Meta reads "Category · Wallet" in day-grouped lists and "Date · Wallet" otherwise. It shows the "Auto" pill for routine auto-adds and the dashed bubble with "To review" for pending rows. Amounts format per the glossary, with U+2212 for expenses.
- [ ] Make `HoldMenu` follow `V2A-ActivityMenu`. Press feedback at 0 ms, a bloom from 250 ms, commit at 500 ms with the `holdCommit` haptic and a 1.02 lift, and a 220 wide Paper menu with **Edit category**, **Change wallet**, and **Delete**. A drift over 10 px or an early release cancels. The one-time hint chip "Hold a row for quick actions" shows until the first hold. Wire it on the v1 transaction list rows, with the pickers from F3.
- [ ] Make `Segmented` slide its Ink pill on the `control` spring and call `scrubStep` on change.
- [ ] Make `ProgressBar` follow the one progress style. Sand track, Ink 2 fill, and at or over budget a full Coral fill with "RMx over". It never draws past the track. Its label turns `#6B5410` at 75 percent.
- [ ] Make `toast-store.ts` hold at most one toast. `showToast({ text, undo })` shows the Ink capsule for 5 s and runs `undo` on **Undo**.
- [ ] Make `Banner`, `Skeleton`, and `EmptyTile` follow `V2F-States`. Skeletons are static and show only after 300 ms.

**You see.**

- [ ] The v1 transaction list shows v2 rows. Holding a row for 500 ms opens the three-item menu.
- [ ] Deleting from the menu shows the toast "Deleted" with **Undo**.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `transaction-row.test.tsx` renders an expense of 45.9 in MYR and asserts the amount text is `−RM45.90`, and renders an auto-added row and asserts the text `Auto`. Run `pnpm --filter moni test`.
- [ ] `progress-bar.test.tsx` renders spent 120 of budget 100 and asserts the label `RM20 over` and a fill width of 100 percent. Run `pnpm --filter moni test`.
- [ ] `toast-store.test.ts` asserts that a second `showToast` replaces the first and that `undo` runs once. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke` at base and head, then open the transaction list. Save `f4-l1-rows.png`. Pass when both show 4 passed and the head list shows v2 rows.
- [ ] Lane 2. Long-press a row with Maestro `longPressOn`. Save `f4-l2-hold-menu.png`. Pass when the menu shows exactly **Edit category**, **Change wallet**, and **Delete**, and the vibrator dump shows one `Confirm`.
- [ ] Lane 3. Choose **Delete** from the menu, then **Undo** within 5 s. Save `f4-l3-undo.png`. Pass when the row comes back and `seed.mjs --query latest-transaction` shows `deleted` as `false`.
- [ ] Lane 4. Choose **Change wallet** and pick Cash. Save `f4-l4-changed-wallet.png`. Pass when the row meta shows Cash.
- [ ] Lane 5. Cold start twice and open the list. Save `f4-l5-hint-once.png`. Pass when the hint chip shows before the first hold and never after it.
- [ ] Lane 6. Open Profile. Save `f4-l6-nav-rows.png`. Pass when each row has a trailing value and a chevron, as `V2F-Components` draws a navigation row.
- [ ] Lane 7. Open the budget list with the `default` seed, where Transport is RM20 over. Save `f4-l7-over.png`. Pass when the Transport bar is full Coral with "RM20 over".
- [ ] Lane 8. Seed a pending proposal and open the list. Save `f4-l8-pending-row.png`. Pass when the pending row shows the dashed bubble, "To review", and an unsigned amount.
- [ ] Lane 9. Seed `empty` and open the list. Save `f4-l9-empty.png`. Pass when the empty tile from `V2F-States` shows.
- [ ] Lane 10. Switch to dark and open the list with the hold menu. Save `f4-l10-dark.png`. Pass when rows, menu, and toast use the dark values.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Frame times while scrolling the transaction list with the `heavy` seed.
- [ ] Probe. Run `perf.sh --flow flows/perf/scroll-list.yaml` with `--seed heavy` on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base `jankyPct` and `p90Ms` first.
- [ ] Rule. Fail when the head `jankyPct` exceeds the base by more than 3 points or the head `p90Ms` exceeds the base by more than 2 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 1, 2, 7, and 8 screenshots into `~/.local/share/moni-runs/review/f4/` with `review-pair.sh` beside the `V2F-Components`, `V2A-ActivityMenu`, and `V2F-States` renders.
- [ ] Record a 30 to 60 second video of a hold, a delete with **Undo**, and a scroll. Save it as `~/.local/share/moni-runs/review/f4/f4-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the F3 tip after the verdict, patch-id unchanged.
- [ ] The root appends F4 on `redesign/f3-sheets` and reports STACK-READY. The operator lands the stack bottom-up.

## Build the five-slot tab bar, the + chooser, and the route moves (N1)

**Depends on.** F4.

**Files.**

- [ ] Edit `apps/mobile/app/(tabs)/_layout.tsx` for the tabs `index`, `activity`, `budget`, and `debts`, with the + between Activity and Budget.
- [ ] Move `apps/mobile/app/transaction/index.tsx` to `apps/mobile/app/(tabs)/activity.tsx`.
- [ ] Move `apps/mobile/app/(tabs)/summary.tsx` to `apps/mobile/app/(tabs)/budget.tsx`.
- [ ] Move `apps/mobile/app/debts.tsx` to `apps/mobile/app/(tabs)/debts.tsx`.
- [ ] Move `apps/mobile/app/(tabs)/chat.tsx` to `apps/mobile/app/chat.tsx`, a pushed page with no tab bar.
- [ ] Move `apps/mobile/app/(tabs)/profile.tsx` to `apps/mobile/app/profile.tsx`, pushed from the Home avatar.
- [ ] Rewrite `apps/mobile/components/nav/tab-bar.tsx`. Create `apps/mobile/components/nav/plus-button.tsx` and `apps/mobile/components/nav/capture-chooser.tsx`.
- [ ] Delete `apps/mobile/components/nav/capture-button.tsx`, `capture-actions.ts`, its test, and `tab-bar-icon.tsx`.
- [ ] Edit `apps/mobile/app/(tabs)/index.tsx` to use the `home` page header with the avatar and the Moni button.
- [ ] Edit `apps/mobile/app/_layout.tsx` and every `router.push` that names a moved route.
- [ ] Edit the smoke flows, `copy-allow.txt`, `test-id-exempt.txt`, `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md` if it names the tabs, `.cursor/rules/mobile-expo.mdc` routing section, and `apps/mobile/README.md`.

**Build.**

- [ ] Make the bar a floating Ink pill per tokens.md. Left and right 12, bottom 26, height 64, radius 32, five equal cells for Home, Activity, +, Budget, and Debts, with cream active and `#A9A397` inactive labels. Its active pill slides on the `control` spring.
- [ ] Make the + a 60 Mint key circle that sits 16 above the pill with a 6 cream ring. It has no active state. It opens the chooser through `openSheet` and rotates 45 degrees into the sheet's close button on the `control` spring. It renders above the sheet scrim, as `V2A-Capture` draws it.
- [ ] Make the chooser follow `V2A-Capture`. The title is "Add a transaction" and four 60 tall Paper capsule rows read **Type it**, **Scan a receipt**, **Say it**, and **Ask Moni**. In N1, each row closes the sheet and pushes the existing page, `/transaction/new`, `/scan/receipt`, `/scan/listen`, and `/chat`. C1 adds the slide-in timing.
- [ ] Make Moni chat, Profile, and every other root Stack route render with no tab bar.
- [ ] Rename every user-visible "Insights" string to "Budget" and delete the matching `copy-allow.txt` lines.

**You see.**

- [ ] The app opens on Home with a five-slot Ink bar. The + opens "Add a transaction" over a scrim that covers the bar, with the + shown as a close button.
- [ ] The Home avatar opens Profile, and the Moni button opens Moni chat with no tab bar.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Create `apps/mobile/components/nav/__tests__/capture-chooser.test.tsx`. It renders the chooser, presses **Say it**, and asserts that `router.push` received `/scan/listen` and the sheet store is empty. Run `pnpm --filter moni test`.
- [ ] `pnpm --filter moni check-types` passes with typed routes and no new `as any` or `as never` on a router call. Count both casts with `rg` at base and head and record that the head count is not higher.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke` at base with the base flows and at head with the updated flows. Save `n1-l1-smoke.png`. Pass when both show 4 passed.
- [ ] Lane 2. Tap each of the four tabs. Save `n1-l2-tabs.png`. Pass when each tab root opens, the active cell is cream, and the screenshot matches the `V2F-Nav` render by eye.
- [ ] Lane 3. Tap the +. Save `n1-l3-chooser.png`. Pass when the four rows show, the scrim covers the bar, and only the + shows above it.
- [ ] Lane 4. Choose **Ask Moni**, then press back. Save `n1-l4-chat.png`. Pass when the chat page shows no tab bar and back returns to Home.
- [ ] Lane 5. Tap the Home avatar. Save `n1-l5-profile.png`. Pass when Profile opens with no tab bar.
- [ ] Lane 6. Open the Debts tab with the `default` seed. Save `n1-l6-debts.png`. Pass when both seeded people show.
- [ ] Lane 7. Open the Budget tab. Save `n1-l7-budget.png`. Pass when the title reads "Budget" and `lint:copy` reports no `Insights` hit.
- [ ] Lane 8. Choose **Say it**. Save `n1-l8-say.png`. Pass when the v1 listening screen opens, which no link reached before.
- [ ] Lane 9. Open the chooser and press Android back. Save `n1-l9-back.png`. Pass when the sheet closes, the + returns to its rest state, and the page stays.
- [ ] Lane 10. Run `adb shell am start -a android.intent.action.VIEW -d moni-e2e://chat`. Save `n1-l10-chat-link.png`. Pass when Moni chat opens over the tabs and back lands on Home.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Frame times while switching tabs ten times and opening the chooser five times, plus `timeToHomeMs`.
- [ ] Probe. Create `flows/perf/tabs-and-plus.yaml`. Run `perf.sh --flow` with it on the base APK, which switches the v1 tabs and opens the v1 FAB menu, and on the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base `p90Ms`, `jankyPct`, and `timeToHomeMs` first.
- [ ] Rule. Fail when the head `p90Ms` exceeds the base by more than 2 ms, `jankyPct` by more than 3 points, or `timeToHomeMs` by more than 5 percent.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, 4, and 5 screenshots into `~/.local/share/moni-runs/review/n1/` with `review-pair.sh` beside the `V2F-Nav` and `V2A-Capture` renders.
- [ ] Record a 30 to 60 second video of the tabs, the + opening and closing, and each chooser row. Save it as `~/.local/share/moni-runs/review/n1/n1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the F4 tip after the verdict, patch-id unchanged.
- [ ] The root appends N1 on `redesign/f4-rows-and-feedback` and reports STACK-READY. The operator lands the stack bottom-up.

## Model main currency, upcoming bills, transaction source, and balance correction (G1)

**Depends on.** N1.

**Files.**

- [ ] Edit `packages/types/src/user.ts` to make the `currency` preference default `MYR`.
- [ ] Edit `packages/types/src/transaction.ts` to add `transactionSourceSchema` and the optional `source` and `kind` keys to `transactionMetadataSchema`.
- [ ] Create `packages/types/src/bill.ts` and export it from `packages/types/src/index.ts`.
- [ ] Create `apps/mobile/lib/finance/main-currency.ts` and `apps/mobile/lib/finance/bills.ts`.
- [ ] Create `apps/mobile/lib/finance/__tests__/main-currency.test.ts`, `bills.test.ts`, and `transaction-metadata.test.ts`.
- [ ] Edit `apps/mobile/lib/supabase/transactions.ts` to write `metadata.source` on create.
- [ ] Edit the creation sites `app/transaction/new.tsx`, `lib/supabase/proposed-transactions.ts`, `lib/ai/run-extraction.ts`, and `app/wallet/[id].tsx`.
- [ ] Edit `apps/mobile/app/(tabs)/budget.tsx` to replace its local currency `useState` with `useMainCurrency()`.
- [ ] Edit `docs/DATABASE.md` with the two metadata keys and `docs/REDESIGN.md` code gaps rows for bills, source, balance correction, and main currency.

**Build.**

- [ ] Write the shapes first in `packages/types`. `transactionSourceSchema` is `z.enum(['manual', 'voice', 'moni', 'notification', 'camera'])`. `transactionMetadataSchema` keeps `.passthrough()` and gains optional `source` and optional `kind: z.literal('balance_correction')`. `upcomingBillSchema` has `seriesKey`, `name`, `amount`, `currency`, `dueDate`, and `status` of `due`, `paid`, or `skipped`. `transactions.metadata` is JSONB already, so G1 needs no migration and no backend or wire change.
- [ ] Keep every new field optional, so `apps/web` still passes `pnpm --filter web check-types`.
- [ ] Make `selectMainCurrency(preferences)` return `preferences.currency` or `MYR`, and `useMainCurrency()` read it from the profile observable.
- [ ] Make `selectUpcomingBills(now, transactions, overrides)` return the bills due this month from `detectRecurring` in `lib/ai/facts/recurring.ts` and the `confirmed` rows in `recurringOverrides$` with kind `bill` or `subscription`. `dueDate` comes from `expected_day`.
- [ ] Write `source` at every creation site. Manual entry writes `manual`. An approved notification proposal writes `notification`. An approved chat text proposal writes `moni`. An approved image proposal writes `camera`. C2 writes `voice` and `camera` for live approvals. The wallet balance adjustment in `app/wallet/[id].tsx` writes `kind: 'balance_correction'` and keeps `analysisExcluded: true`. Rows from before G1 have no `source`, and readers show them as Manual.

**You see.**

- [ ] `seed.mjs --query latest-transaction` after a manual add prints `"source": "manual"` inside `metadata`.
- [ ] The Budget tab opens in MYR with the Wise USD wallet left out, and the choice holds after a cold start.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `main-currency.test.ts` asserts that empty preferences give `'MYR'` and that `{ currency: 'SGD' }` gives `'SGD'`. Run `pnpm --filter moni test`.
- [ ] `bills.test.ts` builds three monthly Netflix transactions of 54.9 on day 15 and asserts that `selectUpcomingBills` at Wed 14 Oct 2026 returns one bill with `dueDate` `'2026-10-15'`, amount `54.9`, and status `'due'`. Run `pnpm --filter moni test`.
- [ ] `transaction-metadata.test.ts` asserts that `transactionMetadataSchema.parse({ source: 'voice' })` keeps `source`, that `{ source: 'sms' }` throws, and that `{ ai_suggested: true }` still parses. Run `pnpm --filter moni test`.
- [ ] Run `pnpm check-types` at the root, which covers `apps/web`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke` at base and head. Save `g1-l1-smoke.png`. Pass when both show 4 passed.
- [ ] Lane 2. Add a manual expense through the chooser's **Type it** row. Save `g1-l2-manual.png`. Pass when `latest-transaction` has `metadata.source` equal to `manual`.
- [ ] Lane 3. Approve a seeded notification proposal. Save `g1-l3-notification.png`. Pass when the new transaction has `metadata.source` equal to `notification`.
- [ ] Lane 4. Send `paid 6 ringgit parking at KLCC` in Moni chat and approve the result. Save `g1-l4-moni.png`. Pass when the new transaction has `metadata.source` equal to `moni`.
- [ ] Lane 5. Adjust the Cash balance on its wallet page. Save `g1-l5-correction.png`. Pass when the new row has `metadata.kind` equal to `balance_correction` and `analysis_excluded` equal to `true`.
- [ ] Lane 6. Open the Budget tab with the `default` seed. Save `g1-l6-myr.png`. Pass when no `$` amount shows and the totals equal the MYR sums from `seed.mjs --query month-spend`.
- [ ] Lane 7. Open a seeded transaction from before G1. Save `g1-l7-old-row.png`. Pass when the detail page opens with no error in `adb logcat -d -s ReactNativeJS`.
- [ ] Lane 8. Ask Moni chat "what bills are due" with the `default` seed. Save `g1-l8-forecast.png`. Pass when the reply path completes and the seeded bill reaches the snapshot in the log line of the chat request.
- [ ] Lane 9. Run `pnpm --filter web check-types`. Save `g1-l9-web.log`. Pass when it exits 0.
- [ ] Lane 10. Cold start with the `heavy` seed and open the Budget tab. Save `g1-l10-heavy.png`. Pass when the tab renders and the log shows no slow-render warning.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. The run time of `selectUpcomingBills` over 2,000 transactions, and the Budget tab time to visible with the `heavy` seed.
- [ ] Probe. Add a Jest timing case that runs the selector 50 times and prints the median. Create `flows/perf/budget-open.yaml` and run it through `perf.sh --flow` on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base Budget time to visible first. The selector is new work with no base.
- [ ] Rule. Fail when the selector median exceeds 10 ms on WSL node, or when the head Budget time to visible exceeds the base by more than 50 ms.

**Review gate.** None. G1 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the N1 tip after the verdict, patch-id unchanged.
- [ ] The root appends G1 on `redesign/n1-nav-shell` and reports STACK-READY. The operator lands the stack bottom-up.

## Build Home, its first run, and the Wallets page (H1)

**Depends on.** G1.

**Files.**

- [ ] Rewrite `apps/mobile/app/(tabs)/index.tsx`.
- [ ] Create `apps/mobile/app/wallets.tsx`, which takes over the wallet list that the v1 Home showed.
- [ ] Create `apps/mobile/components/home/net-worth.tsx`, `spent-card.tsx`, `ask-box.tsx`, `review-block.tsx`, `recent-list.tsx`, `bills-strip.tsx`, `check-in-card.tsx`, and `setup-tiles.tsx`.
- [ ] Create `apps/mobile/components/charts/chart-card.tsx`, `pace-line.tsx`, `daily-bars.tsx`, `callout.tsx`, and `use-scrub.ts`.
- [ ] Create `apps/mobile/components/charts/__tests__/pace-line.test.tsx` and `apps/mobile/components/home/__tests__/check-in-card.test.tsx`.
- [ ] Delete `apps/mobile/components/wallets/confirm-balance-card.tsx` and its test, and `apps/mobile/components/ui/solid-wallet-card.tsx` and `gradient-card.tsx` when no caller is left.
- [ ] Create `apps/mobile/.maestro/flows/home/home.yaml`, `home-first-run.yaml`, `home-scrub.yaml`, and `home-check-in.yaml`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Build `V2H-Home` top to bottom. The header has the avatar, the date, and the greeting by local time of day, plus the Moni button. Then Net worth in the main currency only, the "Spent in October" card with the Pace and Daily toggle, the ask box, the review block, Recent with three rows and **See all**, the bills strip from `selectUpcomingBills`, and the check-in card.
- [ ] Make `PaceLine` and `DailyBars` follow the Charts section of tokens.md, in SVG. The plot is 314 by 150 with a 44 axis column. The line draws in once on the `value` spring on first open, never on return. Scrub snaps per day and calls `scrubStep`. There is no projection line and no readout row. "Left this month" subtracts bills and debts due, per D1.
- [ ] Keep both the ask box and the Moni button, per D4. The ask box and the Moni button open `/chat`. The review block opens the v1 proposal page until R1.
- [ ] Make the check-in card follow the `check` states on `V2H-Home`. **That's right** confirms through `confirmWalletBalance`. **Fix it** opens the wallet page in its balance edit. **Not now** hides it, with **Undo**.
- [ ] Build `V2H-HomeFirstRun` for a user with no data, with the three setup tiles.
- [ ] Build `V2H-Wallets` at `/wallets` in this PR, because the v1 Home was the only wallet list. It shows Net worth with the balance line for MYR wallets, the RINGGIT list, the US DOLLAR section kept apart with its "never converts" note, and **Add a wallet**. Tapping Net worth on Home opens it. K1 adds the Profile row.
- [ ] Implement the loading, empty, and offline banner states from `V2F-States` for Home.

**You see.**

- [ ] Home with the `default` seed shows Net worth `RM2,431.80`, the sum of the seeded Maybank, Touch 'n Go, and Cash balances, and no Wise dollars.
- [ ] Home with the `empty` seed shows "Welcome to Moni" and the three setup tiles.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `pace-line.test.tsx` renders 14 days of spend against a budget of 1,800 and asserts the even-pace label text `RM58` and that no element has the test ID of a projection line. Run `pnpm --filter moni test`.
- [ ] `check-in-card.test.tsx` moves the assertions of the deleted `confirm-balance-card.test.tsx` to the new card and asserts that **That's right** calls `confirmWalletBalance` once with the wallet id. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke` and `flows/home/home.yaml` at base and head. The base has the v1 Home, so gate that the head shows every `V2H-Home` block. Save `h1-l1-home.png`. Pass when smoke shows 4 passed at both and `home.yaml` finds all eight block testIDs at head.
- [ ] Lane 2. Pair the Home screenshot with the `V2H-Home` render through `review-pair.sh`. Save `h1-l2-home-pair.png`. Pass when every block, label, and order matches the board, judged in the lane report block by block.
- [ ] Lane 3. Read Net worth with the `default` seed, then tap it. Save `h1-l3-wallets.png`. Pass when Net worth equals the MYR wallet sum from `seed.mjs --query balances` with no `$`, and the Wallets page lists Wise apart under US DOLLAR, as the `V2H-Wallets` render draws it.
- [ ] Lane 4. Toggle Pace to Daily and back. Save `h1-l4-daily.png`. Pass when the bars show one per day so far, the part above even pace is Coral, and the vibrator dump shows one `Segment_Tick` per toggle.
- [ ] Lane 5. Run `flows/home/home-scrub.yaml`, which drags across the chart. Save `h1-l5-scrub.png`. Pass when the callout shows a day-first date and the amount for that day.
- [ ] Lane 6. Tap the ask box, then back, then the review block, then back. Save `h1-l6-entries.png`. Pass when the first opens Moni chat and the second opens the review page.
- [ ] Lane 7. Run `flows/home/home-check-in.yaml` through **That's right**, then reset and run it through **Not now** and **Undo**. Save `h1-l7-check-in.png`. Pass when `balance_confirmed_at` changes after the first and the card returns after **Undo**.
- [ ] Lane 8. Seed `empty` and run `flows/home/home-first-run.yaml`. Save `h1-l8-first-run.png`. Pass when the screenshot matches the `V2H-HomeFirstRun` render by eye and each setup tile opens its page.
- [ ] Lane 9. Read the bounds of Net worth, the spent card, and the review block from `maestro hierarchy`. Save `h1-l9-first-screen.png`. Pass when each block's bottom is above 744 dp, converted with the density from `adb shell wm density`.
- [ ] Lane 10. Switch to dark. Save `h1-l10-dark.png`. Pass when the screenshot matches the `V2F-Dark` render by eye.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. `timeToHomeMs`, and frame times while the chart draws in and while scrubbing.
- [ ] Probe. Run `perf.sh --flow flows/home/home-scrub.yaml` on the base APK and the head APK, alternating, five rounds each. The base flow scrolls the v1 Home instead, because v1 has no scrub.
- [ ] Baseline. Record the base `timeToHomeMs` and frame times first.
- [ ] Rule. Fail when the head `timeToHomeMs` median exceeds the base by more than 150 ms, the head `jankyPct` exceeds 8 percent, or the head `p90Ms` exceeds 12 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, 4, 5, and 8 screenshots into `~/.local/share/moni-runs/review/h1/` with `review-pair.sh` beside the `V2H-Home`, `V2H-HomeFirstRun`, and `V2H-Wallets` renders.
- [ ] Record a 30 to 60 second video of Home from cold start, the toggle, a scrub, and the check-in. Save it as `~/.local/share/moni-runs/review/h1/h1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the G1 tip after the verdict, patch-id unchanged.
- [ ] The root appends H1 on `redesign/g1-currency-bills-source` and reports STACK-READY. The operator lands the stack bottom-up.

## Build the Activity tab (A1)

**Depends on.** H1.

**Files.**

- [ ] Rewrite `apps/mobile/app/(tabs)/activity.tsx`.
- [ ] Create `apps/mobile/components/activity/activity-chart.tsx`, `search-field.tsx`, `filter-chips.tsx`, `day-group.tsx`, and `review-strip.tsx`.
- [ ] Create `apps/mobile/components/charts/balance-line.tsx`.
- [ ] Create `apps/mobile/lib/finance/activity-filter.ts` and `apps/mobile/lib/finance/__tests__/activity-filter.test.ts`.
- [ ] Create `apps/mobile/.maestro/flows/activity/activity.yaml`, `activity-search.yaml`, `activity-hold.yaml`, and `flows/perf/scroll-activity.yaml`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Build `V2A-Activity`. The header has the title and the Moni button. Then the "To review" strip, the chart card with the Spending and Balance toggle, the search field, the filter chips, day-grouped rows from F4, the hint chip, and **Show more**.
- [ ] Make `BalanceLine` the line chart with no budget and no even pace. Its axis does not start at 0, and its accessibility label says so. It shows main-currency wallets only.
- [ ] Make `filterActivity(transactions, { query, walletIds, mainCurrency })` a pure function that matches merchant, note, and category name, case-insensitive.
- [ ] Wire the hold menu from F4 per `V2A-ActivityMenu`.

**You see.**

- [ ] Activity with the `default` seed shows bars for each day so far and day groups headed "Today" and "Yesterday".
- [ ] Typing `grab` in search leaves only Grab rows.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `activity-filter.test.ts` asserts that query `grab` on three rows, `Grab`, `GrabFood`, and `Tesco`, returns the two Grab rows in date order, and that a USD wallet row is dropped when `mainCurrency` is `MYR`. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open the Activity tab at base, which shows the moved v1 list, and at head. Save `a1-l1-activity.png`. Pass when both list the same seeded rows for the last three days and head shows the chart card.
- [ ] Lane 2. Pair the head screenshot with the `V2A-Activity` render. Save `a1-l2-pair.png`. Pass when the blocks and their order match the board.
- [ ] Lane 3. Toggle Spending to Balance. Save `a1-l3-balance.png`. Pass when the line shows only MYR wallets and the accessibility label says the axis does not start at 0.
- [ ] Lane 4. Run `flows/activity/activity-search.yaml` with `grab`. Save `a1-l4-search.png`. Pass when only Grab rows show.
- [ ] Lane 5. Tap the Touch 'n Go chip. Save `a1-l5-chip.png`. Pass when only Touch 'n Go rows show.
- [ ] Lane 6. Run `flows/activity/activity-hold.yaml` through **Edit category** to Food. Save `a1-l6-edit-category.png`. Pass when the row meta shows Food and the database row agrees.
- [ ] Lane 7. Tap the "To review" strip. Save `a1-l7-to-review.png`. Pass when the review page opens with the seeded proposals.
- [ ] Lane 8. Seed `heavy` and tap **Show more** twice. Save `a1-l8-show-more.png`. Pass when more day groups load and no row repeats.
- [ ] Lane 9. Tap the Moni button. Save `a1-l9-moni.png`. Pass when Moni chat opens with no tab bar.
- [ ] Lane 10. Seed `empty` and open Activity. Save `a1-l10-empty.png`. Pass when the Activity empty tile from `V2F-States` shows.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Frame times while scrolling Activity with the `heavy` seed, and the tab's time to visible.
- [ ] Probe. Run `perf.sh --flow flows/perf/scroll-activity.yaml --seed heavy` on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base `jankyPct`, `p90Ms`, and time to visible first.
- [ ] Rule. Fail when the head `jankyPct` exceeds the base by more than 3 points, the head `p90Ms` exceeds the base by more than 2 ms, or the time to visible exceeds the base by more than 150 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, and 6 screenshots into `~/.local/share/moni-runs/review/a1/` with `review-pair.sh` beside the `V2A-Activity` and `V2A-ActivityMenu` renders.
- [ ] Record a 30 to 60 second video of the toggle, search, a hold, and a scroll. Save it as `~/.local/share/moni-runs/review/a1/a1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the H1 tip after the verdict, patch-id unchanged.
- [ ] The root appends A1 on `redesign/h1-home` and reports STACK-READY. The operator lands the stack bottom-up.

## Build transaction detail with in-place edits and the categories pages (A2)

**Depends on.** A1.

**Files.**

- [ ] Create `apps/mobile/components/ui/in-place-field.tsx` and `apps/mobile/components/ui/__tests__/in-place-field.test.tsx`.
- [ ] Rewrite `apps/mobile/app/transaction/[id].tsx` and `apps/mobile/app/transaction/_layout.tsx`, which loses its native header.
- [ ] Create `apps/mobile/components/transaction/detail-tiles.tsx` and `budget-line.tsx`.
- [ ] Rewrite `apps/mobile/app/categories/index.tsx` and `apps/mobile/app/categories/form.tsx`.
- [ ] Create `apps/mobile/.maestro/flows/activity/txn-detail.yaml`, `txn-edit.yaml`, and `categories.yaml`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Make `InPlaceField` follow the in-place edit section of tokens.md. A 32 Sand pencil sits 8 after the value with a 44 hit area. Tapping the value or the pencil swaps in a Paper field with a 2 Ink border, a cancel circle, and a save circle. It uses the system keyboard, numeric for amounts. Only one field edits at a time. Back or a tap outside cancels. Save shows the toast with **Undo**.
- [ ] Build `V2A-TxnDetail` and `V2A-TxnDetailEdit`. Merchant and amount edit in place. Category and wallet open the F3 pickers. The tiles show Type and Source, with Manual for rows that have no source. The budget line, the full-width note, the map card, the receipt row, and the visible **Delete transaction** button follow. Delete opens the confirm sheet "Delete this transaction?" with **Keep it** and **Delete**.
- [ ] Build `V2A-Categories` and `V2A-CategoryForm` on the existing category helpers in `lib/supabase/`.

**You see.**

- [ ] Tapping a row opens the detail page with no ellipsis button. Tapping the amount opens the numeric keyboard under an in-place field.
- [ ] Saving a new amount shows "Saved" with **Undo**.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `in-place-field.test.tsx` asserts that pressing the pencil shows the input, that typing `12.5` and pressing save calls `onSave` with `12.5`, that pressing cancel calls nothing, and that opening a second field closes the first. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open a seeded transaction and change its amount at base, through the v1 edit form, and at head, in place. Save `a2-l1-edited.png`. Pass when the database amount changes on both.
- [ ] Lane 2. Pair the head detail page with the `V2A-TxnDetail` render. Save `a2-l2-pair.png`. Pass when the blocks and their order match the board and no ellipsis button shows.
- [ ] Lane 3. Edit the amount to 18.20 and save. Save `a2-l3-amount.png`. Pass when the toast shows, **Undo** restores the old amount, and the database follows both steps.
- [ ] Lane 4. Edit the merchant name, then tap outside the field. Save `a2-l4-cancel.png`. Pass when the old name stays and nothing is written.
- [ ] Lane 5. Change the category through the picker. Save `a2-l5-category.png`. Pass when the budget line updates to the new category.
- [ ] Lane 6. Open a row approved from a notification and a seeded row from before G1. Save `a2-l6-source.png`. Pass when the Source tile reads Notification and Manual.
- [ ] Lane 7. Tap **Delete transaction**, then **Keep it**, then delete again with **Delete**. Save `a2-l7-delete.png`. Pass when the first keeps the row and the second soft-deletes it.
- [ ] Lane 8. Open Categories from Profile, archive one, and restore it. Save `a2-l8-categories.png`. Pass when the category moves to Archived and back.
- [ ] Lane 9. Create a category named `Pets` with an icon and a colour. Save `a2-l9-new-category.png`. Pass when `Pets` shows in the picker sheet.
- [ ] Lane 10. Run `pnpm --filter moni lint:copy` and confirm the Tags slot is gone. Save `a2-l10-no-tags.png`. Pass when the detail page has no "Tags" text and the lint exits 0.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from a row tap to the detail page's amount being visible, and time from a pencil tap to a focused input.
- [ ] Probe. Create `flows/perf/open-detail.yaml` and run it with `perf.sh --flow` on the base APK and the head APK, alternating, five rounds each. Read the times from `commands.json`.
- [ ] Baseline. Record the base row-to-detail time first. The pencil has no base.
- [ ] Rule. Fail when the head row-to-detail median exceeds the base by more than 100 ms, or the pencil-to-focus median exceeds 300 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, and 7 screenshots into `~/.local/share/moni-runs/review/a2/` with `review-pair.sh` beside the `V2A-TxnDetail`, `V2A-TxnDetailEdit`, and `V2A-Categories` renders.
- [ ] Record a 30 to 60 second video of an in-place amount edit, **Undo**, a category change, and a delete. Save it as `~/.local/share/moni-runs/review/a2/a2-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the A1 tip after the verdict, patch-id unchanged.
- [ ] The root appends A2 on `redesign/a1-activity` and reports STACK-READY. The operator lands the stack bottom-up.

## Build the capture slide-in and the Type it amount page (C1)

**Depends on.** A2.

**Files.**

- [ ] Create `apps/mobile/app/capture/_layout.tsx` and `apps/mobile/app/capture/type.tsx`.
- [ ] Create `apps/mobile/components/capture/amount-page.tsx`, `keypad.tsx`, `amount-sentence.tsx`, and `duplicate-sheet.tsx`.
- [ ] Create `apps/mobile/lib/capture/amount-input.ts` and `apps/mobile/lib/capture/__tests__/amount-input.test.ts`.
- [ ] Edit `apps/mobile/components/nav/capture-chooser.tsx` to time the page push with the sheet dismissal.
- [ ] Delete `apps/mobile/app/transaction/new.tsx`, `apps/mobile/components/ui/numeric-keypad.tsx`, and `apps/mobile/components/finance/amount-input.tsx`, after moving their callers.
- [ ] Edit `apps/mobile/.maestro/flows/smoke/add-transaction.yaml` and create `apps/mobile/.maestro/flows/capture/type-it.yaml` and `type-duplicate.yaml`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Make the chooser follow `V2A-CaptureFlow-VA`. Choosing a row starts the sheet's drop and pushes the page with a slide from the right in the same frame, as one transition. Closing the page returns to the screen the + was pressed on.
- [ ] Make `AmountPage` the one keypad page for new money, per `V2P-AmountPage`. C1 uses it for Type it. B2 and D1 reuse it for a bill, a debt, a repayment, and lending more. Keys are Paper, 56 tall, and each press calls `keypadTap`.
- [ ] Make `amount-input.ts` a pure reducer over key presses that holds at most two decimals and at most nine digits and returns the display string and the number.
- [ ] Build `V2A-CaptureType`. The type segmented control has Expense, Income, and Transfer. The sentence under the amount reads like the board. Category, wallet, and date use the F3 pickers. The wallet picker lists main-currency wallets only. The "Shop or note" input and the **Save** button follow.
- [ ] Build `V2A-CaptureTypeDuplicate`. When a saved row in the last 3 days has the same amount and merchant, show "Looks like a duplicate" with **Review that one**, **Add mine anyway**, and **Change the amount**. Reuse `lib/ai/duplicates` for the match.

**You see.**

- [ ] Tapping **Type it** drops the sheet while the amount page slides in from the right.
- [ ] Saving RM12.50 at Tesco adds the row with `metadata.source` equal to `manual` and returns to the origin tab.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `amount-input.test.ts` asserts that the keys `1`, `2`, `.`, `5`, `0`, `7` give the display `12.50` and the number `12.5`, that backspace on `12.50` gives `12.5`, and that a tenth digit before the point is ignored. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke/add-transaction.yaml` at base, through the v1 form, and at head, through the amount page. Save `c1-l1-added.png`. Pass when both add a RM12.50 row.
- [ ] Lane 2. Pair the amount page with the `V2A-CaptureType` render. Save `c1-l2-pair.png`. Pass when the blocks and their order match the board.
- [ ] Lane 3. Record the + to **Type it** transition with `screenrecord.sh 5`. Save `c1-l3-transition.png`. Pass when the video shows the sheet dropping while the page slides in, with no frame of the bare origin screen between them.
- [ ] Lane 4. Press `1`, `2`, `5` on the keypad and read the vibrator dump. Save `c1-l4-keypad.png`. Pass when the amount reads `125` and the dump shows three `Keyboard_Tap` effects.
- [ ] Lane 5. Switch to Income and to Transfer. Save `c1-l5-transfer.png`. Pass when Transfer shows a from wallet and a to wallet and the sentence changes to match.
- [ ] Lane 6. Open the wallet picker. Save `c1-l6-wallets.png`. Pass when Wise USD is not listed.
- [ ] Lane 7. Run `flows/capture/type-duplicate.yaml`, which enters a seeded amount and merchant from yesterday. Save `c1-l7-duplicate.png`. Pass when the duplicate sheet shows its three options and **Add mine anyway** adds the row.
- [ ] Lane 8. Start the flow from the Activity tab and save. Save `c1-l8-origin.png`. Pass when the app returns to Activity with the new row on top.
- [ ] Lane 9. Press Android back on the amount page with a typed amount. Save `c1-l9-back.png`. Pass when the page closes and nothing is written.
- [ ] Lane 10. Type an expense of 45.90 and read the sentence. Save `c1-l10-minus.png`. Pass when the amount text uses U+2212 in `−RM45.90`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from the + tap to the first keypad key being pressable, and frame times during the transition.
- [ ] Probe. Create `flows/perf/plus-to-type.yaml` and run it with `perf.sh --flow` on the base APK, through the N1 chooser and the v1 form, and on the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base time and frame times first.
- [ ] Rule. Fail when the head time exceeds the base by more than 100 ms or exceeds 600 ms, or when the head `jankyPct` during the transition exceeds 8 percent.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 5, and 7 screenshots into `~/.local/share/moni-runs/review/c1/` with `review-pair.sh` beside the `V2A-CaptureType`, `V2A-CaptureTypeDuplicate`, and `V2P-AmountPage` renders.
- [ ] Record a 30 to 60 second video of the + to **Type it** transition, keypad entry, the pickers, and a save. Save it as `~/.local/share/moni-runs/review/c1/c1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the A2 tip after the verdict, patch-id unchanged.
- [ ] The root appends C1 on `redesign/a2-txn-detail` and reports STACK-READY. The operator lands the stack bottom-up.

## Build the Say it and Scan a receipt pages (C2)

**Depends on.** C1.

**Files.**

- [ ] Create `apps/mobile/app/capture/say.tsx` and `apps/mobile/app/capture/scan.tsx`.
- [ ] Create `apps/mobile/components/capture/capture-result-card.tsx`, `listening.tsx`, and `scan-stages.tsx`.
- [ ] Create `apps/mobile/lib/capture/scan-stage.ts` and `apps/mobile/lib/capture/__tests__/scan-stage.test.ts`.
- [ ] Delete `apps/mobile/app/scan/_layout.tsx`, `receipt.tsx`, and `listen.tsx`, `apps/mobile/components/scan/pulsing-orb.tsx`, and `apps/mobile/components/receipt/fab-receipt-processing-overlay.tsx`, after moving their callers, including the overlay mount in `app/_layout.tsx`.
- [ ] Create `apps/mobile/.maestro/flows/capture/say.yaml`, `say-denied.yaml`, `scan.yaml`, and `scan-failed.yaml`, plus `apps/mobile/.maestro/fixtures/receipt-mamak.jpg` and `receipt-blank.jpg`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Build `V2A-CaptureSay`, `V2A-CaptureSayHeard`, and `V2A-CaptureSayDenied` on the existing `lib/speech` helpers. Listening shows the timer and the live transcript with **Done speaking** and **Type it instead**. Heard shows the quote, the shop and the amount in place, the category, wallet, and date, the evidence line, and **Say again** and **Approve**. Denied shows **Turn on microphone** and **Type it instead**.
- [ ] Model the scan stages as one union in `scan-stage.ts`, `camera`, `reading`, `result`, `approved`, and `failed`, with one transition function. The camera stage calls `scanAndNormalizeReceipt` in `lib/receipts/` and keeps the ML Kit document scanner, per D11. Reading, result, approved, and failed follow `V2A-CaptureScan`, `V2A-CaptureScanAdded`, and `V2A-CaptureScanFailed`.
- [ ] Approve a voice or scan capture straight to the ledger, never through the Review queue, with `metadata.source` set to `voice` or `camera`. Approve calls the `approve` haptic.
- [ ] Settle the two Appendix A questions on driving voice and the scanner from Maestro before writing `say.yaml` and `scan.yaml`.

**You see.**

- [ ] **Say it** opens the listening page. After speech, the heard card shows the shop and amount with pencils and **Approve**.
- [ ] **Scan a receipt** opens the ML Kit scanner. After a capture, the result card shows the shop, amount, category, wallet, and date, and **Approve** shows "Added to Maybank".

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `scan-stage.test.ts` asserts these transitions. `camera` with a captured image goes to `reading`. `reading` with `status: 'ok'` goes to `result`. `reading` with `status: 'unavailable'` goes to `failed`. `result` with approve goes to `approved`. Any other event leaves the stage unchanged. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run a receipt scan with `receipt-mamak.jpg` imported from the gallery in the ML Kit scanner at base and head. Save `c2-l1-scan.png`. Pass when the base creates a pending proposal, the head shows the result card, and **Approve** at head adds a transaction with `metadata.source` equal to `camera`.
- [ ] Lane 2. Pair the result card with the `V2A-CaptureScan` render in its `result` state. Save `c2-l2-pair.png`. Pass when the blocks and their order match the board.
- [ ] Lane 3. Approve the scan result. Save `c2-l3-added.png`. Pass when "Added to Maybank" shows with **Back to Home** and **Scan another**, and `pending-proposals` is unchanged.
- [ ] Lane 4. Run `flows/capture/scan-failed.yaml` with `receipt-blank.jpg`. Save `c2-l4-failed.png`. Pass when the failed page shows the tips with **Try again** and **Type it instead**.
- [ ] Lane 5. Edit the scanned amount in place before approving. Save `c2-l5-edit.png`. Pass when the ledger row has the edited amount.
- [ ] Lane 6. Revoke `RECORD_AUDIO` with `pm revoke` and choose **Say it**. Save `c2-l6-denied.png`. Pass when the denied page matches the `V2A-CaptureSayDenied` render and **Type it instead** opens the amount page.
- [ ] Lane 7. Grant the mic, choose **Say it**, and wait 4 s. Save `c2-l7-listening.png`. Pass when the timer counts and **Done speaking** shows.
- [ ] Lane 8. Play `apps/mobile/.maestro/fixtures/parking.wav` from the PC speaker beside the phone while **Say it** listens, per the Appendix A experiment. Save `c2-l8-heard.png`. Pass when the heard card shows `6` as the amount. If the experiment found this path unworkable, record the lane as `BLOCKED` with that finding, and the review video covers the heard state with the operator speaking.
- [ ] Lane 9. Approve the heard card. Save `c2-l9-voice-added.png`. Pass when the new transaction has `metadata.source` equal to `voice`.
- [ ] Lane 10. Run `rg "scan/listen|scan/receipt" apps/mobile` at head. Save `c2-l10-old-routes.log`. Pass when it prints nothing.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from the scanner's return to the visible result card, with the mock AI client.
- [ ] Probe. Run `flows/capture/scan.yaml` five times each on the base APK, to the v1 proposal sheet, and on the head APK, alternating. Read the time between the scanner return and the result card from `commands.json`.
- [ ] Baseline. Record the base time to the v1 proposal sheet first.
- [ ] Rule. Fail when the head median exceeds the base by more than 200 ms or exceeds 1,500 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, 4, and 6 screenshots into `~/.local/share/moni-runs/review/c2/` with `review-pair.sh` beside the `V2A-CaptureScan`, `V2A-CaptureScanAdded`, `V2A-CaptureScanFailed`, and `V2A-CaptureSayDenied` renders.
- [ ] Record a 30 to 60 second video of a scan through approval and of **Say it** with the operator speaking "paid 6 ringgit parking at KLCC". Save it as `~/.local/share/moni-runs/review/c2/c2-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the C1 tip after the verdict, patch-id unchanged.
- [ ] The root appends C2 on `redesign/c1-type-it` and reports STACK-READY. The operator lands the stack bottom-up.

## Store the Later state and the auto-add rules (G2)

**Depends on.** C2.

**Files.**

- [ ] Edit `packages/types/src/proposed-transaction.ts` to widen `status` and add `snoozedUntil`.
- [ ] Create `packages/types/src/auto-add-rule.ts` and export it from `packages/types/src/index.ts`.
- [ ] Create `supabase/migrations/20261022000000_review_later_and_auto_add_rules.sql`, with the timestamp set to the day the owner writes it.
- [ ] Edit `apps/mobile/lib/store/index.ts` to add `autoAddRules$` and list it in `ALL_STORE_OBSERVABLES`.
- [ ] Create `apps/mobile/lib/supabase/auto-add-rules.ts` and `apps/mobile/lib/supabase/__tests__/auto-add-rules.test.ts`.
- [ ] Edit `apps/mobile/lib/supabase/proposed-transactions.ts` and its tests.
- [ ] Edit `apps/mobile/lib/ai/routine.ts` and `apps/mobile/lib/ai/__tests__/routine.test.ts`.
- [ ] Edit `apps/mobile/scripts/e2e/fixtures.mjs` and `seed.mjs` for the new table.
- [ ] Edit `docs/DATABASE.md`, `docs/REDESIGN.md` code gaps rows, and `apps/mobile/README.md`.

**Build.**

- [ ] Write the shapes first. `status` becomes `z.enum(['pending', 'later', 'rejected', 'approved'])`, and `snoozedUntil` is an optional nullable datetime. `autoAddRuleSchema` has `id`, `userId`, `merchantKey`, `sourceApp`, `walletId`, `categoryId`, `createdAt`, `updatedAt`, and `deleted`.
- [ ] Write the migration on the pattern of `20261013000000_recurring_overrides.sql`. Replace the `proposed_transactions` status CHECK with one that adds `'later'`, and add `snoozed_until TIMESTAMPTZ NULL`. Create `auto_add_rules` with `created_at`, `updated_at` and its trigger, `deleted`, one RLS policy on `auth.uid() = user_id`, and the realtime publication. Every change is additive. The installed app ignores the new column and table, and shows a `later` row as pending, which is safe.
- [ ] Apply the migration to the e2e project with `npx supabase db push --project-ref <e2e-ref>`. Operator box O7 covers production.
- [ ] Add `laterProposedTransaction(id, until)` and make reject set `status = 'rejected'` before the soft delete, per D6. Make the pending query return rows where `status` is `pending`, or `later` with `snoozed_until` in the past.
- [ ] Make `matchRoutine` in `lib/ai/routine.ts` check `autoAddRules$` first. A notification whose package and merchant key match a rule goes straight to the ledger, marked Auto, with the rule's wallet and category.

**You see.**

- [ ] `seed.mjs --query auto-add-rules` prints the seeded rule for `GRAB`.
- [ ] A posted Maybank alert for GRAB becomes an Auto row, and one for an unknown shop becomes a pending proposal.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `routine.test.ts` gains two cases. A notification with merchant `GRAB*1234` and a rule for merchant key `grab` returns `{ kind: 'auto', walletId, categoryId }` from the rule. The same notification with no rule and no history returns a proposal. Run `pnpm --filter moni test`.
- [ ] `proposed-transactions` tests assert that a `later` row with `snoozedUntil` one hour ahead is not pending and one hour behind is pending. Run `pnpm --filter moni test`.
- [ ] `auto-add-rules.test.ts` asserts that `createAutoAddRule` writes the row into the store with `deleted: false`. Run `pnpm --filter moni test`.
- [ ] Run `pnpm check-types` at the root, which covers `apps/web`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke/approve-proposal.yaml` at base and head against the migrated e2e project. Save `g2-l1-approve.png`. Pass when both approve and the base app shows no error from the new column.
- [ ] Lane 2. Grant listener access per O5 or `adb shell cmd notification allow_listener`, then post `Maybank: RM12.00 spent at GRAB*1234` with `adb shell cmd notification post -S bigtext -t Maybank g2 "<text>"`. Save `g2-l2-auto.png`. Pass when Activity shows the row with the Auto pill and no new pending proposal.
- [ ] Lane 3. Post the same alert for `KEDAI ABC`. Save `g2-l3-proposal.png`. Pass when `pending-proposals` grows by one.
- [ ] Lane 4. Reject a seeded proposal in the review page. Save `g2-l4-rejected.png`. Pass when its row has `status` equal to `rejected` and `deleted` equal to `true`.
- [ ] Lane 5. Seed a `later` row with `snoozed_until` in the past and one in the future, then open the review page. Save `g2-l5-later.png`. Pass when only the past one shows.
- [ ] Lane 6. Clear `Moni E2E` data with `adb shell pm clear com.anonymous.moni.e2e`, sign in, and open Activity. Save `g2-l6-rules-sync.png`. Pass when `autoAddRules$` holds the seeded rule again, read from the store debug log line.
- [ ] Lane 7. Query `auto_add_rules` as a second seeded user with that user's JWT. Save `g2-l7-rls.log`. Pass when the query returns 0 rows.
- [ ] Lane 8. Run `pnpm --filter web check-types`. Save `g2-l8-web.log`. Pass when it exits 0.
- [ ] Lane 9. Run `npx supabase db push --project-ref <e2e-ref> --dry-run` after the push. Save `g2-l9-dry-run.log`. Pass when it reports no pending migration.
- [ ] Lane 10. Install the base APK, post the KEDAI alert, and approve it, then reinstall the head APK. Save `g2-l10-mixed.png`. Pass when both builds read the same queue with no crash.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. `matchRoutine` time with 200 rules and 2,000 transactions of history, and the time from sign-in to the first synced Home render.
- [ ] Probe. Add a Jest timing case for `matchRoutine` with the median of 50 runs. Run `flows/smoke/sign-in.yaml` five times each on the base APK and the head APK, alternating, and read the time from `commands.json`.
- [ ] Baseline. Record the base sign-in to Home time and the base `matchRoutine` median first.
- [ ] Rule. Fail when the head `matchRoutine` median exceeds the base by more than 5 ms, or the head sign-in to Home median exceeds the base by more than 300 ms.

**Review gate.** None. G2 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the C2 tip after the verdict, patch-id unchanged.
- [ ] The root appends G2 on `redesign/c2-say-and-scan` and reports STACK-READY. The operator lands the stack bottom-up after O7.

## Build the Review card deck (R1)

**Depends on.** G2.

**Files.**

- [ ] Create `apps/mobile/lib/proposals/review-actions.ts` with the submit and duplicate logic moved out of `components/proposal/proposal-form.tsx`, and `apps/mobile/lib/proposals/__tests__/review-actions.test.ts`.
- [ ] Create `apps/mobile/lib/proposals/review-card-state.ts` and its test.
- [ ] Create `apps/mobile/app/review.tsx`.
- [ ] Create `apps/mobile/components/review/review-card.tsx`, `deck.tsx`, `edge-cues.tsx`, `result-pill.tsx`, and `caught-up.tsx`.
- [ ] Delete `apps/mobile/app/proposal/[id].tsx`, `apps/mobile/app/proposal/_layout.tsx`, `apps/mobile/components/proposal/proposal-summary-sheet.tsx`, `proposal-form.tsx`, `field-row.tsx`, `ai-reasoning-section.tsx`, and `proposal-location-section.tsx`, after moving the callers. Remove the global sheet mount from `app/_layout.tsx`.
- [ ] Edit the Home review block, the Activity strip, and chat to push `/review`.
- [ ] Edit `docs/redesign/tokens.md` to replace "No peek of the next card" with the D7 default.
- [ ] Edit `apps/mobile/.maestro/flows/smoke/approve-proposal.yaml` and create `apps/mobile/.maestro/flows/review/swipe.yaml`, `buttons.yaml`, and `edit-in-card.yaml`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Move the logic out of the v1 form first. `review-actions.ts` exports `approve(proposal, edits)`, `notMine(proposal)`, and `later(proposal)`. Each returns a result that the deck shows, and each is tested without React.
- [ ] Model the card state as the `ReviewCardState` union from `CG-Guide`, `idle`, `dragging`, `armedApprove`, `armedNotMine`, `armedLater`, `editing`, `needsInput`, `saving`, and `error`, with one reducer.
- [ ] Build `XA-Review`. One top card, and under it a blank card at scale 0.96 per D7. The card has the source row, the quoted alert, merchant and amount with pencils from A2, category and wallet chips that open the F3 pickers, the evidence line, the "Don't ask about similar" checkbox, and the result pill. Buttons read **Not mine**, **Later**, and **Approve**, equal and 52 tall.
- [ ] Drive the swipe with `Gesture.Pan` on the UI thread. The card follows the finger 1:1 and tilts up to 8 degrees. Commit on the projected position `x + 0.5 * v` at 40 percent of the width, right for Approve, left for Not mine, down for Later. Crossing the threshold calls `thresholdOn` once. Release throws on the `throw` spring. While a field is editing, the pan is off.
- [ ] Make "Don't ask about similar" create an auto-add rule from G2 on Approve.
- [ ] Show the "All caught up" state with this session's results and a link to the Capture log, per D6.
- [ ] Settle the swipe-deck performance question in Appendix A before the gesture code is final.

**You see.**

- [ ] The review block on Home opens the deck. Swiping right approves with a `Confirm` haptic and the toast "Approved" with **Undo**.
- [ ] The last card ends on "All caught up".

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `review-card-state.test.ts` asserts that a drag to 45 percent with zero velocity gives `armedApprove`, a drag to 30 percent with velocity 2,000 px/s gives `armedApprove` because the projection passes 40 percent, and a drag to 30 percent with zero velocity returns to `idle` on release. Run `pnpm --filter moni test`.
- [ ] `review-actions.test.ts` asserts that `approve` with a null wallet returns `{ status: 'needsInput', field: 'wallet' }` and writes nothing, and that `notMine` sets `status` to `rejected`. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke/approve-proposal.yaml` at base, through the v1 sheet, and at head, through the deck. Save `r1-l1-approved.png`. Pass when both drop `pending-proposals` by one and add the ledger row.
- [ ] Lane 2. Pair the deck with the `XA-Review` render. Save `r1-l2-pair.png`. Pass when the card blocks match the board and the card under it is blank at 0.96.
- [ ] Lane 3. Swipe the top card right with Maestro `swipe`. Save `r1-l3-swipe-right.png`. Pass when the ledger gains the row, the vibrator dump shows `Toggle_On` then `Confirm`, and the toast shows **Undo**.
- [ ] Lane 4. Swipe left. Save `r1-l4-swipe-left.png`. Pass when the toast reads "1 not mine" and the row has `status` equal to `rejected`.
- [ ] Lane 5. Swipe down. Save `r1-l5-swipe-down.png`. Pass when the row has `status` equal to `later` and a future `snoozed_until`.
- [ ] Lane 6. Drag right to 25 percent and release slowly. Save `r1-l6-snap-back.png`. Pass when the card returns to the centre and nothing is written.
- [ ] Lane 7. Run `flows/review/edit-in-card.yaml`, which edits the amount in place and then tries to swipe. Save `r1-l7-edit.png`. Pass when the keyboard opens, the swipe does nothing while editing, and Approve after save writes the edited amount.
- [ ] Lane 8. Open a seeded proposal with no wallet. Save `r1-l8-needs-wallet.png`. Pass when **Approve** asks for a wallet and nothing is written until one is picked.
- [ ] Lane 9. Tick "Don't ask about similar" and approve. Save `r1-l9-similar.png`. Pass when `auto-add-rules` gains a row for that merchant.
- [ ] Lane 10. Clear the queue with the buttons. Save `r1-l10-caught-up.png`. Pass when "All caught up" lists this session's results and links to the Capture log.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Frame times over 20 swipes through a 20-card queue, and time from a swipe's release to the ledger row in the store. The base has no deck, so both are absolute budgets, and the base number is the v1 sheet's approve time.
- [ ] Probe. Create `flows/perf/swipe-20.yaml` and run `perf.sh --flow` with it on the head APK five times with a 20-proposal seed. Run the v1 approve five times on the base APK, alternating with the head runs, for the approve time.
- [ ] Baseline. Record the base approve time first.
- [ ] Rule. Fail when the head `jankyPct` exceeds 5 percent, the head `p90Ms` exceeds 12 ms, or the head release-to-store median exceeds the base approve time by more than 100 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, 7, and 10 screenshots into `~/.local/share/moni-runs/review/r1/` with `review-pair.sh` beside the `XA-Review` render in its default, armed, and done states.
- [ ] Record a 30 to 60 second video of swipes in three directions, a snap back, an in-card edit, and the end state. Save it as `~/.local/share/moni-runs/review/r1/r1-review.mp4`. Also play `V2F-Feel` in Edge for the same moves and post both videos.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the G2 tip after the verdict, patch-id unchanged.
- [ ] The root appends R1 on `redesign/g2-review-data` and reports STACK-READY. The operator lands the stack bottom-up.

## Approve captures from the Android notification (R2)

**Depends on.** R1.

**Files.**

- [ ] Edit `apps/mobile/package.json` and `apps/mobile/app.json` plugins to add the notification library that the Appendix A experiment picks.
- [ ] Create `apps/mobile/lib/notifications/review-notification.core.js` and the thin `apps/mobile/lib/notifications/review-notification.ts`, per the `mobile-headless-js` rule.
- [ ] Edit `apps/mobile/index.js` to register the background action handler.
- [ ] Edit `apps/mobile/lib/ai/processing-queue.ts` to post the review notification when a proposal is created.
- [ ] Create `apps/mobile/scripts/notification-review-suite.mjs` and add `test:notification-review` to `apps/mobile/package.json`.
- [ ] Create `apps/mobile/.maestro/flows/review/notification.yaml`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md` for the new headless path, and `apps/mobile/README.md`.

**Build.**

- [ ] Read `.cursor/rules/mobile-headless-js.mdc` before editing. Run the Appendix A experiment on notification actions first, with `expo-notifications` and one alternative, and keep the library whose action handler runs with the app killed on HyperOS.
- [ ] Post `XA-Notification` for each new proposal. The expanded notification shows the category chip and three actions, **Not mine**, **Later**, and **Approve**. A heads-up variant shows for the first alert.
- [ ] Run each action through `review-actions.ts` from R1 inside the headless handler, with no React. After Approve, update the notification to "Approved" with **Undo** and "Don't ask about similar" for 8 s.
- [ ] Open the review sheet over the app when the notification body is tapped.

**You see.**

- [ ] A posted bank alert produces a Moni notification with **Not mine**, **Later**, and **Approve**.
- [ ] Tapping **Approve** with the app killed adds the ledger row and changes the notification to "Approved".

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `notification-review-suite.mjs` requires `review-notification.core.js` and asserts that the payload for a RM12.00 GRAB proposal has the title `Maybank alert`, the body `GRAB · RM12.00`, and the action ids `not-mine`, `later`, and `approve` in that order. Run `pnpm --filter moni test:notification-review`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Post the KEDAI alert at base and head. The base has no review notification, so record that and gate that both create the pending proposal and the head also posts the Moni notification. Save `r2-l1-posted.png`. Pass when `pending-proposals` grows by one on both and `adb shell dumpsys notification` lists the Moni notification at head.
- [ ] Lane 2. Expand the shade with `adb shell cmd statusbar expand-notifications`. Save `r2-l2-shade.png`. Pass when the notification matches the `XA-Notification` render by eye, with the three actions in order.
- [ ] Lane 3. Tap **Approve** with the app in the background. Save `r2-l3-approved.png`. Pass when the ledger gains the row and the notification reads "Approved" with **Undo**.
- [ ] Lane 4. Tap **Undo** within 8 s. Save `r2-l4-undo.png`. Pass when the ledger row is removed and the proposal is pending again.
- [ ] Lane 5. Run `adb shell am force-stop com.anonymous.moni.e2e`, post an alert, and tap **Approve**. Save `r2-l5-killed.png`. Pass when the ledger gains the row within 3 s.
- [ ] Lane 6. Tap **Not mine**. Save `r2-l6-not-mine.png`. Pass when the row has `status` equal to `rejected`.
- [ ] Lane 7. Tap **Later**. Save `r2-l7-later.png`. Pass when the row has `status` equal to `later`.
- [ ] Lane 8. Tap the notification body. Save `r2-l8-sheet.png`. Pass when the app opens the review sheet for that proposal.
- [ ] Lane 9. Post the first alert after a cold install. Save `r2-l9-heads-up.png`. Pass when the heads-up variant shows.
- [ ] Lane 10. Tap "Don't ask about similar" after Approve. Save `r2-l10-similar.png`. Pass when `auto-add-rules` gains the merchant's rule.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from an Approve tap with the app killed to the ledger row in Supabase, plus `apkBytes` and `coldStartMs`.
- [ ] Probe. Run lane 5's steps five times and poll `seed.mjs --query latest-transaction` every 200 ms. Run `perf.sh` on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base `apkBytes` and `coldStartMs` first. The headless approve has no base.
- [ ] Rule. Fail when the killed-app approve median exceeds 3,000 ms, `apkBytes` grows by more than 1.5 MB, or the head `coldStartMs` median exceeds the base by more than 5 percent.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, and 9 screenshots into `~/.local/share/moni-runs/review/r2/` with `review-pair.sh` beside the `XA-Notification` render.
- [ ] Record a 30 to 60 second video of an alert arriving, the shade, Approve with the app killed, and **Undo**. Save it as `~/.local/share/moni-runs/review/r2/r2-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the R1 tip after the verdict, patch-id unchanged.
- [ ] The root appends R2 on `redesign/r1-review-deck` and reports STACK-READY. The operator lands the stack bottom-up.

## Build the Moni chat page, its cards, and one thread per day (H2)

**Depends on.** R2.

**Files.**

- [ ] Edit `apps/mobile/lib/ai/chat/messages.ts` to add the message kinds `assistant_draft`, `assistant_card`, and `assistant_noticed`.
- [ ] Edit `apps/mobile/lib/ai/chat/sessions.ts` to key a thread by local date in the finance timezone.
- [ ] Create `apps/mobile/lib/ai/chat/answer-cards.ts` and `apps/mobile/lib/ai/chat/__tests__/answer-cards.test.ts`.
- [ ] Edit `apps/mobile/lib/ai/chat/__tests__/messages.test.ts` and create `sessions.test.ts`.
- [ ] Rewrite `apps/mobile/app/chat.tsx`. Create `apps/mobile/app/chat/history.tsx`.
- [ ] Rewrite `apps/mobile/components/chat/chat-input-bar.tsx` and `message-bubble.tsx`. Create `apps/mobile/components/chat/draft-card.tsx`, `answer-card.tsx`, `noticed-card.tsx`, and `thinking-card.tsx`. Delete `apps/mobile/components/chat/quick-reply-chips.tsx` if the clarify kind moves into the composer.
- [ ] Create `apps/mobile/.maestro/flows/chat/draft.yaml`, `answer.yaml`, and `history.yaml`.
- [ ] Edit `docs/AI.md` for the client-side cards, `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Write the message shapes first as a discriminated union in `messages.ts`. `assistant_draft` holds a `proposalId`. `assistant_card` holds a `card` of kind `category_spend`, `budget_progress`, or `bill_due`, with the ids it reads. `assistant_noticed` holds the text and a link target.
- [ ] Pick and fill answer cards on the device. `pickAnswerCard(question, snapshot)` in `answer-cards.ts` chooses a card from the question's topic and fills it from the local finance snapshot, so the card numbers come from the ledger and the model cannot change them. The model's reply is the caption. The backend and the wire contract stay unchanged.
- [ ] Render a draft capture as the R1 review card in its compact form, with the same `review-actions.ts` calls and the same **Not mine**, **Later**, and **Approve**.
- [ ] Replace the 24-hour idle session with one thread per local date. Opening chat reopens today's thread. "Earlier today" folds older messages of the same day. `/chat/history` lists past days with search, edit mode, removal, and **Undo**, per `V2H-ChatHistory`.
- [ ] Keep the three ways in from `V2H-MoniPlacement`, the Home ask box, the Moni header button on Home and Activity, and the chooser's **Ask Moni** row. All three open today's thread.

**You see.**

- [ ] Sending `paid 6 ringgit parking at KLCC` shows a draft card with KLCC Parking and RM6.00, and **Approve** adds the row.
- [ ] Asking "How much on Transport this month" shows the thinking card, then an answer card whose amount equals the Transport total.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `answer-cards.test.ts` builds a snapshot with Transport spend 140 and budget 120 and asserts that `pickAnswerCard('How much on Transport this month', snapshot)` returns `{ kind: 'category_spend', categoryId: <transport id>, spent: 140, budget: 120 }`. Run `pnpm --filter moni test`.
- [ ] `sessions.test.ts` asserts that a message at 23:59 and one at 00:01 local time land in two threads, and two messages 20 hours apart on one date land in one thread. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Send `paid 6 ringgit parking at KLCC` at base and head. Save `h2-l1-draft.png`. Pass when the base creates a proposal and the head shows the draft card, and both store a RM6.00 proposal.
- [ ] Lane 2. Pair the thread with the `V2H-AskMoni` render. Save `h2-l2-pair.png`. Pass when the blocks and their order match the board.
- [ ] Lane 3. Edit the draft amount in place to 7, then **Approve**. Save `h2-l3-approved.png`. Pass when the ledger row is RM7.00 with `metadata.source` equal to `moni` and the card shows the done row with **Undo**.
- [ ] Lane 4. Run `flows/chat/answer.yaml`. Save `h2-l4-answer.png`. Pass when the answer card's amount equals `seed.mjs --query month-spend` for Transport.
- [ ] Lane 5. Send four messages, cold start, and open chat. Save `h2-l5-earlier.png`. Pass when today's thread reopens with "Earlier today" folded.
- [ ] Lane 6. Open the history page and search `parking`. Save `h2-l6-history.png`. Pass when today's thread matches and a removal shows **Undo**.
- [ ] Lane 7. Open chat from the Home ask box, the Activity Moni button, and the **Ask Moni** row. Save `h2-l7-entries.png`. Pass when all three show the same thread.
- [ ] Lane 8. Tap **Not mine** on a draft card. Save `h2-l8-not-mine.png`. Pass when the toast reads "1 not mine" and the proposal has `status` equal to `rejected`.
- [ ] Lane 9. Ask a question the mock does not know. Save `h2-l9-unavailable.png`. Pass when the page shows the `V2F-States` unavailable message and the composer still works.
- [ ] Lane 10. Focus the composer. Save `h2-l10-keyboard.png`. Pass when the system keyboard opens, the last message stays visible, and the mic button shows.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from send to the answer card with the mock client, and frame times while scrolling a 100-message thread.
- [ ] Probe. Run `flows/chat/answer.yaml` five times each on the base APK, to the v1 reply text, and on the head APK, alternating. Create `flows/perf/chat-scroll.yaml` and run it with `perf.sh --flow` the same way after sending 100 messages.
- [ ] Baseline. Record the base send-to-reply time and frame times first.
- [ ] Rule. Fail when the head send-to-card median exceeds the base send-to-reply median by more than 150 ms, or the head `jankyPct` exceeds the base by more than 3 points.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, 4, and 6 screenshots into `~/.local/share/moni-runs/review/h2/` with `review-pair.sh` beside the `V2H-AskMoni`, `V2H-AskMoniAnswer`, and `V2H-ChatHistory` renders.
- [ ] Record a 30 to 60 second video of a draft capture, an approve, a question with its card, and the history page. Save it as `~/.local/share/moni-runs/review/h2/h2-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the R2 tip after the verdict, patch-id unchanged.
- [ ] The root appends H2 on `redesign/r2-review-notification` and reports STACK-READY. The operator lands the stack bottom-up.

## Build the Budget tab, the category page, and budget editing (B1)

**Depends on.** H2.

**Files.**

- [ ] Rewrite `apps/mobile/app/(tabs)/budget.tsx`.
- [ ] Replace `apps/mobile/app/budget/index.tsx` with `apps/mobile/app/budget/[categoryId].tsx`, and `apps/mobile/app/budget/form.tsx` with `apps/mobile/app/budget/edit.tsx`.
- [ ] Create `apps/mobile/components/budget/ring.tsx`, `calendar-heat.tsx`, `month-sheet.tsx`, `bills-list.tsx`, and `map-teaser.tsx`.
- [ ] Create `apps/mobile/lib/finance/calendar-heat.ts` and `apps/mobile/lib/finance/__tests__/calendar-heat.test.ts`.
- [ ] Delete `apps/mobile/components/charts/donut-chart.tsx`, `line-chart.tsx`, and `activity-calendar.tsx`, and `apps/mobile/components/budgets/budget-progress-item.tsx`, once no caller is left.
- [ ] Create `apps/mobile/.maestro/flows/budget/month.yaml`, `calendar.yaml`, `category.yaml`, and `edit.yaml`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Build `V2P-InsightsMonth` as the tab root titled "Budget". It has the Month and Calendar toggle, the month chooser sheet, the "Spent in October" pace chart from H1 with left this month after bills and debts due per D1, the Budgets heading with its routing chevron per D9, the ring grid per D2, the bills list from `selectUpcomingBills` with "x days left", **Add a bill**, and the "Where you spend" map teaser.
- [ ] Make `Ring` the 44 box with stroke 5, a Sand track, and an Ink 2 fill from 12 o'clock on the `value` spring. Over budget shows a full Coral ring and "RM20 over".
- [ ] Build `V2P-InsightsCalendar`. `calendarHeat(days, evenPace)` buckets each day as Under, 1.5x, 2x, or Over 2x, and marks bill due days. The selected-day panel lists that day's rows.
- [ ] Build `V2P-BudgetDetail` as the one category page, with the 12 progress bar, the monthly budget in place from A2, the "No budget" variant with **Set a budget**, the chart, bills, transactions with pending "To review" rows, and top merchants.
- [ ] Build `V2P-BudgetEdit` with the monthly total and each category cap edited in place on the system keyboard. There is no slider.
- [ ] Implement the states on `V2P-InsightsStates` and `V2P-PlanStates`.

**You see.**

- [ ] The Budget tab shows the pace chart, a ring per budgeted category, and the bills list with the seeded Netflix bill.
- [ ] Tapping the Transport ring opens its category page with "RM20 over" in Over text.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `calendar-heat.test.ts` asserts that with even pace 58, days of spend 40, 90, 120, and 200 map to `under`, `x1_5`, `x2`, and `over_x2`. Run `pnpm --filter moni test`.
- [ ] Create `apps/mobile/components/budget/__tests__/ring.test.tsx`. It renders spent 140 of 120 and asserts the label `RM20 over` and a full sweep. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open the Budget tab at base, the renamed v1 Insights screen, and at head. Save `b1-l1-budget.png`. Pass when both show the same month spend total from `seed.mjs --query month-spend`.
- [ ] Lane 2. Pair the tab root with the `V2P-InsightsMonth` render. Save `b1-l2-pair.png`. Pass when the blocks and their order match the board, including the Budgets heading chevron that replaced the "Edit" link (D9).
- [ ] Lane 3. Read the left-this-month line. Save `b1-l3-left.png`. Pass when it subtracts the seeded bill and the debt due and says "bills and RM40 to Mei" with the shifted sample values.
- [ ] Lane 4. Toggle to Calendar and select a day. Save `b1-l4-calendar.png`. Pass when the panel lists exactly that day's rows.
- [ ] Lane 5. Open the month chooser and pick September. Save `b1-l5-september.png`. Pass when every number on the tab changes to September's totals.
- [ ] Lane 6. Tap the Transport ring. Save `b1-l6-category.png`. Pass when the category page matches the `V2P-BudgetDetail` render for Transport.
- [ ] Lane 7. Edit the Transport budget in place to 200. Save `b1-l7-edit.png`. Pass when the ring loses its Coral and the database budget is 200.
- [ ] Lane 8. Open **Edit** and set a cap on an unbudgeted category. Save `b1-l8-budget-edit.png`. Pass when the new ring shows on the tab root.
- [ ] Lane 9. Tap the map teaser. Save `b1-l9-map.png`. Pass when the v1 map screen opens.
- [ ] Lane 10. Seed `empty` and open the tab. Save `b1-l10-empty.png`. Pass when the empty state from `V2P-InsightsStates` shows.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. The Budget tab time to visible and frame times during the ring and line draw-in, with the `heavy` seed.
- [ ] Probe. Run `perf.sh --flow flows/perf/budget-open.yaml --seed heavy` on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base time to visible and frame times first.
- [ ] Rule. Fail when the head time to visible exceeds the base by more than 150 ms, or the head `jankyPct` exceeds 8 percent.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 4, 6, and 8 screenshots into `~/.local/share/moni-runs/review/b1/` with `review-pair.sh` beside the `V2P-InsightsMonth`, `V2P-InsightsCalendar`, `V2P-BudgetDetail`, and `V2P-BudgetEdit` renders.
- [ ] Record a 30 to 60 second video of the tab, the calendar, a ring tap, and an in-place budget edit. Save it as `~/.local/share/moni-runs/review/b1/b1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the H2 tip after the verdict, patch-id unchanged.
- [ ] The root appends B1 on `redesign/h2-moni-chat` and reports STACK-READY. The operator lands the stack bottom-up.

## Build the bill page and Add a bill (B2)

**Depends on.** B1.

**Files.**

- [ ] Edit `packages/types/src/recurring-override.ts` to add `skipPeriod` and `remind`.
- [ ] Create `supabase/migrations/20261023000000_recurring_override_skip_and_remind.sql`, with the timestamp set to the day the owner writes it.
- [ ] Edit `apps/mobile/lib/supabase/recurring-overrides.ts` and its test.
- [ ] Edit `apps/mobile/lib/finance/bills.ts` and `apps/mobile/lib/finance/__tests__/bills.test.ts`.
- [ ] Create `apps/mobile/app/bill/[seriesKey].tsx` and `apps/mobile/app/bill/new.tsx`.
- [ ] Create `apps/mobile/lib/notifications/bill-reminder.ts`.
- [ ] Create `apps/mobile/.maestro/flows/budget/bill.yaml` and `bill-new.yaml`.
- [ ] Edit `docs/DATABASE.md`, `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Promote recurring series to bills instead of adding a bills table. A detected series plus its `recurring_overrides` row is a bill. **Add a bill** with no history writes an override row with a merchant series key, `kind` `bill`, `expected_amount`, and `expected_day`.
- [ ] Write the shape first. `recurringOverrideSchema` gains optional nullable `skipPeriod` in `YYYY-MM` form and optional `remind` boolean. The migration adds `skip_period TEXT NULL` and `remind BOOLEAN NOT NULL DEFAULT false`. Both are additive, and the installed app ignores them.
- [ ] Make `selectUpcomingBills` return `skipped` for a bill whose `skipPeriod` is the current month, and `paid` when a matching transaction exists this period.
- [ ] Build `V2P-BillDetail`. Name and amount edit in place. **Mark paid** opens the C1 amount page with the bill's amount and wallet. **Skip October** writes `skipPeriod`. **Stop tracking** sets the override to `dismissed`. Next due, Pays from, Category, and History follow the board. Remind schedules a local notification the day before through the library from R2.
- [ ] Build **Add a bill** on the C1 amount page, per the bill frame of `V2P-AmountPage`.
- [ ] Apply the migration to the e2e project. Operator box O7 covers production.

**You see.**

- [ ] Tapping Netflix in the bills list opens its page. **Skip October** moves it out of this month's total.
- [ ] **Add a bill** for Unifi at RM129 on day 20 adds it to the bills list.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `bills.test.ts` gains two cases. A bill with `skipPeriod: '2026-10'` at Wed 14 Oct 2026 has status `'skipped'`. An override with no matching transactions and `expected_day` 20 yields a due date of `'2026-10-20'`. Run `pnpm --filter moni test`.
- [ ] The `recurring-overrides` test asserts that `skipBill(seriesKey, '2026-10')` writes `skipPeriod` and leaves `status` unchanged. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open the Budget tab bills list at base and head. The base lists bills read-only, so gate that the head opens a bill page. Save `b2-l1-bills.png`. Pass when both list the seeded Netflix bill and the head opens its page.
- [ ] Lane 2. Pair the bill page with the `V2P-BillDetail` render. Save `b2-l2-pair.png`. Pass when the blocks and their order match the board.
- [ ] Lane 3. Tap **Skip October**. Save `b2-l3-skipped.png`. Pass when the left-this-month line rises by the bill amount and the override row has `skip_period` set.
- [ ] Lane 4. Tap **Mark paid** and save on the amount page. Save `b2-l4-paid.png`. Pass when a transaction is added and the bill shows as paid.
- [ ] Lane 5. Edit the bill amount in place. Save `b2-l5-amount.png`. Pass when `expected_amount` changes and the toast shows **Undo**.
- [ ] Lane 6. Run `flows/budget/bill-new.yaml` for Unifi. Save `b2-l6-new-bill.png`. Pass when Unifi shows in the bills list with its due day.
- [ ] Lane 7. Tap **Stop tracking**. Save `b2-l7-stopped.png`. Pass when the bill leaves the list and the override status is `dismissed`.
- [ ] Lane 8. Turn on Remind for a bill due tomorrow. Save `b2-l8-remind.png`. Pass when `adb shell dumpsys alarm` or the notification library's scheduled list shows one reminder for that bill.
- [ ] Lane 9. Open Home. Save `b2-l9-home-strip.png`. Pass when the Home bills strip matches the Budget list.
- [ ] Lane 10. Install the base APK against the migrated e2e project and open the Budget tab, then reinstall the head APK. Save `b2-l10-old-app.png`. Pass when the base app shows its bills list with no error.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from a bill row tap to the visible bill page, and the Budget tab time to visible.
- [ ] Probe. Run `flows/budget/bill.yaml` five times on the head APK and `flows/perf/budget-open.yaml` with `perf.sh` on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base Budget tab time first. The bill page has no base.
- [ ] Rule. Fail when the bill page median exceeds 400 ms or the head Budget tab time exceeds the base by more than 50 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, and 6 screenshots into `~/.local/share/moni-runs/review/b2/` with `review-pair.sh` beside the `V2P-BillDetail` and `V2P-AmountPage` renders.
- [ ] Record a 30 to 60 second video of opening a bill, skipping it, marking one paid, and adding Unifi. Save it as `~/.local/share/moni-runs/review/b2/b2-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the B1 tip after the verdict, patch-id unchanged.
- [ ] The root appends B2 on `redesign/b1-budget` and reports STACK-READY. The operator lands the stack bottom-up after O7.

## Build the Debts tab (D1)

**Depends on.** B2.

**Files.**

- [ ] Rewrite `apps/mobile/app/(tabs)/debts.tsx`, `apps/mobile/app/debt/[id].tsx`, and `apps/mobile/app/debt/new.tsx`.
- [ ] Create `apps/mobile/components/debts/net-position.tsx`, `coming-up.tsx`, `person-row.tsx`, and `settled-list.tsx`.
- [ ] Create `apps/mobile/lib/finance/debt-summary.ts` and `apps/mobile/lib/finance/__tests__/debt-summary.test.ts`.
- [ ] Create `apps/mobile/.maestro/flows/debts/debts.yaml`, `debt-new.yaml`, `repay.yaml`, and `settle.yaml`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Build `V2P-Debts`. The header has **Record a debt**. The net position hero tiles filter the list in place, per D5. Then COMING UP rows with Nudge or Remind and "Reminded today", the people list, and "Settled and written off". Debts never show on the Budget tab.
- [ ] Make `summarizeDebts(debts, activities, now)` return the net position, the owed-to-me and I-owe totals, the coming-up rows, and the settled list, all in the main currency.
- [ ] Build `V2P-DebtDetail` and `V2P-DebtSettle`. The name and note edit in place. **Record repayment** and lend more open the C1 amount page. Settle, remind, and write off use the confirm sheet with **Keep it** and **Write off**.
- [ ] Build `V2P-DebtNew` with the person picker, the direction control, the amount page, the wallet, the due date, and the note.
- [ ] Make Nudge open the Android share sheet with a prefilled message, per D5.
- [ ] Build `V2P-DebtsEmpty` and the offline banner state on the existing helpers in `lib/supabase/debts.ts`.

**You see.**

- [ ] The Debts tab shows the net position, Mei in COMING UP with RM40 due, and both seeded people.
- [ ] Recording a RM20 repayment from Aiman lowers his balance by RM20.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `debt-summary.test.ts` builds one debt owed to me of 100 with a repayment of 20 and one I owe of 40 due in 3 days, and asserts a net position of `40`, an owed-to-me total of `80`, and one coming-up row for 40. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/debts/repay.yaml` for Aiman at base, through the v1 debt page, and at head. Save `d1-l1-repaid.png`. Pass when both lower Aiman's balance by RM20 in the database.
- [ ] Lane 2. Pair the tab with the `V2P-Debts` render. Save `d1-l2-pair.png`. Pass when the blocks and their order match the board.
- [ ] Lane 3. Tap the owed-to-me hero tile. Save `d1-l3-filter.png`. Pass when the people list shows only people who owe the user, on the same page.
- [ ] Lane 4. Open Mei's page. Save `d1-l4-person.png`. Pass when it matches the `V2P-DebtDetail` render for Mei.
- [ ] Lane 5. Run `flows/debts/debt-new.yaml` for a new person lending RM50. Save `d1-l5-new.png`. Pass when the person shows in the list and a debt row exists.
- [ ] Lane 6. Run `flows/debts/settle.yaml`. Save `d1-l6-settled.png`. Pass when the person moves to "Settled and written off" and the page matches `V2P-DebtSettle`.
- [ ] Lane 7. Write off a debt through the confirm sheet. Save `d1-l7-write-off.png`. Pass when **Keep it** keeps it and **Write off** closes it.
- [ ] Lane 8. Tap Nudge on Mei. Save `d1-l8-share.png`. Pass when the Android share sheet opens with the prefilled text.
- [ ] Lane 9. Edit a debt's note in place. Save `d1-l9-note.png`. Pass when the note is saved with **Undo**.
- [ ] Lane 10. Seed `empty` and open Debts. Save `d1-l10-empty.png`. Pass when the screen matches the `V2P-DebtsEmpty` render.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. The Debts tab time to visible and the time from a person tap to the visible person page.
- [ ] Probe. Run `flows/debts/debts.yaml` five times each on the base APK and the head APK, alternating, and read both times from `commands.json`.
- [ ] Baseline. Record the base times first.
- [ ] Rule. Fail when either head median exceeds its base median by more than 100 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 4, 5, and 6 screenshots into `~/.local/share/moni-runs/review/d1/` with `review-pair.sh` beside the `V2P-Debts`, `V2P-DebtDetail`, `V2P-DebtNew`, and `V2P-DebtSettle` renders.
- [ ] Record a 30 to 60 second video of the tab, a filter, a repayment, and a settle. Save it as `~/.local/share/moni-runs/review/d1/d1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the B2 tip after the verdict, patch-id unchanged.
- [ ] The root appends D1 on `redesign/b2-bills` and reports STACK-READY. The operator lands the stack bottom-up.

## Build Profile and the sign-in page (K1)

**Depends on.** D1.

**Files.**

- [ ] Rewrite `apps/mobile/app/profile.tsx`.
- [ ] Rewrite `apps/mobile/app/(auth)/login.tsx` to hold both sign-in and account creation. Delete `apps/mobile/app/(auth)/register.tsx` after moving its `signUp` call.
- [ ] Rewrite `apps/mobile/components/auth/google-sign-in-button.tsx` to the v2 button.
- [ ] Delete `apps/mobile/components/profile/default-wallet-picker.tsx`, `permission-column.tsx`, `profile-section-title.tsx`, and `theme-preference-picker.tsx` once no caller is left.
- [ ] Edit `apps/mobile/lib/supabase/profile.ts` callers so the main currency row writes `preferences.currency`.
- [ ] Edit `apps/mobile/.maestro/subflows/sign-in.yaml` and create `apps/mobile/.maestro/flows/account/profile.yaml` and `sign-in-states.yaml`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Build `V2H-Profile` with its rows in board order. Main currency opens the currency picker and writes `preferences.currency`. APPEARANCE sets the theme through `lib/theme/preference.ts`. MONEY links Wallets, Categories, and Merchant names. CAPTURE SOURCES links Bank notifications, Location, Camera, and Microphone. PRIVACY AND DATA links the Capture log and Export data. **Sign out** ends the session. Profile has no Budgets or Debts row.
- [ ] Keep the `debug/` route, reachable from Profile only when `__DEV__` is true, per D10.
- [ ] Until K3 lands, point the Merchant names, capture source, and Capture log rows at the v1 `notifications` page. K3 moves them.
- [ ] Build `V2H-Login` with its `mode` toggle between Sign in and Create account, the password reveal, **Continue with Google**, and the state frames for wrong details, confirm email, signing in, Google did not finish, and offline.

**You see.**

- [ ] Profile shows Main currency as MYR. Picking SGD changes the currency on Home, Activity, and Budget.
- [ ] Signing out lands on the v2 sign-in page, and a wrong password shows the wrong-details state.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Create `apps/mobile/lib/supabase/__tests__/profile.test.ts`. It asserts that `updateProfilePreferences({ currency: 'SGD' })` keeps the existing `theme` and `default_wallet_id` keys and sets `currency` to `'SGD'`. Run `pnpm --filter moni test`.
- [ ] Create `apps/mobile/lib/auth/login-mode.ts` for the pure sign-in state reducer, inside Jest's roots, and `apps/mobile/lib/auth/__tests__/login-mode.test.ts`. The test asserts that the error `Invalid login credentials` maps to the `wrongDetails` state. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run `flows/smoke/sign-in.yaml` at base, on the v1 page, and at head. Save `k1-l1-signed-in.png`. Pass when both reach Home.
- [ ] Lane 2. Pair Profile with the `V2H-Profile` render. Save `k1-l2-pair.png`. Pass when the rows and their order match the board.
- [ ] Lane 3. Change the main currency to SGD, then open Home. Save `k1-l3-sgd.png`. Pass when the profile row has `currency` equal to `SGD` and Home shows no ringgit amounts.
- [ ] Lane 4. Set APPEARANCE to dark and cold start. Save `k1-l4-dark.png`. Pass when the app opens dark.
- [ ] Lane 5. Sign out. Save `k1-l5-signed-out.png`. Pass when the sign-in page matches the `V2H-Login` render.
- [ ] Lane 6. Sign in with a wrong password. Save `k1-l6-wrong.png`. Pass when the wrong-details state shows and no session is stored.
- [ ] Lane 7. Switch to Create account and submit a new address. Save `k1-l7-create.png`. Pass when the confirm-email state shows or the session starts, matching the project's email setting.
- [ ] Lane 8. Tap **Continue with Google** and press back in the Google sheet. Save `k1-l8-google-cancel.png`. Pass when the "Google did not finish" state shows.
- [ ] Lane 9. Open each MONEY and CAPTURE SOURCES row. Save `k1-l9-rows.png`. Pass when each row opens a page and none crashes.
- [ ] Lane 10. Search Profile for the debug row in the e2e build. Save `k1-l10-no-debug.png`. Pass when the release e2e build shows no debug row.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from the avatar tap to the visible Profile, and time from the sign-in tap to Home.
- [ ] Probe. Run `flows/account/profile.yaml` and `flows/smoke/sign-in.yaml` five times each on the base APK and the head APK, alternating, and read both times from `commands.json`.
- [ ] Baseline. Record the base times first.
- [ ] Rule. Fail when the head Profile time exceeds the base by more than 100 ms, or the head sign-in time exceeds the base by more than 300 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 5, and 6 screenshots into `~/.local/share/moni-runs/review/k1/` with `review-pair.sh` beside the `V2H-Profile` and `V2H-Login` renders in the matching states.
- [ ] Record a 30 to 60 second video of Profile, a currency change, sign out, and a wrong-password sign-in. Save it as `~/.local/share/moni-runs/review/k1/k1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the D1 tip after the verdict, patch-id unchanged.
- [ ] The root appends K1 on `redesign/d1-debts` and reports STACK-READY. The operator lands the stack bottom-up.

## Build the wallet page with balance correction and the wallet form (K2)

**Depends on.** K1.

**Files.**

- [ ] Rewrite `apps/mobile/app/wallet/[id].tsx`.
- [ ] Replace `apps/mobile/app/wallet/new.tsx` with `apps/mobile/app/wallet/form.tsx`, which handles new and edit.
- [ ] Create `apps/mobile/components/wallets/balance-correction.tsx` and `app-picker-sheet.tsx`.
- [ ] Create `apps/mobile/lib/wallets/balance-correction.ts` and `apps/mobile/lib/wallets/__tests__/balance-correction.test.ts`.
- [ ] Delete `apps/mobile/components/wallets/notification-source-picker-content.tsx`, `wallet-notification-link-section.tsx`, and `wallet-notification-link-section.android.tsx` after moving their callers.
- [ ] Create `apps/mobile/.maestro/flows/account/wallet-detail.yaml`, `wallet-correction.yaml`, and `wallet-form.yaml`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Build `V2H-WalletDetail`. The name edits in place. The BALANCE hero, "Balance not right?" with an in-place balance field and the difference line, the correction toast with **Undo**, the balance chart from A1, the "2 captures to review" strip, day-grouped rows, the ALERTS toggle, the Capture log link, **Edit wallet**, and **Delete wallet** follow.
- [ ] Make `correctBalance(wallet, newBalance)` a pure function that returns the transaction to write. It is an income or an expense of the difference, with `metadata.kind` `balance_correction` from G1 and `analysisExcluded: true`. A zero difference returns `null`.
- [ ] Make the Home check-in's **Fix it** open this page in its balance-edit state.
- [ ] Build `V2H-WalletForm` for new and edit, with Name, Type, Currency, Starting balance on new only, Alerts from, Colour, and the preview card. Alerts from opens `AppPickerSheet`, which lists installed apps through `modules/moni-android-apps`.

**You see.**

- [ ] Correcting Cash from RM63.60 to RM60.00 writes a −RM3.60 balance correction and shows the toast with **Undo**.
- [ ] The new wallet form saves a wallet that shows on the Wallets page.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `balance-correction.test.ts` asserts that `correctBalance({ balance: 63.6 }, 60)` returns an expense of `3.6` with `metadata.kind` equal to `'balance_correction'` and `analysisExcluded` equal to `true`, that a target of 70 returns an income of `6.4`, and that a target of 63.6 returns `null`. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Correct the Cash balance to RM60.00 at base, through the v1 adjustment, and at head, through "Balance not right?". Save `k2-l1-corrected.png`. Pass when both leave the wallet balance at RM60.00 in `seed.mjs --query balances`.
- [ ] Lane 2. Pair the wallet page with the `V2H-WalletDetail` render. Save `k2-l2-pair.png`. Pass when the blocks and their order match the board.
- [ ] Lane 3. Run `flows/account/wallet-correction.yaml` and tap **Undo**. Save `k2-l3-undo.png`. Pass when the correction row is removed and the balance returns to RM63.60.
- [ ] Lane 4. Rename the wallet in place. Save `k2-l4-rename.png`. Pass when the new name shows on Home and Activity rows.
- [ ] Lane 5. Tap **Fix it** on the Home check-in. Save `k2-l5-fix-it.png`. Pass when the wallet page opens with the balance field focused.
- [ ] Lane 6. Run `flows/account/wallet-form.yaml` to add a wallet. Save `k2-l6-new.png`. Pass when the wallet shows on the Wallets page with its colour.
- [ ] Lane 7. Open **Alerts from** and pick an installed app. Save `k2-l7-app.png`. Pass when the wallet's `notification_package` is that app's package.
- [ ] Lane 8. Delete a wallet through the confirm sheet. Save `k2-l8-delete.png`. Pass when the wallet is soft-deleted and leaves the Wallets page.
- [ ] Lane 9. Open the Wise wallet page. Save `k2-l9-usd.png`. Pass when it shows dollars only and no ringgit conversion.
- [ ] Lane 10. Run `pnpm --filter moni lint:copy` and read the correction row's title. Save `k2-l10-copy.png`. Pass when the row reads "Balance correction" and the lint exits 0.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Time from a wallet tap to the visible wallet page with the `heavy` seed.
- [ ] Probe. Run `flows/account/wallet-detail.yaml` five times each on the base APK and the head APK with the `heavy` seed, alternating, and read the time from `commands.json`.
- [ ] Baseline. Record the base time first.
- [ ] Rule. Fail when the head median exceeds the base by more than 150 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, and 6 screenshots into `~/.local/share/moni-runs/review/k2/` with `review-pair.sh` beside the `V2H-WalletDetail` and `V2H-WalletForm` renders.
- [ ] Record a 30 to 60 second video of a correction with **Undo**, a rename, and a new wallet. Save it as `~/.local/share/moni-runs/review/k2/k2-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the K1 tip after the verdict, patch-id unchanged.
- [ ] The root appends K2 on `redesign/k1-profile` and reports STACK-READY. The operator lands the stack bottom-up.

## Store merchant names, per-app location, and capture log statuses (G3)

**Depends on.** K2.

**Files.**

- [ ] Create `packages/types/src/merchant-alias.ts` and export it from `packages/types/src/index.ts`.
- [ ] Edit `packages/types/src/wallet.ts` to add optional `recordLocation`.
- [ ] Create `supabase/migrations/20261024000000_merchant_aliases_and_wallet_location.sql`, with the timestamp set to the day the owner writes it.
- [ ] Edit `apps/mobile/lib/store/index.ts` to add `merchantAliases$` to the store and `ALL_STORE_OBSERVABLES`.
- [ ] Create `apps/mobile/lib/supabase/merchant-aliases.ts` and its test.
- [ ] Edit `apps/mobile/lib/supabase/wallets.ts` for the new column, and `apps/mobile/lib/location/location-snapshot.ts` and its callers to honour it.
- [ ] Edit `apps/mobile/hooks/use-notification-listener.ts` to add `status` to `CapturedNotification`, and `apps/mobile/lib/ai/processing-queue.ts` and `background-processor.ts` to write it.
- [ ] Create `apps/mobile/lib/finance/merchant-name.ts` and `apps/mobile/lib/finance/__tests__/merchant-name.test.ts`.
- [ ] Edit `apps/mobile/scripts/e2e/fixtures.mjs` for aliases and statuses.
- [ ] Edit `docs/DATABASE.md`, `docs/REDESIGN.md` code gaps rows, and `apps/mobile/README.md`.

**Build.**

- [ ] Write the shapes first. `merchantAliasSchema` has `id`, `userId`, `rawKey`, `displayName`, `createdAt`, `updatedAt`, and `deleted`. `walletSchema` gains optional `recordLocation` with default `true`. `capturedNotificationStatusSchema` is `z.enum(['added', 'auto_added', 'waiting_for_review', 'ignored', 'not_linked'])` and lives in `packages/types` so the five glossary statuses have one source.
- [ ] Write the migration on the recurring-overrides pattern. Create `merchant_aliases` with RLS, the `updated_at` trigger, `deleted`, and realtime, and add `wallets.record_location BOOLEAN NOT NULL DEFAULT true`. Both changes are additive.
- [ ] Make `merchantName(raw, aliases)` return the alias for the key that `merchantKey` in `lib/ai/routine.ts` builds, or the raw text. Rows on Home, Activity, wallet pages, and Review read names through it.
- [ ] Make `captureLocationSnapshot` skip when the source wallet has `recordLocation` set to `false`.
- [ ] Write the stored status at the point the processor decides, instead of computing it at render in `app/notifications/index.tsx`. Entries from before G3 have no status, and the Capture log shows them as Ignored.
- [ ] Apply the migration to the e2e project. Operator box O7 covers production.

**You see.**

- [ ] Naming `GRAB*1234` as "Grab" makes every Grab row show "Grab".
- [ ] A posted alert for a wallet with location off creates a row with no location columns.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `merchant-name.test.ts` asserts that `merchantName('GRAB*1234 KL', [{ rawKey: 'grab', displayName: 'Grab' }])` returns `'Grab'` and that an unknown merchant returns its raw text. Run `pnpm --filter moni test`.
- [ ] The `merchant-aliases` helper test asserts that `nameMerchant('grab', 'Grab')` writes one row and a second call updates it. Run `pnpm --filter moni test`.
- [ ] Extend `apps/mobile/scripts/notification-routing-suite.mjs` to assert the stored status for a linked routine alert is `auto_added` and for an unlinked package is `not_linked`. Run `pnpm --filter moni test:notification-routing`.
- [ ] Run `pnpm check-types` at the root, which covers `apps/web`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Post the GRAB alert at base and head against the migrated e2e project. Save `g3-l1-grab.png`. Pass when both add the Auto row and the base app shows no error from the new column or table.
- [ ] Lane 2. Seed an alias for `grab` and open Activity. Save `g3-l2-alias.png`. Pass when Grab rows show "Grab".
- [ ] Lane 3. Clear app data, sign in, and open Activity. Save `g3-l3-alias-sync.png`. Pass when the alias still applies after sync.
- [ ] Lane 4. Seed Maybank with `record_location` false and post an alert. Save `g3-l4-no-location.png`. Pass when the new row's location columns are null.
- [ ] Lane 5. Post an alert for a Touch 'n Go wallet with location on. Save `g3-l5-location.png`. Pass when the new row has location columns.
- [ ] Lane 6. Post alerts that end as added, auto-added, waiting, ignored, and not linked, then open the v1 notifications page. Save `g3-l6-statuses.png`. Pass when the stored statuses in the debug dump match the five outcomes.
- [ ] Lane 7. Query `merchant_aliases` as the second seeded user. Save `g3-l7-rls.log`. Pass when it returns 0 rows.
- [ ] Lane 8. Run `pnpm --filter web check-types`. Save `g3-l8-web.log`. Pass when it exits 0.
- [ ] Lane 9. Run `npx supabase db push --project-ref <e2e-ref> --dry-run`. Save `g3-l9-dry-run.log`. Pass when no migration is pending.
- [ ] Lane 10. Open the review deck for a GRAB proposal. Save `g3-l10-review-name.png`. Pass when the card shows "Grab" and the quoted alert keeps the raw text.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Frame times while scrolling Activity with the `heavy` seed and 200 aliases, since every row now resolves a name.
- [ ] Probe. Run `perf.sh --flow flows/perf/scroll-activity.yaml --seed heavy` on the base APK and the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base `jankyPct` and `p90Ms` first.
- [ ] Rule. Fail when the head `p90Ms` exceeds the base by more than 1 ms or the head `jankyPct` exceeds the base by more than 2 points.

**Review gate.** None. G3 is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the K2 tip after the verdict, patch-id unchanged.
- [ ] The root appends G3 on `redesign/k2-wallets` and reports STACK-READY. The operator lands the stack bottom-up after O7.

## Build Merchant names, Capture sources, and the Capture log (K3)

**Depends on.** G3.

**Files.**

- [ ] Create `apps/mobile/app/merchants.tsx`, `apps/mobile/app/capture-sources.tsx`, and `apps/mobile/app/capture-log.tsx`.
- [ ] Create `apps/mobile/components/capture-log/log-entry.tsx` and `apps/mobile/components/capture-sources/permission-row.tsx`.
- [ ] Delete `apps/mobile/app/notifications/_layout.tsx` and `index.tsx` after moving the K1 rows and every other caller.
- [ ] Edit `apps/mobile/app/profile.tsx` rows to the new routes.
- [ ] Create `apps/mobile/.maestro/flows/account/merchants.yaml`, `capture-sources.yaml`, and `capture-log.yaml`.
- [ ] Edit `docs/REDESIGN.md`, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Build `V2H-Merchants`. The to-name list shows the raw code, the count, and a guess. "Name this merchant" edits in place. "Forget this name" deletes the alias with **Undo**.
- [ ] Build `V2H-Permissions` as "Capture sources". The phone access rows cover notifications, location, camera, and microphone, with per-app location from G3. ADDED WITHOUT ASKING lists the G2 auto-add rules with **Ask again**, which deletes a rule with **Undo**. It links to the Capture log and to the map.
- [ ] Build `V2A-NotifLog` and `V2A-NotifLogEmpty` as "Capture log", with day groups, filter chips, entries with the app, time, quoted alert text, the stored status in glossary words, and **Show more**. The empty state shows **Check notification access** and the status legend.

**You see.**

- [ ] Capture log lists the five statuses as Added, Auto-added, Waiting for review, Ignored, and Not linked.
- [ ] **Ask again** on the GRAB rule makes the next GRAB alert a pending proposal.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Create `apps/mobile/lib/notifications/__tests__/capture-log.test.ts` for a pure `groupCaptureLog(entries, now)`. It asserts that entries from today and yesterday group under "Today" and "Yesterday", and that an entry with no status shows the label `Ignored`. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Post five alerts with the five outcomes, then open the log at base, the v1 notifications page, and at head. Save `k3-l1-log.png`. Pass when both list the five entries, and the head shows the glossary words with no "Queued" text.
- [ ] Lane 2. Pair the log with the `V2A-NotifLog` render. Save `k3-l2-pair.png`. Pass when the blocks and their order match the board.
- [ ] Lane 3. Filter the log to Waiting for review. Save `k3-l3-filter.png`. Pass when only that entry shows.
- [ ] Lane 4. Clear the captured notifications and open the log. Save `k3-l4-empty.png`. Pass when the screen matches the `V2A-NotifLogEmpty` render.
- [ ] Lane 5. Name a merchant in place on Merchant names. Save `k3-l5-named.png`. Pass when `merchant_aliases` gains the row and Activity shows the name.
- [ ] Lane 6. Tap "Forget this name", then **Undo**. Save `k3-l6-forget.png`. Pass when the alias is gone after the first step and back after **Undo**.
- [ ] Lane 7. Tap **Ask again** on the GRAB rule, then post a GRAB alert. Save `k3-l7-ask-again.png`. Pass when the rule is soft-deleted and the alert becomes a pending proposal.
- [ ] Lane 8. Turn off location for Maybank in Capture sources. Save `k3-l8-location-off.png`. Pass when `wallets.record_location` is `false` for Maybank.
- [ ] Lane 9. Pair Capture sources with the `V2H-Permissions` render. Save `k3-l9-sources.png`. Pass when the rows and their order match the board.
- [ ] Lane 10. Revoke notification access and open Capture sources. Save `k3-l10-denied.png`. Pass when the notifications row shows the permission-denied state from `V2F-States`.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. The Capture log time to visible and frame times while scrolling 500 captured entries.
- [ ] Probe. Post 500 alerts through a loop of `cmd notification post`, then run `flows/account/capture-log.yaml` with `perf.sh --flow` on the base APK, the v1 page, and on the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base time to visible and frame times first.
- [ ] Rule. Fail when the head time to visible exceeds the base by more than 150 ms or the head `jankyPct` exceeds the base by more than 3 points.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 4, 5, and 9 screenshots into `~/.local/share/moni-runs/review/k3/` with `review-pair.sh` beside the `V2A-NotifLog`, `V2A-NotifLogEmpty`, `V2H-Merchants`, and `V2H-Permissions` renders.
- [ ] Record a 30 to 60 second video of the log with a filter, naming a merchant, and **Ask again**. Save it as `~/.local/share/moni-runs/review/k3/k3-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the G3 tip after the verdict, patch-id unchanged.
- [ ] The root appends K3 on `redesign/g3-account-data` and reports STACK-READY. The operator lands the stack bottom-up.

## Build the spending map and the place page (M1)

**Depends on.** K3.

**Files.**

- [ ] Replace `apps/mobile/app/heatmap.tsx` with `apps/mobile/app/map.tsx`. Create `apps/mobile/app/place/[id].tsx`.
- [ ] Create `apps/mobile/components/map/place-card.tsx`, `place-pins.tsx`, and `top-places.tsx`.
- [ ] Create `apps/mobile/lib/finance/places.ts` and `apps/mobile/lib/finance/__tests__/places.test.ts`.
- [ ] Delete `apps/mobile/hooks/use-transaction-heatmap.ts` once `places.ts` replaces it.
- [ ] Edit the Budget tab map teaser and the Capture sources link to push `/map`.
- [ ] Create `apps/mobile/.maestro/flows/map/places.yaml`, `place.yaml`, and `map-empty.yaml`.
- [ ] Edit `docs/REDESIGN.md` status line to mark the build order done, `docs/DESIGN_SYSTEM.md`, and `apps/mobile/README.md`.

**Build.**

- [ ] Operator box O6 must be done before the live lanes run.
- [ ] Make `groupPlaces(transactions, { categoryId, range })` cluster rows by rounded coordinates and merchant, and return each place's name, total, count, and centre, sorted by total.
- [ ] Build `XM-Places` on `react-native-maps`. Pins come from `groupPlaces`. The place card at the bottom is fixed and shows the selected place with **See this place**. Category chips, range chips, and "Top places" follow.
- [ ] Build `XM-Detail` with spent here, payments, "Your top place", the pending capture strip, "What you bought" bars, the Moni noticed card with **Ask Moni about it**, the payments list, and **See these in Activity**.
- [ ] Build `XM-Empty` for no places and for location off, with **Turn on location**, **Add an expense**, and **Add a place to a past expense**.

**You see.**

- [ ] The Budget tab teaser opens the map with pins for the seeded places and the fixed place card for the top place.
- [ ] **See this place** opens the place page with its payments.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `places.test.ts` builds three rows at one Mamak within 30 m and one row at KLCC, and asserts two places, the Mamak first with count `3` and the summed total. Run `pnpm --filter moni test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `sonnet` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Open the map from the Budget tab at base, the v1 heatmap, and at head. Save `m1-l1-map.png`. Pass when both render map tiles and show the seeded places.
- [ ] Lane 2. Pair the map with the `XM-Places` render. Save `m1-l2-pair.png`. Pass when the blocks and their order match the board.
- [ ] Lane 3. Tap a second pin. Save `m1-l3-pin.png`. Pass when the fixed card shows that place and cannot be swiped away.
- [ ] Lane 4. Tap the Food chip and the This month range. Save `m1-l4-filter.png`. Pass when only Food places in the month show.
- [ ] Lane 5. Tap **See this place**. Save `m1-l5-place.png`. Pass when the place page matches the `XM-Detail` render by eye.
- [ ] Lane 6. Tap **See these in Activity**. Save `m1-l6-activity.png`. Pass when Activity shows only that place's rows.
- [ ] Lane 7. Tap **Ask Moni about it**. Save `m1-l7-ask.png`. Pass when Moni chat opens with the place in the composer.
- [ ] Lane 8. Seed `empty` and open the map. Save `m1-l8-empty.png`. Pass when the no-places state matches the `XM-Empty` render.
- [ ] Lane 9. Revoke location with `pm revoke` and open the map. Save `m1-l9-location-off.png`. Pass when the location-off state shows **Turn on location**.
- [ ] Lane 10. Run `rg "heatmap" apps/mobile/app apps/mobile/components` at head. Save `m1-l10-old-route.log`. Pass when it prints nothing.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. The map time to visible pins and frame times while panning, with the `heavy` seed.
- [ ] Probe. Create `flows/perf/map-pan.yaml` and run it with `perf.sh --flow --seed heavy` on the base APK, the v1 heatmap, and on the head APK, alternating, five rounds each.
- [ ] Baseline. Record the base time to visible and frame times first.
- [ ] Rule. Fail when the head time to visible exceeds the base by more than 200 ms or the head `jankyPct` exceeds the base by more than 3 points.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2, 3, 5, and 8 screenshots into `~/.local/share/moni-runs/review/m1/` with `review-pair.sh` beside the `XM-Places`, `XM-Detail`, and `XM-Empty` renders.
- [ ] Record a 30 to 60 second video of the map, a pin change, a filter, and the place page. Save it as `~/.local/share/moni-runs/review/m1/m1-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at STACK-READY. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] Rebased onto the K3 tip after the verdict, patch-id unchanged.
- [ ] The root appends M1 on `redesign/k3-capture-sources` and reports STACK-READY. The operator lands the stack bottom-up.

## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] `node apps/mobile/scripts/lint/check-test-ids.mjs` passes with an empty `test-id-exempt.txt`, and `copy-allow.txt` is empty.
- [ ] `rg "Insights|Queued|Declin" apps/mobile/app apps/mobile/components` prints nothing.
- [ ] `docs/REDESIGN.md` status line says implementation is done, and `docs/DESIGN_SYSTEM.md` describes v2 only.
- [ ] Reply to the operator with the report the execution playbook names. Link the stack root and tip, give a one-line verdict per PR, and list anything parked or excluded with the reason.

## Appendix A. Prototype evidence

No prototype ran in this planning session, so no branch, SHA, or artifact exists yet. Every question below is unproven. Each names the cheapest experiment that settles it and the PR box that runs it. An owner records the experiment's branch, SHA, and screenshots here before the PR's code depends on the answer.

- **adb over the tailnet to the Redmi.** Unproven. The verification explorer measured that `tailscale.exe ping 100.127.128.74` answers in 50 ms over a direct path and that TCP port 5555 refused the connection, so the phone is reachable but adb was not listening. The experiment is O1, then `adb connect 100.127.128.74:5555` and `adb shell input keyevent KEYCODE_WAKEUP` from WSL. It is the first box of V1 **Build**, with the Wireless debugging and Windows adb server fallbacks under it.
- **Maestro `id` selectors on this React Native version.** Unproven. Maestro's React Native page says `testID` maps to `id`, as the explorer reports. The experiment is one `tid()` testID on the sign-in button, then `maestro hierarchy` and a one-line `tapOn: id:` flow. V4 runs it before writing the smoke flows.
- **Frame stats from a release build on HyperOS.** Unproven. The experiment is `dumpsys gfxinfo com.anonymous.moni.e2e reset`, a scripted scroll, then `dumpsys gfxinfo` on the V3 APK, checking that the 90th percentile line is present. V3 lane 8 and V4's baseline run it.
- **`useCSSVariable` on the first render.** Unproven. The experiment is a cold start with a log line of the hook's first value, at S1's head. If the first value is `undefined`, the generated fallbacks stay.
- **Funnel Display weights on Android.** Unproven. Android selects a custom font file by family name. The experiment is a scratch screen with one `Text` per family, 400, 600, and 700, plus a row of digits, compared with the `XB-Type` render. F1 runs it before the codemod.
- **Spring feel on the Redmi.** Unproven, and partly a taste call. The experiment is a scratch screen that runs the press, control, sheet, and throw springs from `lib/motion/tokens.ts`, recorded with `screenrecord.sh` and played next to `V2F-Feel` in Edge. F1's review video carries it to the operator.
- **A sheet over the custom tab bar with the + above the scrim.** Unproven. The experiment is two scratch prototypes, a JS sheet host above the root Stack and an expo-router `transparentModal` route, compared on scrim coverage, the + layer, Android back, and the keyboard. It is the first box of F3 **Build**.
- **The capture slide-in as one transition.** Unproven. The experiment is a scratch chooser that starts the sheet drop and the page push in one frame, recorded at 60 fps, checked for a frame of the bare origin screen. C1 runs it before building the amount page.
- **Driving the ML Kit scanner's gallery import from Maestro.** Unproven. `scanner.android.ts` sets `galleryImportAllowed` to `true` by default. The experiment is `adb push` of the fixture JPG to `/sdcard/Pictures/`, opening the scanner, and `maestro hierarchy` to find the import control. C2 runs it.
- **Driving Say it with recorded audio.** Unproven. The experiment is playing `parking.wav` from the PC speaker beside the phone while the listening page runs, and reading the transcript. C2 runs it. If it fails, C2 lane 8 records `BLOCKED` and the operator speaks in the review video.
- **Posting bank alerts as `com.android.shell` and granting listener access by command.** Unproven. The experiment is `adb shell cmd notification allow_listener` for the e2e listener service, then `adb shell cmd notification post` with a Maybank text, with the Maybank wallet linked to `com.android.shell`, and a check that the capture reaches the processing queue. G2 runs it before lane 2. O5 is the fallback for the grant.
- **Swipe deck performance with an editable card.** Unproven. The experiment is a scratch deck of 20 seeded cards with an in-place field in each, measured with `perf.sh --flow` over 20 swipes, plus a check that the pan stays off while a field edits. R1 runs it before the gesture code is final.
- **Notification actions with the app killed on HyperOS.** Unproven. The experiment is a scratch build with `expo-notifications` action buttons and a background handler, then `am force-stop` and a tap on an action, checking the ledger. If HyperOS drops the handler, repeat with one other library. R2 runs it first.
- **Offline states over wireless adb.** Unproven and likely blocked, because airplane mode drops the Wi-Fi link that adb uses. The experiment is one USB-attached session that runs Maestro `setAirplaneMode` around the Home offline banner. Until it passes, offline banners are covered by Jest and by the review videos.
- **The V3 build and size budgets.** Unproven. The 25-minute, 6-minute, 120 MB, and 3,000 ms numbers are guesses from the 288 MB multi-ABI debug APK. V3 measures them and the trail replaces each budget with the measured value plus 20 percent.

## Appendix B. Alternatives rejected

- **An Android emulator in WSL2.** WSL has `/dev/kvm`, 16 cores, and 21 GB, but no emulator package or system image. More to the point, an emulator cannot check HyperOS notification behaviour, the Play Services ML Kit scanner, or the owner's real phone. It stays an option for a later headless CI lane.
- **A Windows-side adb server reached through `ADB_SERVER_SOCKET`.** The WSL adb is 37.0.1 and the Windows adb is 36.0.0. Two servers on one port flap. It is V1's last fallback only.
- **Detox.** It needs a gray-box test build and its own native setup. Maestro 2.11.0 is already installed on this machine, works over plain adb, and has run flows here before.
- **Maestro against the dev client.** The dev client needs Metro reachable over the tailnet, shows a launcher, and adds LogBox toasts over the UI. A standalone release APK runs the real bundle with none of that.
- **Taildrop as the main install path.** Taildrop needs a tap on the phone for every install. `adb install -r` is scriptable. Taildrop stays the fallback when adb is down.
- **Google sign-in or a test-only session injection for Maestro.** Google's sheet cannot be driven reliably. Injecting a session through a deep link or an e2e-only code path adds a sign-in path to the binary and copies Supabase's session storage format. The email and password user goes through `signInWithPassword`, which the app already ships.
- **A separate test account inside the production project as the default.** RLS isolates a user's rows, but every migration would reach production before its test run. That setup is the fallback under O4 only.
- **Maestro `assertScreenshot` as a gate.** It compares pixels with a percentage threshold, so the clock, the battery icon, animation timing, and live data make it flaky. Board renders beside device screenshots, judged in each review gate, replace it.
- **A feature flag that runs v1 and v2 side by side.** Two UIs mean two code paths in every screen and shims between them. The program rebuilds in place, and each PR moves callers and deletes the v1 component in the same change.
- **Server-side generative chat cards.** They change the backend response shape, and the backend deploys on every push to `main`, so the field would have to stay optional through mixed app versions. Cards picked and filled on the device from the local snapshot keep the backend unchanged and keep the numbers from the ledger.
- **A source column and a balance-correction enum value on `transactions`.** `transactions.metadata` is JSONB with a passthrough schema, so G1 needs no migration. A new `transaction_type` value would touch every total.
- **A bills table.** Recurring detection and `recurring_overrides` already hold a bill's merchant, amount, and day. B2 adds two columns to that table instead.
- **Auto-add rules inside `profiles.preferences`.** That JSONB field has no row-level history and last-write-wins across devices. A table syncs like every other synced table.
- **Keeping the `.android.tsx` native sheet split.** The native sheets cannot cover the custom tab bar with the + above the scrim, and the split doubles every picker. F3 replaces all of them with one host.
- **Dark mode and the states kit as a last PR.** Retrofitting dark values and empty, loading, and offline states over 20 screens costs more than building each screen with them. F1 lands dark tokens, and each screen PR builds its own states.
- **Every data gap at step 7 of the suggested order.** Home, Review, Budget, and Account would ship without their data. Each G PR lands right before the first screen that reads it.
- **One PR per foundation component.** Moving callers and deleting the v1 file in one change needs the whole family at once, so F2, F3, and F4 each take one family.
- **EAS local builds.** `eas build --local` adds prebuild and environment fetch on every run. Gradle directly with one ABI is faster for this loop.
- **Committing review screenshots and videos to the repo.** They bloat the history. Review media lives under `~/.local/share/moni-runs/review/` and goes to the operator in chat.

## Appendix C. Risks

- **The phone refuses adb on its tailnet address.** Lands in V1. The owner watches the first `adb connect`. The fallbacks are Wireless debugging and the Windows adb server.
- **A phone reboot resets `adb tcpip 5555`.** Lands in V1. `doctor.sh` reports it, and the operator repeats O2.
- **HyperOS stops Tailscale or Wireless debugging in the background.** Lands in V1. The owner watches lane 7 after a 5-minute sleep. O1 sets battery use to **No restrictions**.
- **One phone makes every swarm slow.** Lands in V1 and holds for the whole program. Each PR's ten `sonnet` lanes share the one Redmi, so the phone lanes run one at a time under the device lock, so a round can take an hour. The root counts that time before calling a lane stuck.
- **The owner needs the phone during a run.** Lands in V1. O8's hold file pauses all phone lanes.
- **Wireless adb on the tailnet is an open debug port.** Lands in V1. The owner limits it with tailnet ACLs to their own devices and can turn adb off when idle.
- **`expo prebuild --clean` rewrites `apps/mobile/android/`.** Lands in V3. `build-apk.sh` refuses the main worktree, so builds run only in PR worktrees.
- **The release keystore differs between CI and local builds.** Lands in V3. The e2e package never replaces the daily install, so a signature mismatch can only hit the e2e app, where `adb uninstall com.anonymous.moni.e2e` clears it.
- **The mock AI client ships fixtures in the binary.** Lands in V4. The mock already ships as the fallback when `EXPO_PUBLIC_AI_API_URL` is empty. The fixtures hold no personal data.
- **A free Supabase project pauses after a week without use.** Lands in V4. `doctor.sh` checks the e2e project's health endpoint, and the operator unpauses it.
- **Seed data could leak into production.** Lands in V4. `seed.mjs` refuses the production URL without `--shared-project`, and lane 6 proves it.
- **`notif.json` holds a real notification with a person's name.** Lands in S1, which deletes it. Git history still holds it.
- **The app looks half v1 and half v2 between F1 and M1.** Lands in F1. This is the planned intermediate state. Every PR still ends in a working app, and each review gate shows the mix.
- **Funnel Display adds start time.** Lands in F1. The perf rule fails above 120 ms.
- **A `Text` codemod across every screen can miss a case.** Lands in F1. The `Text` import lint makes a miss fail CI.
- **A JS sheet host can fight the keyboard and Android back.** Lands in F3. Lanes 5 and 6 check both.
- **Typed routes break on route moves.** Lands in N1. `check-types` and lane 10 check the moved routes.
- **New optional fields in `@repo/types` can still break `apps/web`.** Lands in G1, G2, and G3. Each runs `pnpm --filter web check-types`.
- **Migrations reach production before or after the app build.** Lands in G2, B2, and G3. Every migration is additive, the operator runs O7 before landing, and each G lane runs the base APK against the migrated schema.
- **The installed app shows a `later` row as pending.** Lands in G2. It is safe, because the old app's approve and reject still work on that row.
- **A text field inside a pan gesture can steal or drop touches.** Lands in R1. The pan turns off while a field edits, and lane 7 checks it.
- **HyperOS can kill a headless notification handler.** Lands in R2. Its Appendix A experiment runs first, and lane 5 checks the killed state.
- **A notification library adds APK size and start time.** Lands in R2. The perf rule fails above 1.5 MB or 5 percent.
- **Voice and the scanner are hard to drive from Maestro.** Lands in C2. Their Appendix A experiments run first, and the review video covers what a lane cannot.
- **Chat answer cards could disagree with the model's caption.** Lands in H2. The card numbers come from the snapshot. The caption is text only, and lane 4 checks the card against the database.
- **The Maps key may not allow the e2e package.** Lands in M1. O6 adds it before the lanes.
- **Offline banners cannot be driven over wireless adb.** Lands in H1 and every later screen PR. Jest and the review videos cover them until the Appendix A experiment passes.
- **The render tool only runs on this machine.** Lands in V4. Every review gate runs here, and the tool's paths are hard-coded for this machine, as its README says.
- **The board mirror can be stale.** Lands in every screen PR. Before an owner pairs a render, it compares the mirror board with `Artifact` `read` of `project/<Board>.dc.html` and re-reads open canvas threads with the ArtifactComments tool.
- **Perf numbers move with heat and battery.** Lands in V3. `perf.sh` refuses above 40 C, runs alternate base and head, and records the battery temperature, so an owner can explain a number before acting on it.

## Appendix D. Links and reading list

Every PR reads `docs/REDESIGN.md`, `docs/redesign/tokens.md`, `docs/redesign/glossary.md`, `.cursor/rules/project-overview.mdc`, and `.cursor/rules/docs-maintenance.mdc`.

- **Verification PRs (V1 to V4).** Read `.claude/skills/create-verification-skill/SKILL.md`, `apps/mobile/README.md` dev-client section, `docs/SETUP.md`, `apps/mobile/scripts/dev-tailscale.mjs`, and `.github/workflows/ci.yml`. The Maestro, adb, and Taildrop sources that the verification explorer cited are listed in its report at `/tmp/claude-1000/-home-kaiz404-projects-moni/fd8f0f44-0e03-4f48-ba05-4bb8f42a2239/scratchpad/explore/verification.md`. That scratchpad does not outlive this session, so V1 copies the facts it relies on into `apps/mobile/README.md`.
- **Subtraction and foundation PRs (S1, F1 to F4, N1).** Read `.cursor/rules/mobile-expo.mdc`, `docs/DESIGN_SYSTEM.md`, and the boards `V2F-Components`, `V2F-Bible`, `V2F-Nav`, `V2F-Motion`, `V2F-Feel`, `V2F-States`, `V2F-Dark`, and `CG-Guide`. Read the `expo-animation` skill before any spring, gesture, or sheet code.
- **Data gap PRs (G1, G2, G3, and the schema half of B2).** Read `.cursor/rules/shared-types.mdc`, `docs/DATABASE.md`, `supabase/README.md`, and `supabase/migrations/20261013000000_recurring_overrides.sql` as the template.
- **Screen PRs (H1, H2, A1, A2, C1, C2, R1, B1, B2, D1, K1, K2, K3, M1).** Read `.cursor/rules/mobile-expo.mdc`, each board the PR names with the `Artifact` tool's `read` action, and the board's open comment threads with the ArtifactComments tool. Open threads override `docs/REDESIGN.md`.
- **Notification PRs (R2, and G3's processor edits).** Read `.cursor/rules/mobile-headless-js.mdc` and `apps/mobile/index.js`.
- **Chat PR (H2).** Read `docs/AI.md` and `.cursor/rules/backend-go.mdc`, because H2 must leave the wire contract between `apps/mobile/lib/ai/client/types.ts` and `apps/backend/internal/extract/types.go` unchanged.

Run the `how` skill at `.claude/skills/how/SKILL.md` before the first edit in S1, F3, N1, G1, G2, G3, R1, R2, and H2. Each of these changes a shared structure, the token pipeline, the sheet layer, the route tree, the synced store, or the headless path.

Run the `interrogate` skill at `.claude/skills/interrogate/SKILL.md` on V4, F3, N1, G2, R1, R2, and H2 before the code-ready report. V4 decides sign-in and data isolation. F3 and N1 decide layers that every later screen sits on. G2 changes a production schema under installed apps. R1, R2, and H2 hold the hardest gestures, the headless path, and the card source.

Keep the decision trail per `.claude/skills/show-me-your-work/SKILL.md`. Each owner keeps an uncommitted `decisions.tsv` and returns it in its STACK-READY report. The root keeps `.audit/redesign-v2.tsv` with one row per tick, verdict, and append. The root commits that trail with M1, because a 28-PR program needs an auditable record. These rows record the planner's decisions.

```tsv
ts	phase	decision	why	evidence	result
2026-10-21T00:00:00Z	plan	run the program as autopilot-stack	work is sequenced and coupled, and the owner lands the stack	playbooks/autopilot-stack.md	decided by the coordinator
2026-10-21T00:00:00Z	plan	build the device loop, CI gates, e2e APK, seed, and smoke baseline before any v2 screen	every later PR needs them to prove its change	V1 to V4 sections	planned
2026-10-21T00:00:00Z	plan	sign Maestro in with an email and password user	login.tsx already calls signInWithPassword, so no test-only path ships	apps/mobile/lib/auth/auth-context.tsx:81	planned
2026-10-21T00:00:00Z	plan	run e2e on a second free Supabase project, with a dedicated-user fallback	keeps seed resets and migrations off production	O4	needs the operator
2026-10-21T00:00:00Z	plan	give the mock AI client fixed fixtures for e2e	mock.ts returns unavailable for every input today	apps/mobile/lib/ai/client/mock.ts	planned
2026-10-21T00:00:00Z	plan	carry transaction source and balance correction in metadata JSONB	no migration and no backend change	packages/types/src/transaction.ts	planned
2026-10-21T00:00:00Z	plan	move the wallet list into H1	the v1 Home was the only wallet list	apps/mobile/app/(tabs)/index.tsx	planned
2026-10-21T00:00:00Z	plan	land dark tokens in F1 and states in each screen PR	cheaper than a retrofit over 20 screens	Appendix B	planned
2026-10-21T00:00:00Z	plan	keep the ML Kit scanner camera for Scan	no new native camera dependency	D11	owner may override
```
