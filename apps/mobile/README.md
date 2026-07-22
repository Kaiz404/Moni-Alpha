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

## Map

| Path                              | Role                                                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                            | expo-router: `(auth)`, `(tabs)` (Wallets / Summary / Chat / Profile), root Stack features (`wallet`, `transaction`, `proposal`, `categories`, `budget`, `debt`, `scan`, `notifications`, `debug`, `heatmap`)                        |
| `components/`                     | Domain UI (`ui/`, `nav/`, `providers/`, `auth/`, `wallets/`, `budgets/`, `summary/`, `chat/`, `profile/`, `transaction/`, `proposal/`, `scan/`, `insights/`, `debug/`, `receipt/`) — keep screens thin; no co-location under `app/` |
| `lib/store/`                      | Legend-State synced observables — persisted source rows and command write targets                                                                                                                                                   |
| `lib/finance/`                    | Non-persisted normalized finance projection, exact minor-unit helpers, integrity repair, and cached Legend selectors for cards, charts, lists, budgets, debts, heatmap, and AI snapshots                                            |
| `lib/supabase/`                   | Supabase client (publishable key) + CRUD helpers over the store; profile preferences                                                                                                                                                |
| `lib/auth/`                       | Auth context (email/password + native Google Sign-In)                                                                                                                                                                               |
| `lib/mmkv/`                       | MMKV instances: auth session, store cache, upload queue, UI preferences (theme, default wallet)                                                                                                                                     |
| `lib/theme/`                      | Theme preference ↔ Uniwind (`light` / `dark` / `system`)                                                                                                                                                                            |
| `lib/wallets/`                    | Default wallet preference (`profiles.preferences.default_wallet_id`, MMKV cache) and proposal wallet/currency resolution for AI                                                                                                     |
| `lib/ai/`                         | Processing queue, background processor, AI client (HTTP ↔ Go backend, mock fallback)                                                                                                                                                |
| `lib/notifications/`              | Prefilter / package helpers: `*.core.js` (headless + Node tests) + thin `*.ts` re-exports; linked-app MMKV cache; curated Android-app metadata preloads only after notification access is enabled via `moni-android-apps`             |
| `lib/receipts/`                   | ML Kit scan normalization, local image save, Storage upload queue                                                                                                                                                                   |
| `lib/speech/`                     | Shared on-device speech recognition options, permissions, offline model prep                                                                                                                                                        |
| `lib/transactions/`               | Transaction helpers: location prefetch for quick-add and ephemeral draft state on the new-transaction screen                                                                                                                        |
| `global.css`                      | Uniwind semantic tokens (warm surfaces, mint anchor, states, categories, light/dark) — implementation of [`docs/DESIGN_SYSTEM.md`](../../docs/DESIGN_SYSTEM.md)                                                                     |
| `constants/wallet-card-styles.ts` | Curated solid card-color presets for wallets (`wallets.card_style_id`) — append here to add a new style                                                                                                                             |
| `index.js`                        | Android headless notification listener (registered before expo-router; requires `*.core.js`)                                                                                                                                        |

**Routes (short URLs):** `/categories/...`, `/budget/...`, `/debts`, `/debt/...`, `/notifications`, `/debug`, `/heatmap`, `/wallet/...`, `/transaction/...`, `/proposal/[id]`, `/scan/...`. Shared feature screens sit on the root Stack (not per-tab stacks). Tabs use a custom JS tab bar + FAB (not NativeTabs).

## Theming

[`docs/DESIGN_SYSTEM.md`](../../docs/DESIGN_SYSTEM.md) is the visual source of truth. Tokens are CSS-first in `global.css`; prefer semantic classes (`bg-canvas`, `bg-card`, `text-foreground`, `text-muted`, state/category tokens) and shared UI helpers under `components/ui/` (`BrandHeader`, `ScreenShell`, `Surface`, `FormField`, `IconAction`, `PrimaryButton`, `SolidWalletCard`). `Surface` and `SolidWalletCard` use the native `react-native-fast-squircle` view for major grouped surfaces; use the default 0.65 smoothing for cards and 0.75 only for feature-sized wallet or summary panels. For an expressive standalone panel, choose a low-tint `Surface` tone (`aqua`, `lilac`, `peach`, `lemon`, or `tray`) instead of adding a decorative border. For native APIs that need a color string, use `useThemeTokens()`. Change semantic tokens in `global.css` only — do not hardcode hex in screens.

Use `IconSymbol` for app icons. Material Design Icons are the default; set `family` to use Ionicons, Feather, or Font Awesome 6 when required. Titles and section headings stand alone; do not add subtitles beneath them.

Wallet cards render `SolidWalletCard` with clean, Figma-aligned pastel fills driven by `wallet.cardStyleId` looked up in `constants/wallet-card-styles.ts`; the wallet forms use the same solid fills and set `wallet.color` to the style's flat swatch hex for charts/legends. Cards do not use a grain texture overlay.

**Modal pickers:** use the shared picker sheet convention in [`docs/DESIGN_SYSTEM.md`](../../docs/DESIGN_SYSTEM.md#710-modal-pickers-and-sheets): one sheet at a time, explicit close plus native dismissal, card-style 56pt selection rows, and no auto-dismiss after a selection. Every sheet uses the fixed primary confirmation action; its scroll body reserves footer space. Android Expo UI sheets with a scrollable React Native body use a bounded `Column` and weighted `RNHostView`.

Appearance: Profile → Appearance (`light` default; `system` follows the device). Persisted in MMKV via `lib/theme/preference.ts`.

Default wallet: Profile → Default wallet. Synced in `profiles.preferences.default_wallet_id`; cached locally for background AI. Text/receipt proposals use this wallet when AI cannot infer one (receipts always). Currency on proposals follows the selected wallet — change wallet in review to change currency.

**Wallets tab (home):** horizontal compact wallet strip (~2.5 cards visible); the header plus opens wallet creation. The view is driven by narrow finance selectors, so each wallet card observes only its wallet and balance; tap a card to open it. **Insights:** wallet chips multi-select the wallets included in spending, trend, and activity charts; **All wallets** resets the aggregate view. Mixed currencies: totals, pies, and history remain separate per currency.

## AI

**Chat tab** (`app/(tabs)/chat.tsx`): conversational back-and-forth — log transactions (text, inline receipt camera, hold-to-talk), ask finance questions (heuristic routing → `/v1/chat/analyze`), session history in MMKV (`lib/ai/chat/`) with rolling context window and 24h idle expiry. Hold-to-talk uses `expo-speech-recognition` with shared on-device options in `lib/speech/speech-recognition.ts` (continuous, punctuation, finance biasing).

**Extraction queue** (background): MMKV queue → background processor → Go backend → `proposed_transactions` → review UI. **Silent capture entry points** (not shown in Chat thread): floating tab-bar button — tap launches ML Kit receipt scan in-place (`lib/receipts/scan-receipt.ts`), long-press opens `app/scan/listen.tsx` (narration). **Review UI:** `components/proposal/proposal-summary-sheet.tsx` shows a minimal popup for each pending proposal (Approve / Decline / "Edit details"); full form at `app/proposal/[id].tsx`. **Android notifications:** link a banking app per wallet; only linked apps are queued. Details: [docs/AI.md](../../docs/AI.md).

**Receipt scan** (`lib/receipts/scan-receipt.ts`): **Android only** — FAB and Chat camera call `scanAndNormalizeReceipt()` directly (no intermediate screen); `modules/moni-document-scanner` launches Google ML Kit (`SCANNER_MODE_FULL`). Post-scan: `normalize-scan.ts` copies to cache and caps longest edge at 1024px → `queueReceiptImage()` for extraction. iOS uses `/scan/receipt` as a transparent fallback route. Requires Google Play Services; **rebuild dev client** after native module changes (`npx expo run:android`).

**Summary tab:** charts, tables, and budget data only — no AI analysis.

**Categories, budgets, and debts:** categories use a fixed Material Design icon/pastel pairing for system presets; custom categories use the curated picker, can be archived, and have no subcategories. Category pickers read the synced category table directly so presets are available immediately after sync; creating one from a form returns it as the active selection. In New Transaction, a category with a cap shows its current-month usage for the selected wallet's currency. Monthly category caps are scoped per currency and calculated from categorized expense transactions in the user's finance timezone. The Budget screen lists only existing caps; its dedicated form uses recent categories before the full bottom-sheet picker. Person-to-person debt activity creates linked cash transactions but is excluded from spending/category analysis; Summary shows cash, receivables, payables, and net worth separately by currency.

**Transfers:** manual entry via New Transaction → Transfer, or natural language in Chat (e.g. "transfer 200 from Cash to Maybank"). Transfers are excluded from income/expense analytics.

## Tests

```bash
pnpm --filter moni test:notification-detection   # 1000-case prefilter suite
pnpm --filter moni test:notification-routing     # wallet candidate routing (no LLM)
pnpm --filter moni test                          # finance unit/reactivity tests
npx tsc --noEmit                                 # typecheck (run in apps/mobile)
```
