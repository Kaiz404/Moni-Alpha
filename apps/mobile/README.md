# Moni — mobile app

Primary Moni client: Expo SDK 54 + expo-router, offline-first via Legend-State observables synced directly to Supabase (MMKV persistence).

## Develop

```bash
pnpm install                # repo root
pnpm --filter moni dev      # Metro / Expo
pnpm --filter moni android  # native dev client (required — Expo Go won't work)
```

Env: copy `.env.example` to `.env` (Supabase publishable key, AI backend URL, Google web client ID — see [docs/SETUP.md](../../docs/SETUP.md)).

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
| `lib/receipts/` | Local receipt image save + Storage upload queue |
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

**Chat tab** (`app/(tabs)/chat.tsx`): conversational back-and-forth — log transactions (text, inline `expo-camera`, hold-to-talk), ask finance questions (heuristic routing → `/v1/chat/analyze`), session history in MMKV (`lib/ai/chat/`) with rolling context window and 24h idle expiry.

**Extraction queue** (background): MMKV queue → background processor → Go backend → `proposed_transactions` → review UI. **Silent capture entry points** (not shown in Chat thread): floating tab-bar button — tap opens `app/(routes)/scan/receipt.tsx` (live camera), long-press opens `app/(routes)/scan/listen.tsx` (narration). **Review UI:** `components/proposal-summary-sheet.tsx` shows a minimal popup for each pending proposal (Approve / Decline / "Edit details"); full form at `app/(routes)/proposal/[id].tsx`. **Android notifications:** link a banking app per wallet; only linked apps are queued. Details: [docs/AI.md](../../docs/AI.md).

**Summary tab:** charts, tables, and budget data only — no AI analysis.

**Transfers:** manual entry via New Transaction → Transfer, or natural language in Chat (e.g. "transfer 200 from Cash to Maybank"). Transfers are excluded from income/expense analytics.

## Tests

```bash
pnpm --filter moni test:notification-detection   # 1000-case prefilter suite
pnpm --filter moni test:notification-routing     # wallet candidate routing (no LLM)
npx tsc --noEmit                                 # typecheck (run in apps/mobile)
```
