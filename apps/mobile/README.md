# Moni — mobile app

Primary Moni client: Expo SDK 54 + expo-router, offline-first via Legend-State observables synced directly to Supabase (MMKV persistence).

## Develop

```bash
pnpm install                # repo root
pnpm --filter moni dev      # Metro / Expo (terminal 1)
```

Env: copy `.env.example` to `.env` (Supabase publishable key, AI backend URL, Google web client ID — see [docs/SETUP.md](../../docs/SETUP.md)).

This app uses native modules (camera, notifications, Google Sign-In) — **Expo Go will not work**. Use a dev client:

| Build | Command |
| --- | --- |
| **Local (WSL / macOS / Linux)** | `cd apps/mobile && npx expo run:android` |
| **EAS cloud** | `pnpm --filter moni android` |

Rebuild the dev client when you change `app.json` plugins, native deps, or `modules/moni-android-apps`. JS-only changes just need Metro + reload.

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

**Metro over USB:** if the dev client cannot reach Metro (`failed to connect … port 8081`), run `adb reverse tcp:8081 tcp:8081` before opening the app.

Do not mix Windows and WSL `expo prebuild` / Gradle — `android/build/generated/autolinking/autolinking.json` must use Linux paths (`/home/...`), not `C:\...`.

## Map

| Path | Role |
| --- | --- |
| `app/` | expo-router routes: `(auth)`, `(tabs)` (Wallets / Summary / Chat / Profile), `(routes)` (wallet, transaction, budget, proposal, scan, notifications, debug) |
| `lib/store/` | Legend-State synced observables — the data layer |
| `lib/supabase/` | Supabase client (publishable key) + CRUD helpers over the store; profile preferences |
| `lib/auth/` | Auth context (email/password + native Google Sign-In) |
| `lib/mmkv/` | MMKV instances: auth session, store cache, upload queue, UI preferences (theme, default wallet) |
| `lib/theme/` | Theme preference ↔ Uniwind (`light` / `dark` / `system`) |
| `lib/wallets/` | Default wallet preference (`profiles.preferences.default_wallet_id`, MMKV cache), proposal wallet/currency resolution for AI, homepage wallet aggregation helpers (`home-aggregation.ts`) |
| `lib/ai/` | Processing queue, background processor, AI client (HTTP ↔ Go backend, mock fallback) |
| `lib/notifications/` | Prefilter / package helpers: `*.core.js` (headless + Node tests) + thin `*.ts` re-exports; linked-app MMKV cache; `moni-android-apps` |
| `lib/receipts/` | Receipt quad detection, perspective-crop + document-scan preprocessing, local image save, Storage upload queue |
| `lib/transactions/draft-extras.ts` | Ephemeral (non-persisted) hand-off of merchant/description/location between the quick-add and "More details" transaction screens |
| `global.css` | Uniwind design tokens (brand + light/dark semantic colors) |
| `constants/wallet-card-styles.ts` | Curated gradient card presets for wallets (`wallets.card_style_id`) — append here to add a new style |
| `index.js` | Android headless notification listener (registered before expo-router; requires `*.core.js`) |

## Theming

Tokens are CSS-first in `global.css`. Prefer semantic classes (`bg-primary`, `text-foreground`, `bg-card`) and shared UI helpers under `components/ui/` (`BrandHeader`, `ScreenShell`, chips, `PrimaryButton`, `GradientCard`). For native APIs that need a color string, use `useThemeTokens()`. Change brand colors in `global.css` only — do not hardcode hex in screens.

Wallet cards render `GradientCard` (`expo-linear-gradient` + a grain texture overlay from `assets/images/grain.png`) driven by `wallet.cardStyleId` looked up in `constants/wallet-card-styles.ts`; the wallet forms let users pick a style, which also sets `wallet.color` to the style's flat swatch hex for charts/legends.

Appearance: Profile → Appearance (`light` default; `system` follows the device). Persisted in MMKV via `lib/theme/preference.ts`.

Default wallet: Profile → Default wallet. Synced in `profiles.preferences.default_wallet_id`; cached locally for background AI. Text/receipt proposals use this wallet when AI cannot infer one (receipts always). Currency on proposals follows the selected wallet — change wallet in review to change currency.

**Wallets tab (home):** horizontal compact wallet strip (~2.5 cards visible); **Add wallet** card at the end. Default view aggregates charts and recent transactions across all wallets (preloaded per-wallet cache). Tap a card to multi-select filter; **All wallets** chip resets to aggregated view. Top-right chevron on each card opens wallet edit (`/wallet/[id]`). Mixed currencies: amounts labeled per wallet currency; chart totals split per currency.

## AI

**Chat tab** (`app/(tabs)/chat.tsx`): conversational back-and-forth — log transactions (text, inline receipt camera, hold-to-talk), ask finance questions (heuristic routing → `/v1/chat/analyze`), session history in MMKV (`lib/ai/chat/`) with rolling context window and 24h idle expiry.

**Extraction queue** (background): MMKV queue → background processor → Go backend → `proposed_transactions` → review UI. **Silent capture entry points** (not shown in Chat thread): floating tab-bar button — tap opens `app/(routes)/scan/receipt.tsx` (live camera), long-press opens `app/(routes)/scan/listen.tsx` (narration). **Review UI:** `components/proposal-summary-sheet.tsx` shows a minimal popup for each pending proposal (Approve / Decline / "Edit details"); full form at `app/(routes)/proposal/[id].tsx`. **Android notifications:** link a banking app per wallet; only linked apps are queued. Details: [docs/AI.md](../../docs/AI.md).

**Receipt camera** (`components/receipt/receipt-camera.tsx`, shared by the FAB scan screen and the chat inline camera): react-native-vision-camera **v4** (not v5 — see below) + `react-native-fast-opencv` frame processor detects the receipt quad live; a `react-native-svg` overlay draws brand corner brackets and gates the shutter on ~500ms of stable detection. On capture (or gallery pick), the same quad-detection + perspective-crop + grayscale/contrast "document scan" filter runs in a `react-native-worklets-core` worklet, resized to a single ≤1024px JPEG. No quad found → hard reject, nothing is queued or uploaded. Android `minSdkVersion` 26 (HardwareBuffers). **Native deps changed → rebuild the dev client** (`npx expo run:android`).

**Summary tab:** charts, tables, and budget data only — no AI analysis.

**Transfers:** manual entry via New Transaction → Transfer, or natural language in Chat (e.g. "transfer 200 from Cash to Maybank"). Transfers are excluded from income/expense analytics.

## Tests

```bash
pnpm --filter moni test:notification-detection   # 1000-case prefilter suite
pnpm --filter moni test:notification-routing     # wallet candidate routing (no LLM)
npx tsc --noEmit                                 # typecheck (run in apps/mobile)
```
