# Redesign v2: implementation handoff

The mobile app is being rebuilt to the **Redesign v2** design on the claude.ai design canvas. This file tells an implementing agent where the design lives, which boards are final, what to ignore, what the code does not support yet, and what is still the owner's call.

**Status (21 Oct 2026):** every v2 screen in "Build these" is built on `main`: foundations (F1–F4), navigation (N1), Home and Moni chat, Activity, Capture and Review, the Budget tab, Debts, Account, and the Map. The integration pass (X1) joined them up: typed routes are checked in CI, chat drafts use the Review deck's actions, Activity's safe to spend a day comes from the Budget month, the wallet page has its balance line and **Use as default**, bill reminders are scheduled, scanned receipt photos are kept, and Home's recent rows have the hold menu. Device verification on the phone is pending the operator. The owner decisions D1–D11 below are still open; each screen builds its default.

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
| Review | `XA-Review`, `XA-Notification` (`XA-Compare` is the record of the decision) | The review card deck (swipe right Approve, left Not mine, down Later), approving from the Android notification | `app/review.tsx` (R1) |
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

Checked 21 Oct 2026. Every row is built; new data work adds Zod schemas in `packages/types` and migrations first (see [`DATABASE.md`](DATABASE.md)).

| Designed | Built on | Status |
| --- | --- | --- |
| Bills list with due dates, "Add a bill" | `selectUpcomingBills` (`lib/finance/bills.ts`); bill pages edit `recurring_overrides`; Remind schedules through `syncBillReminders` | Done |
| "Don't ask about similar" | `auto_add_rules`; `matchRoutine` applies a rule before the history heuristic | Done: Review (R1), list and "Ask again" in Capture sources (K3) |
| Source tile (Manual, Voice, Moni, Notification, Camera) | `transactions.metadata.source`; older rows read as Manual | Done (A2) |
| Merchant names | `merchantName(raw, aliases)` in `lib/finance/merchant-name.ts` | Done on Home, Activity, wallet pages and Review |
| Main currency | `preferences.currency`, `useMainCurrency()`, set from Profile | Done on every focused page |
| Review history, Not mine / Later | `later`, `snoozed_until`; Approve and Not mine stamp `reviewed_at` and keep the row (`20261025000000_review_history.sql`) | Done: deck (R1), Recently reviewed (G4) |
| Chat generative cards, draft cards, one thread per day | Message kinds in `lib/ai/chat/messages.ts` | Done (H2) |

Already supported: debts with repayments and write-off, monthly category budgets, multi-currency wallets, balance check-in, proposal review, routine auto-add, notification linking per wallet, transaction location, receipt scan (ML Kit), voice capture, custom categories, the spending map (`react-native-maps`), SVG charts, Funnel Display (400/600/700), the six motion tokens, the haptics table, balance correction (`correctBalance`), location from notifications per banking app, and stored capture log statuses.

## Open owner decisions (do not decide alone)

The app builds the default for each. [`redesign/PLAN.md`](redesign/PLAN.md) ("Operator actions and owner decisions") gives the full wording.

- D1. "Left this month" subtracts bills and debts due, labelled "after bills and RM40 to Mei" (Home, Budget, and Activity's safe to spend a day).
- D2. Budgets show as rings on the Budget tab.
- D3. No logo, mascot, reactions, or logging streak.
- D4. Home keeps both the ask box and the Moni header button.
- D5. Debts hero tiles filter in place; Remind opens the Android share sheet.
- D6. Decided 25 Oct 2026: Review keeps its history. "Recently reviewed" lists 30 days; rows older than 90 days are soft-deleted.
- D7. The Review deck shows a blank card at scale 0.96 under the top card.
- D8. Motion has six tokens: five springs and `drag`.
- D9. Decided 25 Oct 2026: the "Edit" link beside Budgets is gone (canvas thread 8cd5c2da). Rings open their category page, where the budget edits in place; the Budgets heading's chevron opens `V2P-BudgetEdit`.
- D10. The dev-only `debug/` route stays, reachable from Profile in `__DEV__` builds.
- D11. Scan a receipt uses the ML Kit document scanner instead of the in-app camera that `V2A-CaptureScan` draws.

## Where the app differs from a board

The screen tracks reported these differences in their handoffs. Each waits for the owner to accept it or ask for the board.

- Map: the range control offers This week, the month, and last month where the board has a custom range; the empty state's action is **Add an expense**.
- Debts: recording a debt with no wallet, and debt reminders.
- The + chooser: the sheet sits over the incoming page while it slides in.
- Budget: the Budgets heading has a routing chevron into Edit budgets, which the board does not draw (D9 removed the Edit link, and the chevron keeps the monthly total reachable).
- Budget calendar: the day cut-offs.
- Scan a receipt: the ML Kit scanner (D11).
- Wallet page: **Use as default** is an addition. It sets the wallet captures fall back to, which v1 set on Profile.
- Review: **Recently reviewed** is an addition with no board, designed in the `XA-Review` and `V2F-Components` style (D6). It lists the last 30 days of Approve and Not mine by day under All caught up, and folds into one control under the deck buttons while captures wait. The All caught up card keeps its sentence and drops the session rows that the board draws, because the list below shows them. **Added for you** shows only under All caught up and Nothing to review, because the deck page does not scroll below its buttons.

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
