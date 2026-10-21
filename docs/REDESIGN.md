# Redesign v2: implementation handoff

The mobile app is being rebuilt to the **Redesign v2** design on the claude.ai design canvas. This file tells an implementing agent where the design lives, which boards are final, what to ignore, what the code does not support yet, and what is still the owner's call.

**Status (21 Oct 2026):** design rounds 1–6 done (canvas version 150). Foundations F1 landed: v2 colour tokens (light and dark), Funnel Display through `components/ui/text`, spring tokens in `lib/motion/tokens.ts`, and the haptics table in `lib/haptics`. F2 landed: `Press`, `Button`, `HeaderIconButton`, `MoniButton`, and `Page` replace the v1 chrome, so every screen has its v2 header and every button is a v2 capsule. F3 landed: one sheet host (`openSheet` in `lib/sheet/sheet-store.ts`) opens every picker and destructive confirm as a Cream sheet. F4 landed: v2 transaction rows with the hold menu, navigation rows, chips, segmented controls, the one progress bar, status pills, the toast host, the sync banner, skeletons, and empty tiles. Screen bodies still use the v1 layouts and components from [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), now in v2 colours and type.

## Authority

1. **The canvas boards** listed under "Build these" are the spec for screens, layout and copy.
2. [`redesign/tokens.md`](redesign/tokens.md): measured values (colour, type, chrome, components, charts, motion, haptics).
3. [`redesign/glossary.md`](redesign/glossary.md): the words to use and the banned words.
4. [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) describes v1. Its principles (approval before any AI write, native currencies, evidence, accessibility) still hold. Where its visual rules conflict with v2 (system font, the tab set, the spring menu, the palette details), v2 wins. Rewrite the matching section of `DESIGN_SYSTEM.md` when you ship a v2 screen.

If a board contradicts these docs, the board is newer only if it was published after this file; otherwise flag it to the owner instead of guessing.

## Reading the canvas

- URL: https://claude.ai/artifact/8d2qRf6GtxCL9bog1E41fF ("Moni Mobile Design System", a Design-type artifact). Pages: **Redesign** (the spec), Competitor research (Mobbin), Inspiration (Figma), Design system (current app), Take-home.
- Index: `project/canvas.json` lists every board with page, position, size and title. Rows are the `title1` notes; a board sits 260 px below its row title.
- Boards: `project/<Board>.dc.html`. Read one with the Artifact tool, `action: "read"`, the URL and `path: "project/V2H-Home.dc.html"`. Never web-fetch it.
- A board is markup plus a `class Component extends DCLogic` script. Its data (amounts, rows, states) sits in `renderVals()`; `{{holes}}` in the markup read from it. Interactive boards hold states (editing, sheets open, toggles) in `this.state`, and tweak props in `data-props` pick variants (for example `V2P-BudgetDetail` category, `V2P-DebtDetail` person).
- Numbers on boards are **sample data**: user Kai, now Wed 14 Oct 2026 2:06 pm, wallets Maybank RM2,281.80 / Touch 'n Go RM86.40 / Cash RM63.60 / Wise $120. Never hardcode them; the app computes its own.
- On the owner's machine there is a local mirror with tools: `~/.local/share/moni-canvas/` holds `artifact-files/project/` (board sources), `renders/r6/all/*.png` (screenshots of every board), `tools/render/render.sh` (renders a board to PNG through headless Edge; `README.md` beside it), `tools/lint_terms.py` (banned-word check) and `v2/sample-data.json`. The canvas is the source; the mirror can be stale.
- Owner feedback arrives as canvas comment threads. Read them with the ArtifactComments tool before starting an area; open threads override this file.

## Build these (Redesign page, rows titled "v2 · …")

| Area | Boards | Defines | Replaces in `apps/mobile/app` |
| --- | --- | --- | --- |
| Foundations | `V2F-Components`, `V2F-Bible`, `V2F-Nav`, `V2F-Motion`, `V2F-Feel`, `V2F-States`, `V2F-Dark`, `CG-Guide` | Components, rules, nav bar, motion and haptics (Feel is a live spring demo), loading/empty/error/offline kit, dark mode, engineering guide | `global.css`, `components/ui/*`, `components/nav/*` |
| Home | `V2H-Home`, `V2H-HomeFirstRun` | Net worth, spent card with Pace / Daily toggle, ask box, review block, recent, check-in | `(tabs)/index.tsx` |
| Moni chat | `V2H-MoniPlacement`, `V2H-AskMoni`, `V2H-AskMoniAnswer`, `V2H-ChatHistory` | Chat as a pushed page (no tab bar), its three entry points, draft capture cards, generative answer cards, one thread per day | `chat.tsx` (a pushed page since N1) |
| Account | `V2H-Profile`, `V2H-Wallets`, `V2H-WalletDetail`, `V2H-WalletForm`, `V2H-Merchants`, `V2H-Permissions`, `V2H-Login` | Profile (main currency, appearance), wallets, balance correction, merchant names, capture sources (per-app location), sign-in | `profile.tsx`, `wallet/*`, `notifications/*` (settings parts), `(auth)/*` |
| Activity | `V2A-Activity`, `V2A-ActivityMenu`, `V2A-TxnDetail`, `V2A-TxnDetailEdit`, `V2A-CategoryPick`, `V2A-Categories`, `V2A-CategoryForm`, `V2A-NotifLog`, `V2A-NotifLogEmpty` | Activity tab (Spending / Balance chart, search, hold menu), transaction detail with in-place edits, categories, capture log | `(tabs)/activity.tsx`, `transaction/*`, `categories/*`, `notifications/index.tsx` |
| Capture | `V2A-Capture`, `V2A-CaptureFlow-VA`, `V2A-CaptureType`, `V2A-CaptureTypeDuplicate`, `V2A-CaptureSay`, `V2A-CaptureSayHeard`, `V2A-CaptureSayDenied`, `V2A-CaptureScan`, `V2A-CaptureScanAdded`, `V2A-CaptureScanFailed` | + chooser sheet, the chosen flow (sheet, then a page slides in from the right), type / voice / live-scan pages | `components/nav/capture-chooser.tsx`, `transaction/new.tsx`, `scan/*` |
| Review | `XA-Review`, `XA-Notification` (`XA-Compare` is the record of the decision) | The review card deck (swipe right Approve, left Not mine, down Later), approving from the Android notification | `proposal/[id].tsx` |
| Budget tab | `V2P-InsightsMonth` (tab root, title "Budget"), `V2P-InsightsCalendar`, `V2P-BudgetDetail`, `V2P-InsightsStates`, `V2P-BudgetEdit`, `V2P-BillDetail`, `V2P-AmountPage`, `V2P-PlanStates` | Month chart and calendar, budgets (rings), bills list, the one category page, editing caps, bills, the amount page for new money | `(tabs)/budget.tsx`, `budget/*` |
| Debts tab | `V2P-Debts`, `V2P-DebtDetail`, `V2P-DebtNew`, `V2P-DebtsEmpty`, `V2P-DebtSettle` | Debts as a tab: net position, coming up, people, per-person page, record a debt, settle | `(tabs)/debts.tsx`, `debt/*` |
| Map | `XM-Places`, `XM-Detail`, `XM-Empty` | Where you spend (fixed place card), place detail, empty and location-off | `heatmap.tsx` |
| Type | `XB-Type` | Decision record: Funnel Display for everything | font loading |

Board titles on the canvas say which variant is the chosen one. Ignore any board not in this table.

## Ignore

- Every row titled **"Archive · …"**: rejected v2 options (Home B–F, Insights B/C, capture flows VB/VC, Sort/Stream/Deck, Heat/Hex/Map, Plan, Category detail, MoveMoney, AmountSheet, BudgetTab, Activity/TxnDetail VB, AskMoni VB) and the v1 / style exploration rows (`Hi-*`, `Flow-Map`, `StA*`, `StB*`, `StC*`).
- **Brand explorations** (`XB-Characters`, `XB-CharacterLogo`, `XB-Languages`, `XB-Brand1`): the logo and mascot are not decided. Do not add a mascot or a new logo to the app.
- **Research** page (`R-*`, `D-*`): background only.
- **Inspiration**, **Design system (current app)** and **Take-home** pages: not part of v2.

## Target navigation

- Tabs: Home · Activity · ( + ) · Budget · Debts. The + opens the chooser sheet: Type it, Scan a receipt, Say it, Ask Moni. Choosing one slides its page in from the right; the sheet covers the tab bar.
- Moni chat is a pushed page reached from the Home ask box, the Moni header button (Home, Activity) and the + sheet. It reopens on today's thread.
- Profile is pushed from the Home avatar. Review is pushed from Home's review block, notifications and chat. The map is pushed from the Budget tab.
- Budget and Debts are separate tabs; debts never appear on the Budget tab.

## Rules that apply to every screen

Values are in `redesign/tokens.md`, words in `redesign/glossary.md`.

- **One main currency** on focused pages (Home, Activity, Budget, Debts, charts). Other currencies only on Wallets and their own wallet page. Never convert or sum across currencies.
- **One progress style:** full Coral with "RMx over" when over budget; never a pace tick or a bar past 100%.
- **Editing:** existing values edit in place with the system keyboard; new money uses the amount page; fixed sets (category, wallet, date) use picker sheets.
- **Rows:** transaction rows have no chevron and no ⋯; press feedback plus hold for Edit category / Change wallet / Delete. Delete is also a visible button on the detail page.
- **Visible affordances:** anything tappable looks tappable; long press and swipes only duplicate visible controls.
- **First screen:** the key content of every tab root sits above y 744 on a 390 × 844 phone.
- **No clutter:** no restating sentences, no status chips that repeat a number, no chart readout rows.
- **Approvals:** AI never writes to the ledger without Approve; vocabulary Approve · Not mine · Later everywhere.

## Code gaps (designed but not supported yet)

Checked 21 Oct 2026. These need data or product work before their screens can be built; add Zod schemas in `packages/types` and migrations first (see [`DATABASE.md`](DATABASE.md)).

| Designed | Today | Needed |
| --- | --- | --- |
| Bills list with due dates, "Add a bill" | `selectUpcomingBills` (`lib/finance/bills.ts`) lists this month's bills from detected recurring series and confirmed `recurring_overrides` | Screens (B1, B2) |
| "Don't ask about similar" | `auto_add_rules` (`createAutoAddRule`, `deleteAutoAddRule` for "Ask again"); `matchRoutine` applies a matching rule before the history heuristic | The Review action (R1), list and "Ask again" in Capture sources (K3) |
| Source tile (Manual, Voice, Moni, Notification, Camera) | `transactions.metadata.source`, written at every creation site; older rows have none and read as Manual | Voice and live-camera approvals write their own source (C2); the tile (A2) |
| Merchant names | `merchant_aliases` (`nameMerchant`); `merchantName(raw, aliases)` in `lib/finance/merchant-name.ts` resolves a row's name | Rows on Home, Activity, wallet pages and Review read names through it; the Merchant names page (K3) |
| Balance correction | `createBalanceCorrection` writes the "Balance adjustment" with `analysisExcluded` and `metadata.kind: balance_correction` | UI per `V2H-WalletDetail` (K2) |
| Main currency | `preferences.currency` (default `MYR`), read by `useMainCurrency()`, set from Profile (K1) | Focused-page filtering |
| Per-app "Record where I spend" | `wallets.record_location`; the headless listener skips the location snapshot for an app whose linked wallets all have it off | The Capture sources toggle (K3) |
| Capture log statuses | Stored on each capture log entry (`capturedNotificationStatusSchema`, `lib/notifications/capture-status.core.js`); older entries read as Ignored | The Capture log (K3) reads the stored status; v2 wording |
| Review history, Not mine / Later | `laterProposedTransaction` snoozes (`later`, `snoozed_until`); approve and Not mine stamp `approved` / `rejected` before the soft delete | The card deck (R1); whether to show history stays an owner decision |
| Chat generative cards, draft cards, one thread per day | Message kinds: text, image, status, clarify chips | New message kinds and renderers |

Already supported: debts with repayments and write-off, monthly category budgets, multi-currency wallets, balance check-in, proposal review, routine auto-add, notification linking per wallet, transaction location, receipt scan (ML Kit), voice capture, custom categories, the spending map (`react-native-maps`), SVG charts, Funnel Display (400/600/700), the six motion tokens, and the haptics table.

## Open owner decisions (do not decide alone)

- Should "left this month" subtract debts due (RM40 to Mei) now that debts have their own tab? Boards subtract and label it.
- Budget tab: rings (current) or bars for budgets.
- Brand: logo and mascot (Sprig and Miso are the latest candidates); whether reactions exist and can be turned off; a logging streak needs a day count the app does not keep.
- Home: keep both the ask box and the Moni header button?
- Debts hero tiles filter in place or open a filtered page; whether Nudge uses the Android share sheet or Moni sends it.
- Review: is approved / not-mine history kept?

Implement the boards as drawn while these are open, and list the affected spots in your PR.

## Suggested build order

1. Foundations: tokens in `global.css` and `hooks/use-theme-tokens.ts`, Funnel Display, spring and haptic constants, page chrome, list rows, sheets, in-place edit, progress, chart primitives.
2. Navigation shell: the five-slot bar, the + chooser, Moni chat as a pushed route, Debts as a tab, Insights renamed Budget.
3. Home and Activity with their charts; transaction detail with in-place edits.
4. Capture pages (type, voice, live scan) and Review.
5. Budget tab, category page, bills; Debts tab.
6. Account: profile, wallets, balance correction, capture sources, capture log.
7. Data gaps from the table above, each with its schema change first.
8. Map, dark mode, states kit coverage.

Each step ends in a working app on Android (the dev-client flow in [`apps/mobile/README.md`](../apps/mobile/README.md)) and a PR that updates this file's status line, `DESIGN_SYSTEM.md` and `apps/mobile/README.md` for what shipped.
