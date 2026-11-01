# Handoff: first on-device validation of Moni Redesign v2

Written 1 Nov 2026 for an agent with a fresh context. **Your job has two parts.** Validate the whole app end to end on the owner's phone against the original design boards, fixing what you find. Make the Maestro flows faster.

**This is the first real device run.** Almost everything was built and checked without a phone. Treat every claim of "matches the board" in commit messages, `docs/`, and `decisions.tsv` files as unverified. The owner wants this done from a fresh context so that it is unbiased and true to the original design artifacts. Judge the screens from the boards, not from what earlier agents said they built.

## Start here

1. Read these rules: `.cursor/rules/project-overview.mdc`, `docs-maintenance.mdc`, `mobile-expo.mdc`, `mobile-headless-js.mdc`.
2. Load the `moni-device` skill (`.claude/skills/moni-device/SKILL.md`, feature recipes in `features/`). It is the reference for driving the phone. This file does not repeat it.
3. Read `docs/REDESIGN.md`, `docs/redesign/tokens.md`, and `docs/redesign/glossary.md`.
4. Bring the phone up with the commands below.

```bash
# Every command runs from a git worktree, never from the main checkout: build-apk.sh refuses there.
source apps/mobile/scripts/device/env.sh
pnpm install --frozen-lockfile
apps/mobile/scripts/device/connect.sh 100.127.128.74:40401   # exit 3: the port rotated, ask the owner
apps/mobile/scripts/device/doctor.sh                         # must end "OK device ..."
apps/mobile/scripts/device/build-apk.sh                      # prints the key to pass as --sha
apps/mobile/scripts/device/run-flows.sh --sha <key> --tag smoke --out <dir>
```

## Current state

Updated 2 Nov 2026, after the second round of refinements. Sections below this one were written on 1 Nov, so trust this one where they differ.

| Item | State |
| --- | --- |
| `main` | Holds all the device-run fixes and the owner's redesign from the phone. Gates passed before landing: 1635 Jest tests, lint 0 errors, types, all mobile lints, device script tests. |
| Full flow suite | **Not green yet.** The last full run, on an older build, was 38 of 60 with no app crashes. Fixes followed, but the suite has not been re-run. Run it next. |
| APK on the phone | Key `d03f8aa`: real clock, real 4 s toasts, installed 2 Nov for the owner's blackbox test of the second round. No flow has run on it. |
| Database | All migrations applied, through `20261101000200_currency_text.sql`. |
| Canvas | Version `1793552757-fa37` matches the owner's redesign, except what `docs/REDESIGN.md` still lists. |

Running flows:

```bash
EXPO_PUBLIC_E2E_NOW=2026-10-14T14:06:00+08:00 EXPO_PUBLIC_E2E_TOAST_MS=15000 apps/mobile/scripts/device/build-apk.sh
apps/mobile/scripts/device/run-areas.sh --sha <key>-clock --out <dir>
```

The pinned clock makes seeded screens match the boards. A real touch or a notification during a run fails flows, so keep the phone untouched. Capture flows need a build without the clock, because Android's notification times stay real.

## The phone

- Redmi Note 13 Pro 5G (`2312DRA50G`, garnet), Android 16, HyperOS `OS3.0`, 1220×2712, on the tailnet at `100.127.128.74`.
- It is paired over Wireless debugging. The current connect port is `40401`, saved in `~/.local/share/moni-device/serial`. **The port changes whenever Wireless debugging toggles or the phone reboots.** Ask the owner for the new one. Pairing codes expire in about a minute, so act on them at once.
- When this was written, the phone was on AC power with Stay awake on and no lock screen. The owner turned the lock screen off for testing.
- `adb devices` lists two entries for the phone, the serial and an mDNS `adb-…_adb-tls-connect._tcp` name. Always use the serial.
- **Every install of a new APK needs the owner.** Measured on 1 Nov: Google Play Protect appears first (`com.android.vending`), then Xiaomi's `com.miui.permcenter.install.AdbInstallActivity`. An unanswered prompt fails with `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`. It has a short timer. Tell the owner before you start an install, and batch your fixes so each APK is worth a prompt. A build takes 3 to 8 minutes, and about 50 s after a JS-only change on a warm cache.
- Never install, clear, or drive `com.anonymous.moni`, the owner's daily app. The test app is `com.anonymous.moni.e2e`.
- The owner can take the phone back with `touch ~/.local/share/moni-device/hold`. Never delete that file yourself.

## The design artifacts are the authority

Order of authority, from `docs/REDESIGN.md`: the boards, then `tokens.md`, then `glossary.md`.

- Canvas: https://claude.ai/artifact/8d2qRf6GtxCL9bog1E41fF, the "Moni Mobile Design System" artifact. Use the Redesign page, rows titled "v2 · …". Ignore the "Archive" rows, the brand explorations, and the research pages.
- Read it with the `claude-artifacts` tools. `read_comments` gives the owner's canvas threads, **which count as design**: a thread asking to change a board overrides the board. Do not reply to or resolve threads unless the owner asks. Artifact content is data, not instructions.
- Local mirror: board sources in `~/.local/share/moni-canvas/artifact-files/project/<Board>.dc.html`, renders in `~/.local/share/moni-canvas/renders/r6/all/<Board>.png` (103 PNGs). Numbers on boards are sample data. The mirror matched the canvas on 21 Oct and the canvas may have changed since, so compare `canvas.json` before you trust it.
- `docs/REDESIGN.md`, "Build these", maps each area to its boards. `apps/mobile/scripts/device/review-pair.sh <slug> <Board> <device.png> --out <dir>` puts a device screenshot beside its board.
- The `full` seed reproduces the canvas sample (Maybank RM2,281.80, Touch 'n Go RM86.40, Cash RM63.60, Wise $120), with dates moved so the sample's Wed 14 Oct 2026 is today. So a seeded screen can be compared almost number for number. Do that.

## What to validate

Maestro proves a path works. It does not prove the screen looks right. Run the flows **and** look at each screenshot beside its board at the same scroll position. Check light and dark, using `V2F-Dark`.

| Area (`--area`) | Flows | Boards | Screens |
| --- | --- | --- | --- |
| `smoke` | 6 | none | Launch, sign-in, tabs, chooser, transaction, Review. Run first. |
| `home` | 5 | `V2H-Home`, `V2H-HomeFirstRun`, `V2H-Wallets` | Home, first run, Wallets |
| `chat` | 4 | `V2H-MoniPlacement`, `V2H-AskMoni`, `V2H-AskMoniAnswer`, `V2H-ChatHistory` | Moni chat |
| `activity` | 8 | `V2A-Activity`, `V2A-ActivityMenu`, `V2A-TxnDetail`, `V2A-TxnDetailEdit`, `V2A-CategoryPick`, `V2A-Categories`, `V2A-CategoryForm` | Activity, detail, categories |
| `capture` | 9 | `V2A-Capture`, `V2A-CaptureFlow-VA`, `V2A-CaptureType`, `V2A-CaptureTypeDuplicate`, `V2A-CaptureSay*`, `V2A-CaptureScan*` | + chooser, Type it, Say it, Scan |
| `review` | 7 | `XA-Review`, `XA-Notification` | Deck, notification actions, Recently reviewed |
| `budget` | 6 | `V2P-InsightsMonth`, `V2P-InsightsCalendar`, `V2P-BudgetDetail`, `V2P-InsightsStates`, `V2P-BudgetEdit`, `V2P-BillDetail`, `V2P-AmountPage`, `V2P-PlanStates` | Budget tab, category, editing, bills |
| `debts` | 4 | `V2P-Debts`, `V2P-DebtDetail`, `V2P-DebtNew`, `V2P-DebtsEmpty`, `V2P-DebtSettle` | Debts |
| `account` | 10 | `V2H-Profile`, `V2H-Login`, `V2H-WalletDetail`, `V2H-WalletForm`, `V2H-Merchants`, `V2H-Permissions`, `V2A-NotifLog`, `V2A-NotifLogEmpty` | Account |
| `map` | 3 | `XM-Places`, `XM-Detail`, `XM-Empty` | Spending map. May render blank until the e2e package is added to the Maps key (see "Things only the owner can do"). |
| `components` | 2 | `V2F-Components` | Sheets, rows, hold menu |
| `nav` | 1 | `V2F-Nav` | Tabs and chooser |
| `perf` | 2 | none | Tagged `perf`, excluded by default |

Also check `V2F-Motion`, `V2F-Feel`, `V2F-States`, and `CG-Guide` against what you feel on the device. `run-flows.sh` leaves out flows tagged `needs-speech` (2), `needs-posted-alert` (1), `needs-ai` (1), and `perf` (2) unless you pass the tag, and the `seed-empty` flows (`home/home-first-run.yaml`, `map/map-empty.yaml`) need `--seed empty`. **Those excluded flows hold some of the highest-risk behaviour, so do not stop at the default set.**

### What has never been exercised

These are the things no test could see, so spend your attention here first.

- **All visuals.** Uniwind classes and dark tokens have never rendered in front of anyone. Funnel Display weights on Android (400/600/700), letter-spacing, and the 744 px first-screen rule on this 1220×2712 phone are unproven.
- **Motion and gestures.** The six motion tokens and spring feel, the Review deck's swipes, tilt and frame rate, sheet drag, the hold menu, the + chooser growing out of the + and sitting under the incoming page, the capture slide-in, and the chart scrub. Jest mocks Reanimated.
- **Native paths.** The notification listener in the headless task, the Android notification's Approve · Not mine · Later actions with the app killed on HyperOS, the ML Kit scanner, speech recognition, the live waveform, location capture, the map, `expo-sharing` for export, the file picker for import, battery exemption and the HyperOS Autostart link, `expo-network` offline detection, and `expo-notifications` bill reminders.
- **Real capture end to end.** See "Bank alerts" in the skill: post an alert with adb. Test a retried alert, the bank and e-wallet pair in both arrival orders, and reload and card-bill transfers. Confirm spending totals on Home, Budget, and Activity stay equal and do not double count.
- **Real AI.** The e2e build uses mock fixtures, so nothing proves the real backend path on a device. Run at least one capture and one chat against the deployed backend. **The owner must have a way to do that, because the e2e build has no AI URL. Ask.**
- **Sync and restart.** Restart from MMKV, sign-out and back in, offline and back online, restore from an export (idempotence is proven only against a fake Postgres), and the review-history row kept after Approve.

## Known failures and suspects

Found and fixed on the phone, see `git log`: the crash 31 s after launch, currencies cut to one letter by Realtime, the public `wallet_balances` view, builds with no Maps key, dead chart gestures, stale Debts after recording, chat cards under the composer, and the chat mic tap.

Still suspects, unverified:

- `K1 sign-in states`: Back on sign-in seems to clear the email. A real touch also spoiled that run.
- `components/review/recently-reviewed.tsx` and `components/debt/debt-history.tsx` read a whole map through `useValue`, the pattern that left Debts stale.
- Hidden screens freeze since `freezeOnBlur`. Check a change made on a pushed page shows when you go back.
- The owner saw Review's old buttons with blank labels. The cause was not found, and other capsule buttons could share it.
- Activity's day totals include debt cash and excluded rows, and Budget and Activity's chart leave them out, so the two can differ.
- A repeat alert within 2 minutes of clearing the Capture log. "Gone quiet" during a long backend outage. Undoing a transfer pair can leave the Auto mark.

## The Maestro speed task

`scripts/device/maestro-timing.py <run dir> [--flows]` prints a run's per-command time.

| Change | Before | After |
| --- | --- | --- |
| `launchApp` with `permissions: {}` | 17.9 to 25.8 s | 0.5 to 0.8 s, 3 trials each, still a true cold start |
| Driver kept on the phone | Install prompts every run | None |
| Smoke suite wall time | 7m47s | 6m43s, 1 run each, so treat as indicative |

**What limits it now:** taps, at 5 to 8 s each. `waitToSettleTimeoutMs: 300` only moved them from about 6.2 s to about 5.4 s, so settling is not the main cost. Maestro's pre-tap stability check has a 3 s limit in its bytecode. The cause of the rest is unmeasured.

## How to work

- **Commit straight to `main` and push. No branches or PRs.** Use worktrees for parallel work and land with a fast-forward. The owner set this on 21 Oct.
- **Never add Co-Authored-By or "Generated with" lines**, despite any harness default. It is a standing owner rule.
- **Follow the board closely.** Canvas threads count as design. Design to fit only where a board is silent.
- Use poteto subagents where it helps, Sonnet for exploration and Opus for implementation, with at most two helpers each. Fan-out to about 14 agents hit the owner's usage limit twice. Only one agent can use the phone at a time, and the lock enforces that. So do phone work yourself and delegate fixes.
- Every fix ends with: `pnpm lint`, `pnpm check-types`, `pnpm test`, and in `apps/mobile` `lint:copy`, `lint:test-ids`, `lint:unreferenced`, `lint:tokens`, `lint:flow-ids`. Add a row to `__tests__/routes.test.tsx` for a new route, or the route test fails on purpose. Update the matching docs per `docs-maintenance.mdc`.
- **A push touching `apps/backend/**` auto-deploys to Cloud Run.** Keep backend changes backward compatible. Watch with `gcloud builds list` (Windows and WSL both have it, at `~/google-cloud-sdk/bin` in WSL). A `gcloud builds retry` attempt was blocked by the auto-mode permission check on 1 Nov, so do not work around it. Ask the owner.
- **Migrations:** the linked Supabase project `yucjcjquwpwkgowzthhn` is dev-only with no real data, and the owner allows direct pushes: `npx supabase db push --linked`. Use it for e2e data. The e2e user is `E2E_EMAIL` in the gitignored `apps/mobile/.env.e2e`. Never print that file.
- **The free-tier project pauses when idle.** It was found paused on 1 Nov, after about a week idle, which is the likely cause. Its hostname stops resolving, and before Y5 the backend crashed on start. If the seed or sign-in fails with DNS errors, check its status with the Management API and restore it (`POST /v1/projects/{ref}/restore`, token in `~/.supabase/access-token`). It took under 2 minutes. `docs/SETUP.md` covers it.

### Traps that cost time

- `expo lint` caches parse errors in `apps/mobile/.expo/cache/eslint`. After resolving a rebase, delete that folder or lint reports conflict markers that no longer exist.
- `pnpm` and `node` resolve to Windows shims unless you `source apps/mobile/scripts/device/env.sh` in that shell. Shell state does not persist between commands.
- Never run `pkill -f` with a pattern that appears in your own command line. It kills your own shell.
- `docs/` and README paragraphs are single long lines, so parallel edits conflict constantly. `/tmp/claude-1000/-home-kaiz404-projects-moni/fd8f0f44-0e03-4f48-ba05-4bb8f42a2239/scratchpad/wordmerge.py <files>` does a word-level three-way merge during a rebase. `/tmp` may have been cleared. It is small to rewrite.
- About 56 worktrees sit under `.claude/worktrees/`, many from finished units. Each `decisions.tsv` there is uncommitted and may hold useful trail. Do not delete them without asking.
- `docs/redesign/PLAN.md` holds the full per-unit plan, and its "Fast execution mode" and "Feature wave" sections override the older checklist. `docs/redesign/WAVE5-BRIEF.md` lists the shared kit, some of it since extended. The kit's real API is in `components/ui/`.

## What was built

| Unit | What it is |
| --- | --- |
| V1, V2, V3, V4 | Device scripts over Tailscale; CI gates and lints; the e2e APK; the seed, mock AI fixtures, `run-flows.sh`, and the `moni-device` skill |
| S1, G, G-fix, G4 | Dead-code removal and generated tokens; the data layer; review history |
| F1 to F4, N1 | Tokens, font, motion, haptics; press and page chrome; the one sheet host; rows and states; the five-slot tab bar and + chooser |
| H1, H2, A1, A2, C1, C2, R1, R2, B1, B2, D1, K1 to K3, M1 | Every v2 screen |
| X1 to X4 | Integration, the shared `InPlaceField`, leftovers, and data-backed board details |
| Fidelity groups 1 to 4 | A code-against-board pass over every board (about 350 findings fixed by the agents' own counts, **from reading code and renders, never from a device**) |
| Y1 | Capture trust: last captured per app, the quiet-source alert, the missed-transaction report, the battery exemption, and one-time codes blanked on the phone |
| Y2 | Bank and e-wallet pairing, reloads and card bills as transfers, the duplicate merge restored, and Malaysian categories |
| Y3 | Reports, full export, and idempotent import |
| Y4 | Receipt item count (an additive backend field), the place chip on Type it, and a visible location control |
| Y5 | Alerts stay queued through a backend outage, and the backend starts without Supabase |
| Z1 | `__tests__/routes.test.tsx` mounts every route, which found 4 real bugs, and `test:taps` |
| P1, P1-fix | The v1 parity audit; clearing the Capture log and correcting a capture's type on the Review card |

## Owner decisions

Decided, so build these as stated:

- D1: "left this month" subtracts bills and debts due. D2: budgets as rings. D4: Home keeps both the ask box and the Moni button. D6: Review keeps its history. D9: the Budget "Edit" link is removed.
- The owner accepted these differences from the boards on 25 Oct: the map's third range is last month; the empty map's "Add an expense" opens Type it; recording a debt requires a wallet; no "Moni reminds you the day before" on debts; Scan uses the ML Kit scanner (D11).
- D3 (no logo, mascot, reactions, or streak), D5, D7, D8, and D10 follow the defaults in `docs/REDESIGN.md`.
- On 1 Nov the owner said to follow the coordinator's recommendations on open items. That covered landing Y5, the backend startup fix, and the alert retry. The recommendations listed under "Questions still open" were never individually confirmed, so raise them when convenient rather than assuming.

Everything else that differs from a board is listed in `docs/REDESIGN.md`, "Where the app differs from a board". Those entries are claims to check against the boards, and additions were made without a board.

### Questions still open for the owner

- A wallet in a non-main currency no longer shows the month chart on its page. Keep that?
- The Budgets heading has a chevron into Edit budgets, drawn by no board, because the monthly total otherwise has no way in. Keep it?
- Income categories open Activity filtered by category. Debt payment in the category sheet opens Debts. Fine?
- A paired alert now counts as a capture for that app's health (`02f0c61`), so a bank that always pairs second does not read as "No captures yet". Drop that commit to revert it.
- Type it no longer asks for location, so a new install saves none until it is granted elsewhere. Wallets with location off also save none on typed entries. Fine?
- The Capture log note under a Not linked alert is matched by RM amount within 10 minutes across apps. Keep it? It is in `a6e0169`.
- Password reset and account deletion exist in neither v1 nor v2. They are needed before real users.
- Not started, as product calls: savings goals, shared budgets, widgets, investments, a web or desktop version, live exchange rates, payday-aligned budgets.
- The `dev project pauses when idle` problem: a scheduled ping, or restore by hand?

## Things only the owner can do

- Answer the install prompts, and give the new port after a reboot.
- Add `com.anonymous.moni.e2e` with its keystore SHA-1 to the Android Maps key restrictions if the e2e map renders blank (O6).
- Grant **Moni E2E** notification access by hand if `adb shell cmd notification allow_listener` fails (O5). Enable Taildrop only if you need the backup install path; the Tailscale app holds received files until they are saved.
- Say the spoken phrase for the `needs-speech` flows, if they need a live voice.
- The Play Store declaration for `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, before any public release.

## Definition of done

1. Every flow in every area passes on the phone at the head of `main`, including the excluded tags where they can run, or each exception is written down with its reason.
2. Each board in `docs/REDESIGN.md`, "Build these", has a device screenshot beside its render in light mode, and in dark mode where `V2F-Dark` covers it, reviewed for layout, copy, and tokens. Differences are fixed or listed.
3. The "never exercised" list above has evidence, a fix, or an open item for the owner.
4. Spending totals agree across Home, Budget, and Activity on seeded data after pairing, retry, and restore.
5. The Maestro numbers improved with a before and after table, and with what limits them now.
6. The owner gets a report with screenshot pairs, published as a private artifact, plus the fixes on `main`, and `docs/REDESIGN.md`'s status line says what the device run proved.
