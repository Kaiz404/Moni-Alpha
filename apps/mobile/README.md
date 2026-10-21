# Moni — mobile app

Primary Moni client: Expo SDK 57 + expo-router, offline-first via Legend-State observables synced directly to Supabase (MMKV persistence).

## Develop

```bash
pnpm install                # repo root
pnpm --filter moni dev      # Metro / Expo (terminal 1)
```

Env: copy `.env.example` to `.env` (Supabase publishable key, AI backend URL, Google web client ID, Maps SDK key — see [docs/SETUP.md](../../docs/SETUP.md)).

This app uses native modules (camera, notifications, Google Sign-In) — **Expo Go will not work**. Use a dev client:

| Build                           | Command                                       |
| ------------------------------- | --------------------------------------------- |
| **Local (WSL / macOS / Linux)** | `cd apps/mobile && npx expo run:android`      |
| **GitHub Actions**              | Push a branch or run the CI workflow manually |

GitHub Actions creates a debug APK without EAS on every PR and `main` push. Download the APK from the workflow run for successful `main` or manual builds; it is retained for seven days. See [docs/SETUP.md](../../docs/SETUP.md#github-actions-android-ci).

Rebuild the dev client when you change `app.json` plugins, native deps, or local modules (`modules/moni-android-apps`, `modules/moni-document-scanner`).

### Code style

Formatting is enforced with [Prettier](https://prettier.io/) (repo-root `.prettierrc`: `printWidth` 70 for `.tsx`, 100 for `.ts` so screens wrap label text while hooks keep one-line `useState`). Run `pnpm format` / `pnpm format:check` from the repo root.

### Android dev client on WSL (recommended on Windows)

Clone and build on the **WSL Linux filesystem** (e.g. `~/Moni`), not `/mnt/c/...` — Windows paths break Gradle autolinking and hit path-length limits. Open the repo in Cursor via **Connect to WSL**.

**One-time setup** (toolchain, SDK, env vars): [docs/SETUP.md § WSL Android toolchain](../../docs/SETUP.md#wsl-android-toolchain).

**First native project** (or after switching from a Windows checkout):

```bash
cd apps/mobile
rm -rf android
npx expo prebuild --platform android --clean
```

**Install / rebuild dev client** (phone connected — see below):

```bash
npx expo run:android
# or reinstall an existing APK:
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Day-to-day:**

```bash
# terminal 1 — from repo root
pnpm --filter moni dev

# terminal 2 — only when native deps / app.json plugins change
cd apps/mobile && npx expo run:android
```

**Physical device (USB):** WSL2 does not see USB directly. On Windows (admin PowerShell): `usbipd list` → `usbipd bind --busid <ID>` → `usbipd attach --wsl --busid <ID>`. In WSL: `adb devices` must show `device` (not `no permissions` — udev rules in SETUP). MIUI/Xiaomi: enable **Install via USB** in Developer options.

**Metro over USB (WSL2):** the phone cannot reach the WSL virtual IP (`172.x.x.x`). `pnpm dev` / `pnpm start` run `adb reverse tcp:8081 tcp:8081` and start Metro with `--localhost`. If the dev client still shows a stale LAN URL, force-quit the app, run `node scripts/adb-reverse.mjs`, then `pnpm dev` and reopen Moni.

Do not mix Windows and WSL `expo prebuild` / Gradle — `android/build/generated/autolinking/autolinking.json` must use Linux paths (`/home/...`), not `C:\...`.

### Drive the phone over Tailscale

The scripts in `scripts/device/` let an agent or a person drive a phone from WSL over Tailscale, with no USB cable. They default to the owner's Redmi Note 13 Pro 5G, Tailscale name `redmi-note-13-pro-5g` at `100.127.128.74`. Set up the toolchain and the phone once, per [docs/SETUP.md § Phone over Tailscale](../../docs/SETUP.md#phone-over-tailscale).

Android shows the adb port under **Developer options > Wireless debugging > IP address & Port**. The port changes each time Wireless debugging turns on and after every reboot. Connect once with the current port:

```bash
source apps/mobile/scripts/device/env.sh
apps/mobile/scripts/device/connect.sh 100.127.128.74:40945
apps/mobile/scripts/device/doctor.sh
```

The last line of `doctor.sh` is `OK device 100.127.128.74:40945 android 16 hyperos OS3.0`.

`connect.sh` saves the serial it reached in `~/.local/share/moni-device/serial`, so later scripts and `connect.sh` with no argument use the same port. Each script resolves the serial in this order: an exported `MONI_DEVICE_SERIAL`, the saved serial, then `100.127.128.74:5555`. A serial with no port gets port 5555. `env.sh` replaces a `MONI_DEVICE_SERIAL` that is set but not exported, so export it or put it before the command, as in `MONI_DEVICE_SERIAL=100.127.128.74:40945 apps/mobile/scripts/device/doctor.sh`.

Run each phone command through `with-device.sh`. It waits for the device lock, so only one lane uses the phone at a time. Then it runs `doctor.sh` and the command:

```bash
apps/mobile/scripts/device/with-device.sh --pr v1 --lane smoke -- apps/mobile/scripts/device/screenshot.sh /tmp/home.png
```

The scripts and their exit codes:

- `env.sh` puts `scripts/device/bin`, `$ANDROID_HOME/platform-tools`, Maestro, and nvm node 22 at the front of `PATH`, in that order, and sets `MONI_DEVICE_SERIAL`. `bin/adb` runs the real `adb` without the lock's file descriptor, so an adb server that starts during a lane never holds the lock. It runs `corepack enable` when node 22 has no `pnpm` yet, and it creates `~/.local/share/moni-device/`. Source it from bash.
- `connect.sh [host[:port]]` runs `adb connect` up to three times and saves the serial once the state is `device`. A host with no port gets port 5555. When the serial changes, it disconnects the old one. It exits 0 when connected, 2 for a bad argument such as a port that is not a number, and 3 when adb is down.
- `doctor.sh [--toolchain]` checks the hold file, adb 37, Java 17 or later, a Windows adb server on port 5037, Tailscale status and ping, the device state, a wake key without `SecurityException`, a battery above 30 percent, and Maestro 2.11.0. On the phone, it sends only the wake key. On the computer, it sources `env.sh`, and its first `adb` call starts the adb server when none runs. `--toolchain` also prints the tool paths and fails when one resolves under `/mnt/`. It exits 0 when every check passes and 1 otherwise.
- `with-device.sh [--pr <id>] [--lane <name>] [--skip-doctor] -- <command>` waits up to 45 minutes for `redmi.lock`, writes the holder to `redmi.owner`, which keeps the last 200 holders, runs `doctor.sh`, starts the adb server, then runs the command with `ANDROID_SERIAL` set, so a plain `adb` call reaches the phone. The lock stays taken until the command and every process it started have exited. A process the command leaves running keeps the phone locked until it exits. `--pr` and `--lane` default to `MONI_PR_ID` and `MONI_LANE`. Use `--skip-doctor` to run `connect.sh` under the lock. A `with-device.sh` call inside a locked command runs at once without the lock. If the script gets `TERM`, `INT`, or `HUP`, it sends `TERM` to the command's process group, waits up to 10 s, and then sends `KILL`. If the script itself gets `kill -9`, the command keeps running and keeps the lock until it exits. It exits 4 on an operator hold, 5 when the lock wait times out, 6 when `doctor.sh` fails, and otherwise with the command's code.
- `screenshot.sh <out.png>` saves a screenshot as a PNG. It exits 1 when the phone returns no PNG.
- `taildrop.sh <file>` sends a file to the phone with Taildrop, for when adb is down.

The lock, the owner log, and the saved serial live in `~/.local/share/moni-device/`. To keep agents off the phone while you use it, run `touch ~/.local/share/moni-device/hold`. Delete the file to let them back on.

`doctor.sh` prints `note keyguard showing` when the phone is locked. The scripts never unlock the phone, so unlock it before a lane drives an app.

Keep the Windows adb server stopped. With mirrored networking, Windows and WSL share `127.0.0.1:5037`, so only one adb server can run. If `doctor.sh` reports `port-5037 held by Windows`, run `adb.exe kill-server` on Windows, then `connect.sh` in WSL.

To test the scripts, run `bash apps/mobile/scripts/device/test/device-scripts.test.sh`. The tests need the WSL toolchain above but not the phone.

### The e2e APK

Agents test a release build named **Moni E2E**, package `com.anonymous.moni.e2e` and scheme `moni-e2e`, that installs beside the daily `com.anonymous.moni` app and runs without Metro. `APP_VARIANT=e2e` switches `app.config.ts` to that name, package, and scheme. Without the variable the config is the daily app's.

```bash
apps/mobile/scripts/device/build-apk.sh          # prints: built <key> <apk> in <n> s, or cached <key> <apk>
apps/mobile/scripts/device/with-device.sh --pr v3 --lane smoke -- apps/mobile/scripts/device/install.sh <key>
```

- `build-apk.sh [--clean-prebuild] [--allow-main]` builds the arm64 release APK and copies it to `~/.cache/moni-apk/<key>/app-release.apk` with a `build.json` that records the SHA, the byte count, and the build seconds. The key is the `HEAD` SHA, or `<sha>-dirty-<hash>` when `apps/mobile`, `packages`, or the lockfile has changes. A key that is already cached with the same env returns at once. The script runs `expo prebuild --clean` only when the Expo native fingerprint differs from the one saved in `android/.moni-fingerprint`, so a JS-only change goes straight to Gradle. It refuses to run in the main checkout, where prebuild would rewrite your `android/` folder, unless you pass `--allow-main`. It exits 3 on that refusal.
- The build reads `.env.e2e`, then `.env`, from this worktree and then from the main checkout, and the first value it reads for a key wins. `EXPO_PUBLIC_AI_API_URL` defaults to empty, so the e2e app uses the mock AI client. Copy `.env.e2e.example` to `.env.e2e` to point the build at the e2e Supabase project. Until that project exists, the build uses the project in `.env`.
- `install.sh <key>` installs only `com.anonymous.moni.e2e` and exits 3 for any other package. It skips the install when `/data/local/tmp/moni-e2e.sha` on the phone already holds the key, then grants each of the camera, microphone, location, and notification permissions that the APK requests. The app does not request `POST_NOTIFICATIONS` today, so the script skips it. It exits 4 when `adb install` fails or takes longer than `MONI_INSTALL_TIMEOUT` seconds, default 300. The first install of a new package can wait on a **Google Play Protect** "Send app for a security check?" dialog or an **Install via USB** prompt, and only the person holding the phone can answer it.
- `perf.sh --sha <key> [--flow <flow.yaml>] [--out perf.json] [--runs 10]` installs the key, then writes `coldStartMs`, the median `TotalTime` of `am start -W` after `am force-stop`, with `apkBytes` and `bundleBytes`. With `--flow`, it also runs the Maestro flow and records `jankyPct`, `p50Ms`, `p90Ms`, and `p95Ms` from `dumpsys gfxinfo`. It exits 7 when the battery is above 40 C.
- `perf-compare.mjs base.json head.json --rule <metric>=<limit>` prints one line per metric and exits 1 when a rule fails. A limit of `N` caps the head value, `+N` caps the increase, and `+N%` caps the increase relative to the base.
- `screenrecord.sh <seconds> <out.mp4>` records the screen for up to 180 s and pulls the MP4.

## Map

| Path                              | Role                                                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                            | expo-router: `(auth)`, `(tabs)` (Home / Activity / Budget / Debts), pushed root Stack pages (`chat`, `profile`, `wallet`, `transaction`, `proposal`, `categories`, `budget/list`, `debt`, `scan`, `merchants`, `capture-sources`, `capture-log`, `debug`, `map`, `place`) |
| `components/`                     | Domain UI (`ui/`, `nav/`, `providers/`, `auth/`, `wallets/`, `budgets/`, `chat/`, `profile/`, `merchants/`, `capture-sources/`, `capture-log/`, `transaction/`, `proposal/`, `scan/`, `debug/`, `receipt/`) — keep screens thin; no co-location under `app/` |
| `lib/store/`                      | Legend-State synced observables — persisted source rows and command write targets; `profilePreferences$` caches profile preferences; `GATED_MIGRATIONS` gate tables and columns until a probe finds the migration                   |
| `lib/finance/`                    | Non-persisted finance projection, minor-unit helpers, integrity repair, cached Legend selectors (cards, charts, budgets, debts, AI snapshots), map places (`places.ts`), `useMainCurrency`, `selectUpcomingBills`                                    |
| `lib/supabase/`                   | Supabase client (publishable key) + CRUD helpers over the store; profile preferences                                                                                                                                                |
| `lib/auth/`                       | Auth context (email/password + native Google Sign-In)                                                                                                                                                                               |
| `lib/mmkv/`                       | MMKV instances: auth session, store cache, upload queue, UI preferences (theme, default wallet)                                                                                                                                     |
| `lib/theme/`                      | Theme preference ↔ Uniwind (`light` / `dark` / `system`)                                                                                                                                                                            |
| `lib/motion/`                     | v2 spring tokens (`springs.press` … `throw`), the 1:1 drag rule, fling projection
| `lib/haptics/`                    | One function per tokens.md haptic moment (`keypadTap`, `approve`, `notMine`, …); the only `expo-haptics` importer
| `lib/wallets/`                    | Default wallet preference (`profiles.preferences.default_wallet_id`, MMKV cache), proposal wallet/currency resolution for AI, `correctBalance`, the wallet page helpers, and the Alerts from link reader |
| `lib/ai/`                         | Processing queue, background processor, AI client (HTTP ↔ Go backend, mock fallback)                                                                                                                                                |
| `lib/notifications/`              | Prefilter / package helpers: `*.core.js` (headless + Node tests) + thin `*.ts` re-exports; linked-app MMKV cache (and location-off apps); capture log statuses and `groupCaptureLog` (day groups, glossary labels); curated app metadata after access via `moni-android-apps`             |
| `lib/receipts/`                   | ML Kit scan normalization, local image save, Storage upload queue                                                                                                                                                                   |
| `lib/speech/`                     | Shared on-device speech recognition options, permissions, offline model prep                                                                                                                                                        |
| `lib/transactions/`               | Transaction helpers: location prefetch for quick-add and ephemeral draft state on the new-transaction screen                                                                                                                        |
| `global.css`                      | Uniwind tokens: v2 colour roles (light and dark), radii, spacing, Funnel Display families. Source for `constants/theme-tokens.generated.ts` |
| `constants/wallet-card-styles.ts` | Curated solid card-color presets for wallets (`wallets.card_style_id`) — append here to add a new style                                                                                                                             |
| `index.js`                        | Android headless notification listener (registered before expo-router; requires `*.core.js`)                                                                                                                                        |

**Routes (short URLs):** tabs `/`, `/activity`, `/budget`, `/debts`; pushed `/chat`, `/profile`, `/categories/...`, `/budget/list`, `/budget/form`, `/debt/...`, `/merchants`, `/capture-sources`, `/capture-log`, `/debug`, `/map`, `/place/[id]`, `/wallet/...`, `/transaction/...`, `/proposal/[id]`, `/scan/...`. Shared feature screens sit on the root Stack (not per-tab stacks) and slide in from the right with no tab bar. **Tab bar:** custom JS `Tabs` with the floating pill in `components/nav/tab-bar.tsx` (`TABS` lists the tabs) and the + in `plus-button.tsx`. The + opens `openCaptureChooser()` in `capture-chooser.tsx`, the `chooser` sheet kind: Type it → `/transaction/new`, Scan a receipt → `/scan/receipt`, Say it → `/scan/listen`, Ask Moni → `/chat`, until the v2 capture pages exist.

**Spending map:** `/map` (pushed from the Budget tab) and `/place/[id]?range=` read `groupPlaces` in `lib/finance/places.ts`: main-currency located expenses cluster into places of 150 m around a fixed anchor, and the anchor's rounded coordinates are the place id, so a range or category filter never renames a place. `clusterPins` merges pins that would overlap on screen. Screens and pieces live in `components/map/` (`MapSheet` grabber, `PlacePins` custom markers, `PlaceCard`, `TopPlaces`, `MapEmpty`, the Google map style). The place page sends **See these in Activity** as `dismissTo('/activity', { placeId })` and **Ask Moni about it** as `/chat?draft=`.

## Theming

**Redesign v2 is in progress:** screens are being rebuilt to the design canvas; start from [`docs/REDESIGN.md`](../../docs/REDESIGN.md) (boards, [tokens](../../docs/redesign/tokens.md), [glossary](../../docs/redesign/glossary.md)). Until a screen is rebuilt, [`docs/DESIGN_SYSTEM.md`](../../docs/DESIGN_SYSTEM.md) (v1) describes it. Tokens are CSS-first in `global.css` and carry the v2 values (Cream, Paper, Ink, the pastels; dark from `V2F-Dark`); prefer semantic classes (`bg-canvas`, `bg-card`, `text-foreground`, `text-muted`, `bg-sand`, `text-ink-2`, state tokens). Import `Text` from `components/ui/text` (Funnel Display, `variant` for the type scale; ESLint rejects the `react-native` import) and set weight with `font-display-semibold` / `font-display-bold`, never `font-bold`; `scripts/codemods/text-to-v2.mjs` rewrites old imports and weight classes and shared UI under `components/ui/`: `Page` (page chrome, one header `kind` per page), `Press` (the press primitive), `Button`, `HeaderIconButton` and `MoniButton`, `PickerField`, `FormField`, `SolidWalletCard`, `ListCard`/`ListSection`, `TransactionRow` (66-tall row; `onHold` turns on `HoldMenu`, `HoldHint` teaches it once), `NavRow`, `Chip`, `Segmented`, `ProgressBar` (the one budget bar), `StatusPill`, `Banner` (`providers/sync-banner.tsx` shows sync errors with Retry), `Skeleton` (after 300 ms), `EmptyTile`/`NotFound`, and the `ToastHost` mounted in `app/_layout.tsx`. Show a toast with `showToast` from `lib/toast/toast-store.ts` (one at a time, 5 s, Undo); the hold menu's Delete confirms through the confirm sheet, not a toast. Format money with `lib/finance/format-money.ts` (`RM45.90`, U+2212 minus, whole-unit "RM20 over") and days with `lib/dates/day-label.ts` (`Today`, `Wed 14 Oct`, the year only outside this one). Every `Press`-based control takes a required `testID` built with `tid()`; `lint:test-ids` also checks `Chip`, `NavRow`, and `TransactionRow`, and `Segmented` and `HoldMenu` build theirs from a `screen`. A card is a `View` with `rounded-card` and a role fill (`bg-card`, `bg-sand`, a low-tint pastel). `scripts/codemods/add-test-ids.mjs` adds a named `tid()` testID to any control that lacks one and lists the ones it cannot name. For native APIs that need a color string, use `useThemeTokens()`; its names and fallbacks come from `constants/theme-tokens.generated.ts`. Change semantic tokens in `global.css` only, then run `pnpm --filter moni gen:tokens` (CI runs `lint:tokens` and fails on a stale file) — do not hardcode hex in screens.

Use `IconSymbol` for app icons. Material Design Icons are the default; set `family` to use Ionicons, Feather, or Font Awesome 6 when required. Titles and section headings stand alone; do not add subtitles beneath them.

Wallet cards render `SolidWalletCard` with clean, Figma-aligned pastel fills driven by `wallet.cardStyleId` looked up in `constants/wallet-card-styles.ts`; the wallet forms use the same solid fills and set `wallet.color` to the style's flat swatch hex for charts/legends. Cards do not use a grain texture overlay.

**Wallet page and form:** `app/wallet/[id].tsx` is the wallet page; `?edit=balance` opens it with the balance field focused (the Home check-in's Fix it). `components/wallets/wallet-hero.tsx` edits the name and balance in place (`in-place-field.tsx`), `wallet-sections.tsx` holds the review strip, the day-grouped rows (`groupWalletDays` in `lib/wallets/wallet-page.ts`), and ALERTS, and `wallet-menu.tsx` the ⋯ menu. A balance fix runs `correctBalance` (`lib/wallets/balance-correction.ts`, the one shape of the row: income or expense of the difference, `analysisExcluded`, `metadata.kind: balance_correction`, titled "Balance correction") and `createBalanceCorrection` writes it; Undo soft-deletes the row and restores `balance_confirmed_at` through `confirmWalletBalance(id, at)`. `components/wallets/wallet-form.tsx` renders `/wallet/new` and `/wallet/edit?id=`; Alerts from reads the wallet row through `lib/wallets/wallet-link.ts`. `confirmDeleteWallet` (`lib/wallets/delete-wallet.ts`) confirms in the sheet, and the wallet page closes itself once its wallet is gone. `.maestro/flows/account/wallet-*.yaml` drive the page, the correction, and the form.

**Sheets:** `components/ui/sheet/sheet-host.tsx` is mounted once in `app/_layout.tsx` after the root Stack and renders the one open sheet from `lib/sheet/sheet-store.ts`. Call `await openSheet({ kind, ... })` and act on the result; `null` means dismissed. The kinds and their bodies live in `components/sheets/` (`category-picker-sheet.tsx`, `option-picker-sheet.tsx` for wallet, currency, wallet type, date, and Alerts from, `confirm-sheet.tsx`); `components/ui/sheet/sheet.tsx` is the surface (scrim, spring, drag, keyboard via `useAnimatedKeyboard`, Android back in the host). Category tiles come from `toCategoryTiles` in `lib/sheet/category-tiles.ts` and their labels from `budgetNote` in `lib/finance/budget-note.ts`. Open a sheet from a `components/ui/picker-field.tsx`. There are no `.android.tsx` sheet splits and no `@expo/ui` dependency. `.maestro/flows/components/sheets.yaml` drives the sheets on the e2e build, and `rows-hold-menu.yaml` beside it drives rows, the hold menu, and the delete confirm.

Appearance: Profile → Appearance (`light` default; `system` follows the device). Persisted in MMKV via `lib/theme/preference.ts`.

Main currency: Profile → Main currency opens the `currency` sheet; `components/profile/main-currency-row.tsx` sets `profilePreferences$` at once and writes `preferences.currency` through `updateProfilePreferences`, restoring the old value if the write fails. `useMainCurrency()` reads it.

Export data: Profile → Export data builds a CSV with `transactionsCsv` (`lib/transactions/export-csv.ts`) and writes `moni-YYYY-MM-DD.csv` to a folder the user picks through Android's file picker (`Directory.pickDirectoryAsync`).

Sign in: `app/(auth)/login.tsx` holds sign in and account creation; `lib/auth/login-mode.ts` is the pure reducer that maps Supabase errors to the page's states (`Invalid login credentials` → wrong details, network failures → offline, a closed Google sheet → Google did not finish). The `handle_new_user` trigger creates the profile row on sign-up. `.maestro/subflows/sign-in.yaml` signs in with `E2E_EMAIL` and `E2E_PASSWORD`.

Default wallet: synced in `profiles.preferences.default_wallet_id`; cached locally for background AI. Text/receipt proposals use this wallet when AI cannot infer one (receipts always). Profile has no picker for it since v2. Currency on proposals follows the selected wallet — change wallet in review to change currency.

**Home tab:** horizontal compact wallet strip (~2.5 cards visible); the header plus opens wallet creation. The view is driven by narrow finance selectors, so each wallet card observes only its wallet and balance; tap a card to open it. **Budget tab:** wallet chips multi-select the wallets included in spending, trend, and activity charts; **All wallets** resets the aggregate view. Mixed currencies: totals, pies, and history remain separate per currency.

## AI

**Moni chat** (`app/chat.tsx`, a pushed page opened by the Moni button on Home and Activity and by the chooser's Ask Moni): conversational back-and-forth — log transactions (text, inline receipt camera, hold-to-talk), ask finance questions (heuristic routing → `/v1/chat/analyze` with a snapshot from `lib/ai/snapshot/` plus per-currency facts from `lib/ai/facts/`: liquid balance, recurring series and payday from `recurring.ts`, forecast and afford check from `forecast.ts`; user confirm/dismiss verdicts sync via `recurringOverrides$` and `lib/supabase/recurring-overrides.ts`, and saving a balance on the wallet page stamps `balance_confirmed_at`; `components/wallets/confirm-balance-card.tsx` at the top of the Wallets and Chat tabs asks the user to confirm stale in-use balances, driven by `useBalanceConfirmation` in `lib/wallets/balance-confirmation.ts` over `lib/ai/facts/confirmation.ts`, with confirm via `confirmWalletBalance` and a 7-day "Not now" in the preferences MMKV), session history in MMKV (`lib/ai/chat/`) with 24h idle expiry; only answered analysis turns go back to the model as context. Hold-to-talk uses `expo-speech-recognition` with shared on-device options in `lib/speech/speech-recognition.ts` (continuous, punctuation, finance biasing).

**Extraction queue** (background): MMKV queue → background processor → Go backend → `lib/ai/routine.ts` (a notification matching an auto-add rule in `autoAddRules$`, or a routine one, → `transactions` with `metadata.ai_suggested`, shown as "Auto"; everything else → `proposed_transactions` with category prefilled) → review UI. Possible duplicates (`lib/ai/duplicates.ts`, derived on read) never auto-add; a notification completing an own-wallet transfer pair is combined automatically (`combineIntoTransfer`); otherwise the review screen offers merge / combine-into-transfer via `resolveDuplicate` in `lib/supabase/proposed-transactions.ts`. Manual entries dated today keep their real time. `createTransaction` takes a required source, stored as `metadata.source`; approved proposals map `notification` / `text` / `image` to Notification / Moni / Camera. **Silent capture entry points** (not shown in Chat thread): the + chooser's Scan a receipt (`app/scan/receipt.tsx`, a transparent root route that runs the ML Kit scan in `lib/receipts/scan-receipt.ts`) and Say it (`app/scan/listen.tsx`, narration). **Review UI:** `components/proposal/proposal-summary-sheet.tsx` shows a minimal popup for each pending proposal (Approve / Decline / "Edit details"); full form at `app/proposal/[id].tsx`. Later (`laterProposedTransaction`) hides a proposal until `snoozed_until`; approve and decline stamp `approved` / `rejected` before the soft delete. **Android notifications:** link a banking app per wallet; only linked apps are queued, and an identical re-post within 2 minutes is stored but not queued (`lib/notifications/notification-repeat.core.js`). Each capture log entry stores its status (`capture-status.core.js`): set on arrival in `index.js`, after extraction in the background processor, and on approve / decline; an added entry also stores its `transactionId`. `/capture-log` reads them; `/capture-sources` lists phone access, location per linked app (`updateWallet` `recordLocation`) and the auto-add rules (Ask again → `deleteAutoAddRule`). An app whose linked wallets all have `record_location` off gets no location snapshot. Merchant names (`merchantAliases$`) resolve through `merchantName` in `lib/finance/merchant-name.ts`; `/merchants` names codes (`nameMerchant`) and forgets them (`forgetMerchantName`), and `useMerchantNames` lists what is left to name. Details: [docs/AI.md](../../docs/AI.md).

**Receipt scan** (`lib/receipts/scan-receipt.ts`): **Android only** — the `/scan/receipt` route and the Chat camera call `scanAndNormalizeReceipt()` (no visible intermediate screen); `modules/moni-document-scanner` launches Google ML Kit (`SCANNER_MODE_FULL`). Post-scan: `normalize-scan.ts` copies to cache and caps longest edge at 1024px → `queueReceiptImage()` for extraction. On iOS the route shows an availability message instead. Requires Google Play Services; **rebuild dev client** after native module changes (`npx expo run:android`).

**Budget tab** (`app/(tabs)/budget.tsx`): charts, tables, and budget data only — no AI analysis.

**Categories, budgets, and debts:** categories use a fixed Material Design icon/pastel pairing for system presets; custom categories use the curated picker, can be archived, and have no subcategories. Category pickers read the synced category table directly so presets are available immediately after sync; creating one from a form returns it as the active selection. The category sheet shows each tile's month so far in the selected wallet's currency ("RM100 left", "RM20 over", or what was spent), with recent categories first. Monthly category caps are scoped per currency and calculated from categorized expense transactions in the user's finance timezone. The budget list (`/budget/list`) shows only existing caps; its dedicated form opens the same category sheet. Person-to-person debt activity creates linked cash transactions but is excluded from spending/category analysis; the Budget tab shows cash, receivables, payables, and net worth separately by currency. The Debts tab reads `summarizeDebts` (`lib/finance/debt-summary.ts`) through `components/debts/use-debts.ts`: main-currency debts only, open ones sorted by due date, Coming up for every open debt with a due date, and settled or written-off ones under Settled. Debt pages live in `app/debt/`: `[id]` (in-place name and note through `updateDebt`, a page-local `DueDateSheet`, settle as a full repayment into the debt's wallet, write off, all with Undo), `new` (Record a debt; a person with an open debt the same way gets principal added to it), and `amount` (the debt-local amount page; `mode=repay|more` writes an activity, `mode=new` hands the amount back to `new` through `components/debts/new-debt-draft.ts`). Remind hands a message to React Native `Share` and marks "Reminded today" in the preferences MMKV.

**Transfers:** manual entry via New Transaction → Transfer, or natural language in Chat (e.g. "transfer 200 from Cash to Maybank"). Transfers are excluded from income/expense analytics.

## Tests

```bash
pnpm --filter moni test:notification-detection   # 1000-case prefilter suite
pnpm --filter moni test:notification-routing     # wallet candidate routing (no LLM)
pnpm --filter moni test                          # scripts/lint tests (node --test), then Jest
pnpm --filter moni lint:copy                     # glossary words and money/date formats in UI copy
pnpm --filter moni lint:test-ids                 # every Pressable, TextInput, Switch has a tid() testID
pnpm --filter moni bench:chat                    # offline chat grounding bench (fixture ledgers, 31 cases)
pnpm --filter moni bench:chat:live               # same questions through the real backend + model (needs apps/backend/.env)
npx tsc --noEmit                                 # typecheck (run in apps/mobile)
```

CI runs `pnpm test` (Jest here, `go test ./...` in the backend) in the `Tests` job, and both lints in `Lint and typecheck`.

- **Copy lint.** `scripts/lint/check-copy.mjs` reads JSX text and the strings that flow into JSX children or a display prop (`title`, `label`, `accessibilityLabel`, and other names ending in label, title, text, placeholder, hint, message, description, caption, heading, or alt) under `app/` and `components/`. It tests them against `copy-rules.mjs`, the words and formats `docs/redesign/glossary.md` bans.
- **testID lint.** `scripts/lint/check-test-ids.mjs` requires `testID={tid(...)}` from `lib/test-ids.ts`, or a pass-through of the wrapper's own `testID` prop, on each JSX element in its `CONTROLS` list.
- **Ratchet lists.** `copy-allow.txt` and `test-id-exempt.txt` hold the v1 hits and files that may stay until rebuilt. A check fails on a new hit, on a listed entry that no longer hits (`stale`), and on a list longer than its copy at `LINT_BASE_REF` (CI sets it to the PR base or the previous push; it defaults to `origin/main`). After you fix or delete v1 code, regenerate a list with `--write`, for example `pnpm --filter moni lint:test-ids --write`, and commit it.
