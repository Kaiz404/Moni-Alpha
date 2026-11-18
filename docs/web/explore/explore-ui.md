# Web app UI layer: what to share with mobile, and how

Read-only exploration, 19 Nov 2026. Repo paths are relative to `/home/kaiz404/projects/moni`; canvas paths are relative to `~/.local/share/moni-canvas/web-r1`.

## Recommendation in one paragraph

Take option (a), with one shared headless piece from (d). Put the design tokens, the chart math, the formatting and copy helpers, and the brand art in workspace packages. Then write the React views twice: React Native views stay in `apps/mobile`, and DOM views go in `apps/web`. Do not ship the Expo app through react-native-web as the phone layout under 700 px. The responsive spec says that crossing 700 px keeps the route, the half-typed form and the chat thread, and only "swaps the layout around them". A Next.js app beside an Expo-web bundle can't do that. Two React trees with two data layers would also each have to boot. The rest of this note gives the evidence. The interfaces that pay are the token file, the chart geometry, the formatters and the mascot SVG strings. Very few React components behave the same on desktop. They only look the same.

Note: mobile styles with **Uniwind**, not NativeWind (`apps/mobile/metro.config.js` `withUniwindConfig`; `.cursor/rules/mobile-expo.mdc` "Tailwind via Uniwind — not NativeWind"). There is no `tailwind.config.*`. Tokens are CSS-first in `apps/mobile/global.css`.

---

## 1. Inventory: platform-agnostic vs RN-bound

### Platform-agnostic today (pure TS, or one import away from it)

| What | Where | Notes |
| --- | --- | --- |
| Colour roles, light + dark | `apps/mobile/global.css` `@layer theme` `@variant light/dark` (≈95 roles each) | Source of truth. `scripts/tokens/gen-theme-tokens.mjs` parses it into `constants/theme-tokens.generated.ts` (`themeTokenNames`, `lightThemeTokens`, `darkThemeTokens`); `lint:tokens` checks staleness. The CSS custom properties can be used as they are on the web. |
| Role names → JS object | `apps/mobile/hooks/use-theme-tokens.ts` `buildThemeTokens` | The mapping is pure. Only `useResolvedThemeTokens` (Uniwind's `useCSSVariable`) is RN-bound. |
| Radii, spacing, font families | `global.css` `@theme` (`--radius-card` 26, `--spacing-screen` 20, `--font-display*`) | The font family names are Expo font keys (`FunnelDisplay_600SemiBold`). The web needs the CSS family `Funnel Display` with `font-weight`. |
| Type scale | `docs/redesign/tokens.md` § Type; encoded in `apps/mobile/components/ui/text.tsx` variants | The numbers are agnostic. The `Text` React component is RN. |
| Springs | `apps/mobile/lib/motion/tokens.ts` (`press`, `value`, `control`, `sheet`, `throw`, `FLING_COMMIT_THRESHOLD`, `projectedPosition`) | The values are pure. It imports only the *type* `WithSpringConfig` from Reanimated. Web's CSS `linear()` curves are sampled from the same numbers in `boards/W2-Motion.gen.py` `spring()`/`linear_css()` and saved by hand to `curves.txt`. |
| Category catalogue | `packages/types/src/category.ts` (`categoryIconNames`, `customCategoryColors`, `legacyColorMap`) | Already shared. The preset colour pairings (Groceries = Mint …) are in `docs/redesign/tokens.md` and the DB presets. The kit has its own `CAT` dict in `webkit.py`. |
| Glyph colour on a fill | `apps/mobile/lib/theme/glyph-on.ts` | Pure WCAG luminance. |
| Chart geometry | `components/charts/pace-geometry.ts` (pure; `'worklet'` directives are inert strings off Reanimated), `components/charts/spend-geometry.ts` (pure, **but type-imports `./scrub` and `./zoom-axes`, which are RN files**), `lib/finance/flow-geometry.ts`, `components/budget/ring-geometry.ts` | Outputs are numbers and SVG path `d` strings. These render as they are in a DOM `<path d>`. |
| Chart scales/paths | `components/charts/zoom.ts`: `frameFor`, `xAt`, `yAt`, `uAt`, `linePath`, `areaPath`, `barBox`, `barsPath`, `growAt` are pure | The same file holds `useZoom` (Reanimated), so it imports `react-native-reanimated` at the top. It needs a split. |
| Scrub picking | `components/charts/scrub.tsx`: `scrubPoints`, `nearestPoint`, `readerStep` are pure | The same file holds `useChartScrub` (Gesture Handler) and `Tip`. It needs a split. On the web the same picking drives the hover tooltip and the arrow keys. |
| Ranges and ticks | `lib/finance/chart-range.ts`, `lib/finance/chart-ticks.ts` (tick table in tokens.md § Charts) | Pure. Tested in `lib/finance/__tests__/chart-ticks.test.ts`. |
| Series builders | `lib/finance/spend-history.ts`, `balance-history.ts`, `activity-series.ts`, `flow-series.ts`, `budget-month.ts`, `debt-summary.ts`, `calendar-heat.ts`, `bills.ts`, `activity-filter.ts`, `ledger.ts`, `adapters.ts` | They depend only on `@repo/types` and `lib/dates`. `flow-series` also pulls `lib/reports/report`, and `bills` pulls `lib/ai/facts/*`, so check those before moving them. |
| Formatting | `lib/finance/format-money.ts` (`RM45.90`, U+2212), `lib/dates/day-label.ts`, `lib/dates/relative-time.ts`, `lib/dates/local-date-input.ts`, `lib/finance/budget-note.ts` ("RM20 over"), `lib/amount/amount-input.ts`, `lib/finance/merchant-name.ts` (pulls `lib/ai/routine`) | Glossary formats. The web must print the same strings. |
| Copy rules | `docs/redesign/glossary.md`; `apps/mobile/scripts/lint/copy-rules.mjs` (`termsIn`) | The rules module is shareable. `check-copy.mjs` walks only `app/` and `components/` under mobile. Copy itself is inline JSX on both sides and is not centralised. |
| Review deck decisions | `lib/proposals/review-card-state.ts` (`ReviewDecision`, `DECISION_SIDE`, `swipeRoom`, swipe engage/commit rules) | Pure. It imports `projectedPosition` from motion tokens. The swipe half is touch-only. The decision vocabulary is what the web's A · X · L inbox needs. |
| In-place edit draft | `components/ui/in-place-field.tsx` `parseAmountDraft`, `initialDraft`, `bind`, `lowerFirst` (lines 230–300) | These are pure, but they live inside a 715-line RN file. |
| Toast queue | `lib/toast/toast-store.ts` (`useSyncExternalStore`) | Agnostic, except that it type-imports `IconSymbolName` from the RN icon file. |
| Mascot art | `components/brand/mascot-art.generated.ts` (`MASCOT_MOODS`, `MASCOT_ART` as SVG strings per variant × mood) | These are plain SVG strings. `export.py` even splits `paint-order` for react-native-svg, and that output is still valid DOM SVG. |
| Icon names | MDI kebab names everywhere (`IconSymbol name="pencil-outline"`); `packages/types` `categoryIconNames` | No screen uses a family other than MDI (`grep family=` finds nothing in `app/` and `components/`). |

### RN-bound (rewrite for the DOM, don't share)

| What | Where | Bound to |
| --- | --- | --- |
| Every `components/ui/*` view | `press.tsx`, `button.tsx`, `chip.tsx`, `segmented.tsx` (365 lines of glide physics), `toggle.tsx`, `nav-row.tsx`, `list-card.tsx`, `transaction-row.tsx`, `hold-menu.tsx` (442), `in-place-field.tsx` (715), `page.tsx`, `toast.tsx`, `sheet/sheet.tsx` (495), `search-field.tsx`, `picker-field.tsx`, `skeleton.tsx`, `rise-in.tsx`, `list-motion.tsx` | `View`/`Text`/`Pressable`, Reanimated, Gesture Handler, `react-native-safe-area-context`, `expo-router`, `lib/haptics` |
| Text | `components/ui/text.tsx` | `@expo-google-fonts/funnel-display`, RN `Text` |
| Icons | `components/ui/icon-symbol.tsx`, `icon-symbol.ios.tsx`, `lib/transactions/icon.ts` | `@react-native-vector-icons/*`, `expo-symbols` |
| Charts (render) | `components/charts/spend-chart.tsx`, `zoom-axes.tsx`, `components/wallets/balance-plot.tsx` (Skia); `pace-chart.tsx`, `budget/ring.tsx`, `budget/spend-ring.tsx`, `activity/flow-card.tsx`, `categories/category-spark.tsx` (react-native-svg) | Skia, react-native-svg, Reanimated shared values, Gesture Handler scrub |
| Theme plumbing | `lib/theme/preference.ts`, `reveal.ts` | Uniwind, MMKV, `moni-theme-reveal` (native circle reveal) |
| Brand views | `components/brand/mascot.tsx`, `wordmark.tsx`, `lockup.tsx` | `SvgXml`, Reanimated `pop` |
| Sheets host | `components/ui/sheet/sheet-host.tsx`, `lib/sheet/sheet-store.ts` (imports RN `Keyboard`) | Desktop replaces sheets with popovers and panes (`W2-Responsive` `TR`). |
| Styling | Uniwind `className` + `@variant` | Web uses Tailwind v4 or plain CSS on the same variable names. |

**Store-bound, so neither shareable nor UI:** `lib/finance/selectors.ts`, `projection.ts`, `integrity.ts`, `main-currency.ts` and `lib/proposals/review-actions.ts` read Legend-State `@/lib/store`. The web rule says TanStack Query (`.cursor/rules/web-nextjs.mdc`). Any shared hook that reaches a store fails on the web.

### Drift that already exists (why one token source matters)

- The kit and the app use different names for different colours. `webkit.py` `T["mint"] = "#A9DDB5"` is the app's `--color-block-mint`. The app's `--color-mint` is `#6fd08c`, the category Mint. Kit `lilac #C9B6F0` is the app's `block-lilac`/`moni-glyph`, and the app's `--color-lilac` is `#a98cf5`. A web dev who copies kit names onto the app's CSS variables gets the wrong colour, and no error tells them.
- `curves.txt` is a hand-saved output of a Python simulation in `W2-Motion.gen.py`. Nothing ties it to `lib/motion/tokens.ts`.
- `catart.py` exists twice and is identical today: `apps/mobile/scripts/brand/catart.py` and `~/.local/share/moni-canvas/brand-r12/brand/catart.py` (imported by `webkit.py`).
- `apps/web/src/app/globals.css` (433 lines) is the old Geist/white scaffold. Nothing in it is reused.

---

## 2. Options

The deletion test asks: if you delete the shared module, does its complexity come back in two or more callers? A shared module that passes this test earns its place. The one-vs-two-adapters rule says that a seam with one adapter is hypothetical, and a seam with two adapters is real.

| | (a) Tokens + logic shared, views twice | (b) react-native-web / Expo for web | (c) Cross-platform kit (Tamagui, Solito, gluestack, NativeWind v4 web) | (d) Headless hooks / state machines + platform views |
| --- | --- | --- | --- | --- |
| **Effort** | Low–medium. Three packages (tokens, chart math, format), mostly `git mv` and splitting 3 files. The DOM views are new work, and the web needs them anyway. | High. `apps/mobile` has 44 files on native-only modules (MMKV, Nitro scanner, Android apps, theme reveal, maps, background actions) and 23 `Platform.OS` checks. Skia on the web needs CanvasKit WASM (~3 MB). The desktop shell, tables, popovers and Ctrl K would be built in RN primitives, or a second app is needed. | Very high. The mobile UI is mature on Uniwind + Reanimated + hand-tuned gestures (`segmented.tsx` glide, `deck.tsx` 1217 lines). Moving to a kit means rewriting mobile first, for no mobile gain. | Medium, applied selectively. Only worth it where the *state* is the same and only the input differs. |
| **Risk** | Low. Each view is native to its platform. The risk is look-drift between the two views, and the shared tokens plus board review contain it. | High. (1) The 700 px swap must keep the route and form state. Two apps (Next + Expo-web) can't do that without a reload. (2) RN-web output is div soup: hover, focus-visible, `<table>`, right-click and selection all fight it. (3) Next 16 + RN-web + Reanimated web + Uniwind web is an untested stack in this repo. | High. Lock-in, plus a second styling system next to Uniwind. Solito only shares navigation, so screens still differ by platform. | Medium. A hook that hides Reanimated shared values or Legend-State reads leaks the platform. Keep each one a pure reducer or model. |
| **What is shared** | Colour roles, radii, spacing, type scale, springs (as numbers and as CSS `linear()`), category catalogue, chart geometry, paths, ticks and scrub picking, money and date formatting, budget notes, copy rules, mascot SVGs, icon names | In theory, every RN view. In practice, the phone layout only, plus logic. | Primitives and tokens | Decision models (review deck A/X/L ↔ swipe), edit-draft parsing, paging (`lib/finance/paged.ts`), toast queue |
| **What is written twice** | Every React view: `Press`/`Button`/`Chip`/`Segmented`/`Toggle`/`ListCard`/`TransactionRow`/charts/`Mascot`/`Text`/`Icon`. Each DOM version is small: CSS does the press, hover and transitions that took Reanimated code on mobile. | The desktop layouts, in any case | Gesture-heavy views, still | The views |
| **How the phone layout (< 700 px) is served** | By the same Next app: one route tree, with layout chosen by viewport (`matchMedia('(max-width: 699px), (max-height: 499px)')`), and phone-layout DOM views styled after mobile v2 (W2-Responsive "phone layout: mobile v2 markup, redrawn with the kit"). Route and store survive a resize because one tree owns them. | An Expo-web bundle at the same URLs. It is viable only if the *whole* web app is Expo-web (dropping Next), because otherwise the swap is a navigation between apps. Even then, the native-only capture paths need web stubs. | One kit tree with responsive props | As (a) |
| **Deletion test** | Passes for tokens, chart math, formatters and brand: delete any one and its values or logic come back in both apps. Fails for a shared `Button` React component: delete it and each app's version is shorter alone. | n/a | n/a | Passes for review decisions and the amount draft. Fails for segmented glide (web is click + arrow keys) and hold menu (web is right-click + hover ⋯). |
| **Adapters** | Tokens: Uniwind CSS + generated TS (mobile), CSS variables (web), plus the canvas kit, so three adapters and a real seam. Chart marks: Skia/RN-SVG (mobile) and DOM SVG (web), so two adapters and a real seam. | One adapter per platform, through RN-web. That is a hypothetical seam over desktop needs that RN does not model. | — | Review model: swipe (mobile) and keys/buttons (web), so a real seam. Segmented glide: one adapter, so hypothetical. |

**Skia vs SVG.** Mobile draws the zooming spend chart and balance plot in Skia (`spend-chart.tsx`, `zoom-axes.tsx`, `balance-plot.tsx`) for UI-thread animation. The others use react-native-svg. On the web, use DOM SVG: the paths are already SVG `d` strings (`zoom.ts` `linePath`/`barsPath`). The kit animates them with CSS `linear()` transitions and `stroke-dashoffset` draws (`webkit.py` `.val`, `.draw`, `.grow`). For range zoom, interpolate `from/to/low/high` with a JS spring at rAF, then re-run the shared `linePath`. Mobile's `useZoom` does the same on a shared value. Don't ship CanvasKit to the web for this.

---

## 3. React components: same look, same behaviour?

| React component | Share? | Why |
| --- | --- | --- |
| Category bubble (42 circle, solid colour, `glyphOn` glyph) | Share the **math** (colour, glyph colour, icon name) only | The view is 5 lines on each platform. |
| `TransactionRow` (66 tall) | Write twice, share `lib/transactions/row.ts` (the row model: title, meta, amount, icon) and `format-money` | Desktop adds hover fill, a ⋯ on the pointed row, right-click, a checkbox and J/K focus. Mobile has hold-to-menu with bloom (`hold-menu.tsx`). Only the look is the same. |
| `Segmented` | Write twice, share nothing but tokens | Mobile is a gesture glide with magnet and stretch physics. The web is buttons with `aria-pressed` and a pill on `control` (`.seg` in `webkit.py`). |
| `Press` / `Button` / `Chip` / `HeaderIconButton` | Write twice | On the web these are CSS classes (`.pr`, `.btn-ink`, `.ib`, `.chip`). Mobile needs Reanimated for scale 0.97. |
| `Sheet`, `HoldMenu`, `PickerField` | No | Desktop uses popovers, panes and right-click (`W2-Responsive` `TR`). The **phone layout** on the web needs a DOM bottom sheet anyway. |
| `InPlaceField` | Share the draft model (`parseAmountDraft`, bind and validation, the Saved/undo contract) | Same rule on both (one field at a time, phone keyboard, save/cancel), but the motion and focus code differ. |
| Review card | Share the card **view-model** (deck.tsx `displayName`, `walletLook`, `duplicateText`, `countedOnceText`, `pairOffer`) and `review-card-state` decisions | The desktop is an inbox with A · X · L. The phone layout is a swipe deck that needs pointer-event physics on the web. |
| Charts (Pace, Daily, Balance, Ring, Flow) | Share geometry, ticks and scrub picking; write renderers twice | Same marks and same callout shape. Input differs: finger scrub vs hover tooltip (`W2-Features` `BENDS`). |
| `Mascot` / `MoniGlyph` / `Wordmark` | Share the art; write a 10-line `<Mascot>` for each | The SVG strings are the deep part. |
| `ProgressBar`, `StatusPill`, `EmptyTile`, `Skeleton`, `Toast` | Write twice; share copy (`budgetNote`) and toast queue | These are thin. |

---

## 4. Mascot and icons

**Mascot.** Move `catart.py` + `export.py` + `rasterize.mjs` into `packages/brand`, and make `catart.py` the one copy (the canvas kit should import it from the repo, not from `brand-r12`). `export.py` writes `packages/brand/src/mascot-art.generated.ts`, which exports SVG strings plus `MASCOT_MOODS`. Mobile renders the strings with `SvgXml` (as now). The web inlines them (a server React component that returns `<span dangerouslySetInnerHTML>`, fine for build-time trusted art) so `currentColor` and `mono` keep working. Add web targets to `rasterize.mjs`: `favicon.ico`/`icon.svg`/`apple-icon.png`/OG image into `apps/web/src/app/` (the Next.js file-based metadata icons). Then `pnpm --filter @repo/brand assets` refreshes both apps. The `pop` animation is per platform (Reanimated `springs.control` vs CSS `.pop`).

**MDI.** The name set is the shared part, not the glyph source. Mobile keeps `@react-native-vector-icons/material-design-icons` (a font). On the web, use `@mdi/js` (SVG path per icon, tree-shaken, no 1 MB font), behind an `<Icon name="pencil-outline">` that maps kebab names to `mdiPencilOutline`. The canvas kit uses the MDI webfont with `mdi.json` codepoints, which is fine for boards but too heavy for the app. Export a `MoniIconName` type from the shared package: a union of the names actually used (generated by scanning `name="…"` in both apps, plus `categoryIconNames` from `@repo/types`). Pin one MDI version in the generator so a name that exists on mobile can't be missing on the web. `lib/transactions/icon.ts` (`resolveTransactionIcon`) moves to the shared package once it stops importing the RN icon type.

---

## 5. Deepening candidates

### 1. `packages/design-tokens`: one token file, three adapters

- **Files:** `apps/mobile/global.css` (`@layer theme`, `@theme`), `apps/mobile/scripts/tokens/gen-theme-tokens.mjs`, `apps/mobile/constants/theme-tokens.generated.ts`, `apps/mobile/hooks/use-theme-tokens.ts` (`buildThemeTokens`), `apps/mobile/lib/motion/tokens.ts`, `~/.local/share/moni-canvas/web-r1/webkit.py` (`T`, `DARK`, `CAT`), `curves.txt`, `boards/W2-Motion.gen.py` (`spring`, `linear_css`), `apps/web/src/app/globals.css`.
- **Problem:** token values live in four places with drifting names (kit `mint` ≠ app `mint`). Web spring curves are a hand-copied simulation output.
- **Deep interface:** one `tokens.ts` holds the colour roles (light and dark), radii, spacing, type scale, springs and the category set. One generator writes: (1) the `@layer theme` and `@theme` blocks Uniwind reads, (2) a `tokens.css` for the web with the same `--color-*` names under `:root` / `[data-theme=dark]`, and with `--ease-press|value|control|sheet|throw: linear(…)` plus `--dur-*` computed from the spring numbers, (3) the TS object `useThemeTokens` returns, (4) a JSON the canvas kit loads. Callers learn one name per role.
- **Benefits:** leverage, because a palette change is one edit for every surface. Locality, because the spring → `linear()` maths lives next to the spring numbers.
- **Test impact:** the existing `lint:tokens --check` moves to the package and covers all outputs. Add one test that samples the generated `linear()` against an analytic spring (settle within 1 %). Mobile's jest tests are unchanged, because the generated TS keeps its shape.

### 2. `packages/charts`: chart marks as data

- **Files:** `apps/mobile/components/charts/pace-geometry.ts`, `spend-geometry.ts`, `zoom.ts` (pure half), `scrub.tsx` (pure half: `scrubPoints`, `nearestPoint`, `readerStep`), `zoom-axes.tsx` (types `AxisRow`, `TickMark`), `lib/finance/chart-range.ts`, `chart-ticks.ts`, `flow-geometry.ts`, `components/budget/ring-geometry.ts`.
- **Problem:** the maths is pure, but it is tangled with Reanimated and Gesture Handler files through imports (`spend-geometry` → `./scrub`, `./zoom-axes`; `zoom.ts` imports Reanimated at the top). The web can't import it without RN.
- **Deep interface:** "Give me a series, a range, a size and today, and I return the marks." The marks are line and area `d` strings, bar boxes, axis rows with tone, tick marks with labels, the callout reading and accessibility text, and `pick(u)` for the scrub/hover index. Renderers only paint. Mobile paints with Skia or RN-SVG and animates frames on shared values. The web paints with DOM SVG and animates with rAF springs or CSS.
- **Benefits:** two adapters, so it is a real seam. The glossary's chart rules (ticks table, "RM58" pace label, Coral above pace, axis not from 0 on balance) are in one place.
- **Test impact:** `components/charts/__tests__/spend-geometry.test.ts`, `zoom.test.ts`, `scrub.test.ts` (pure parts) and `lib/finance/__tests__/chart-ticks.test.ts` move with the code and run under plain node, which is faster than jest-expo. `pace-chart.test.tsx` stays in mobile.

### 3. `packages/format`: the glossary's printed forms

- **Files:** `lib/finance/format-money.ts`, `lib/dates/day-label.ts`, `relative-time.ts`, `local-date-input.ts`, `lib/finance/budget-note.ts`, `lib/amount/amount-input.ts`, `lib/theme/glyph-on.ts`, `lib/transactions/row.ts` + `icon.ts`, `apps/mobile/scripts/lint/copy-rules.mjs`.
- **Problem:** "RM20 over", U+2212 minus, `Wed 14 Oct` and the banned-words list must print identically on the web. Copying them guarantees drift. The kit already re-implements `rm()` in Python.
- **Deep interface:** `formatMoney`, `formatSignedMoney`, `dayLabel`, `budgetNote`, `rowModel(transaction) → {title, meta, amount, icon, tone}`, plus `termsIn(text)` for the copy lint. Small surface, many rules behind it.
- **Benefits:** the deletion test passes clearly. Run the copy lint over `apps/web/src` too.
- **Test impact:** the existing `format-money.test.ts`, `budget-month.test.ts` and day-label tests move. Add `apps/web` to `check-copy.mjs` roots.

### 4. Review decision model (headless, shared)

- **Files:** `lib/proposals/review-card-state.ts`; deck view-model helpers inside `components/review/deck.tsx` (`displayName`, `walletLook`, `duplicateText`, `countedOnceText`, `pairOffer`, `reconcile`); `lib/proposals/capture-source.ts`, `review-status.ts`.
- **Problem:** the card's model (what it says, which decisions are allowed, "Approve needs a wallet", undo direction) is buried in a 1217-line RN file. The web's inbox with A · X · L and the web phone layout's swipe deck both need it.
- **Deep interface:** `reviewCard(proposal, lookups, edits) → card model` and `decide(card, decision) → allowed | needs-wallet`, with no store and no gestures. The swipe engage rule (`swipeRoom`, the 16/8 lean, fling ≥ 800/s) stays a pure function that pointer events on the web and Gesture Handler on mobile both feed.
- **Benefits:** two input adapters (keys and swipes), so it is a real seam. Keyboard and swipe can't disagree about what Not mine does.
- **Test impact:** card-model tests become pure unit tests. `review-actions.ts` (store writes) stays per app, because the data layers differ.

### 5. `packages/brand`: one Cat Pebble pipeline

- **Files:** `apps/mobile/scripts/brand/catart.py`, `export.py`, `rasterize.mjs`, `components/brand/mascot-art.generated.ts`, canvas `brand-r12/brand/catart.py` (duplicate), `webkit.py` `moni()`/`cat()`.
- **Problem:** two copies of the locked art module, and the web favicon set is not generated at all.
- **Deep interface:** `MASCOT_ART[variant][mood]` SVG strings and `MASCOT_MOODS`, plus one `assets` command that writes both apps' raster icons. Each app keeps a thin `<Mascot>`.
- **Benefits:** the mascot direction (no tail, coin at chest, never in the wordmark) is locked in one place. The canvas kit reads the same module.
- **Test impact:** `components/brand/__tests__` keep testing the mobile view. Add a `--check` that fails when the generated TS is stale.

### Not a candidate

`Segmented`, `HoldMenu`, `Sheet`, `Page` and `Press` are not candidates. Each has one adapter's worth of behaviour per platform, so a shared interface over them would be a hypothetical seam. They fail the deletion test, because each side is simpler alone.

## 6. Order of work

1. Tokens package (unblocks every web view and fixes the kit's naming drift).
2. Format package and charts package (split `zoom.ts` and `scrub.tsx` first, then move).
3. Brand package.
4. Review model, when the web Review inbox is built.

Each step is a `git mv` plus import rewrite (`@/lib/...` → `@repo/...`). Mobile tests prove each move. `apps/web/next.config.js` `transpilePackages` gains each package.
