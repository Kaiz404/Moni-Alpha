# Redesign v2: implementation handoff

The mobile app is being rebuilt to the **Redesign v2** design on the claude.ai design canvas. This file tells an implementing agent where the design lives, which boards are final, what to ignore, what the code does not support yet, and what is still the owner's call.

**Status (2 Nov 2026):** every v2 screen in "Build these" is built, and the first real device runs have started on the owner's Redmi. They found and fixed a crash 31 s after launch, currencies cut to one letter by Realtime, a publicly readable balances view, and a build with no Maps key. The owner then redirected much of the design from the phone (Review with no buttons, Activity as a list, the Budget ring, the map card on Home, chart legends removed), and the canvas was updated to match on 2 Nov, version `1793552757-fa37`. Later rounds from the owner's phone (2 to 18 Nov: Review, Activity filters, transaction detail, wallets, Budget, Debts, Capture sources, the cat mascot, Say it's Start over) were synced back to the "Build these" boards on 18 Nov, version `1795001512-73c0`; boards still ahead of the app are listed in the area reports under `~/.local/share/moni-canvas/sync-1118/reports/`. The full flow suite still has to pass on the final build. Details: [`redesign/HANDOFF-device-validation.md`](redesign/HANDOFF-device-validation.md). On 12 Nov 2026 the owner picked the Current+ palette on the canvas (`Colour explorations` page): category bubbles solid with an Ink glyph, a sharper chart set, near-black dark with tonal blocks. It is applied to the Redesign boards, `tokens.md` § Colour, `global.css` and the stored category catalogue (migration `20261112000000`).

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
| Moni chat | `V2H-MoniPlacement`, `V2H-AskMoni`, `V2H-AskMoniAnswer`, `V2H-ChatHistory`, `V2H-ChatEmpty` (A · Quiet) | Chat as a pushed page (no tab bar), its three entry points, draft capture cards, generative answer cards, one thread per day, the first open's greeting and starter cards | `chat.tsx` (a pushed page since N1) |
| Account | `V2H-Profile`, `V2H-Wallets`, `V2H-WalletDetail`, `V2H-WalletForm`, `V2H-Merchants`, `V2H-Permissions`, `V2H-Login`, `V2A-NotifLog`, `V2A-NotifLogEmpty` | Profile (main currency, appearance), wallets, balance correction, merchant names, capture sources, the capture log, sign-in | `profile.tsx`, `wallet/*`, `capture-log.tsx`, `notifications/*` (settings parts), `(auth)/*` |
| Activity | `V2A-Activity`, `V2A-ActivityMenu`, `V2A-TxnDetail`, `V2A-TxnDetailEdit`, `V2A-CategoryPick`, `V2A-Categories`, `V2A-CategoryForm` | Activity tab (date capsule, Spent against Money in, search, pages of 20, hold menu), transaction detail with in-place edits, categories | `(tabs)/activity.tsx`, `transaction/*`, `categories/*` |
| Capture | `V2A-Capture`, `V2A-CaptureFlow-VA`, `V2A-CaptureType`, `V2A-CaptureTypeDuplicate`, `V2A-CaptureSay`, `V2A-CaptureSayHeard`, `V2A-CaptureSayDenied`, `V2A-CaptureScan`, `V2A-CaptureScanAdded`, `V2A-CaptureScanFailed` | + chooser sheet, the chosen flow (sheet, then a page slides in from the right), type / voice / live-scan pages | `components/nav/capture-chooser.tsx`, `transaction/new.tsx`, `scan/*` |
| Review | `XA-Review`, `XA-Notification` (`XA-Compare` is the record of the decision) | The review card deck (swipe right Approve, left Not mine), approving from the Android notification | `app/review.tsx` (R1) |
| Budget tab | `V2P-InsightsMonth` (tab root, title "Budget"), `V2P-InsightsCalendar`, `V2P-BudgetDetail`, `V2P-InsightsStates`, `V2P-BudgetEdit`, `V2P-BillDetail`, `V2P-AmountPage`, `V2P-PlanStates` | Month chart and calendar, budgets (rings), bills list, the one category page, editing caps, bills, the amount page for new money | `(tabs)/budget.tsx`, `budget/*` |
| Debts tab | `V2P-Debts`, `V2P-DebtDetail`, `V2P-DebtNew`, `V2P-DebtsEmpty`, `V2P-DebtSettle` | Debts as a tab: net position, coming up, people, per-person page, record a debt, settle | `(tabs)/debts.tsx`, `debt/*` |
| Map | `XM-Places`, `XM-Detail`, `XM-Empty` | Where you spend (fixed place card), place detail, empty and location-off | `heatmap.tsx` |
| Type | `XB-Type` | Decision record: Funnel Display for everything | font loading |
| Brand | `XB-Brand9C`, `XB-Kit1-Guidelines`, `XB-Kit3-InApp` (`XB-Kit2-Assets` is marketing, not app) | Cat Pebble mascot, app icon, splash, notification icon, wordmark, and where the cat shows in the app (loud edges only, one cat per screen, no sparkles) | `components/brand/*`, `scripts/brand/*` (`pnpm --filter moni brand:assets`), `app.json` |

Board titles on the canvas say which variant is the chosen one. Ignore any board not in this table.

## Ignore

- The **Archive** page (since 18 Nov 2026) holds every rejected option. That covers the brand explorations that weren't picked (`XB-Characters`, `XB-CharacterLogo`, `XB-Languages`, `XB-Brand1`, `XB-Brand9`–`12`, `XB-Brand9B` and the older mascot rounds). It also has the rejected v2 options (Home B–F, Insights B/C, capture flows VB/VC, Sort/Stream/Deck, Heat/Hex/Map, Plan, Category detail, MoveMoney, AmountSheet, BudgetTab, Activity/TxnDetail VB, AskMoni VB) and the v1 and style exploration rows (`Hi-*`, `Flow-Map`, `StA*`, `StB*`, `StC*`).
- **Research** page (`R-*`, `D-*`): background only.
- **Inspiration**, **Design system (current app)** and **Take-home** pages: not part of v2.

## Target navigation

- Tabs: Home · Activity · ( + ) · Budget · Debts. The + opens the chooser sheet: Type it, Scan a receipt, Say it, Ask Moni. Choosing one slides its page in from the right; the sheet covers the tab bar.
- Moni chat is a pushed page reached from the Home ask box and the + sheet. It reopens on today's thread. Home and Activity have no Moni header button (owner's direction, 16 Nov 2026); their top right stays empty.
- Profile is pushed from the Home avatar. Review is pushed from Home's review block, notifications and chat. The map is pushed from Home's Where you spend card.
- Budget and Debts are separate tabs; debts never appear on the Budget tab.

## Rules that apply to every screen

Values are in `redesign/tokens.md`, words in `redesign/glossary.md`.

- **One main currency** on focused pages (Home, Activity, Budget, Debts, charts). Other currencies only on Wallets and their own wallet page. Never convert or sum across currencies.
- **One progress style:** full Coral with "RMx over" when over budget; never a pace tick or a bar past 100%.
- **Editing:** existing values edit in place with the system keyboard; new money uses the amount page; fixed sets (category, wallet, date) use picker sheets.
- **Compact pickers** (owner, 20 Nov 2026): a month, a year or a day is picked from a grid, a page at a time (12 months; a decade of years; a month of days, Sunday first), with arrows between pages. Never a long radio list. Birth month and year (#77) and the bill and debt due dates (#81) use it (`components/sheets/grid-picker-sheet.tsx`).
- **Rows:** transaction rows have no chevron and no ⋯; press feedback plus hold for Edit category / Change wallet / Delete. Delete is also a visible button on the detail page.
- **See all:** on a pushed page it pushes a deeper list (`/transactions`, 20 a page) under that page, so Back returns there; it never jumps to the Activity tab (owner's direction, 16 Nov 2026). This covers the bill page's history, a transaction's same-merchant row, the place page and Categories' income presets.
- **Visible affordances:** anything tappable looks tappable; long press and swipes only duplicate visible controls.
- **First screen:** the key content of every tab root sits above y 744 on a 390 × 844 phone.
- **No clutter:** no restating sentences, no status chips that repeat a number, no chart readout rows.
- **Short sheet copy** (owner, 20 Nov 2026): a sheet has its title and at most one short line under it. It does not list the screens a setting affects or add a footnote. The Main currency sheet reads "Main currency" over one line saying the whole app uses it (#75).
- **Confirmations are bottom sheets** (owner, 20 Nov 2026), destructive ones included. They are never pushed pages laid out as forms. Delete your account is a sheet that says what goes in one line (#74).
- **No middle-dot separators** (owner, 20 Nov 2026): never join two pieces of text with " · ". Put them in two places (the row's right side or a second line), set them apart with weight or colour, or use plain words. `tokens.md`, `DESIGN_SYSTEM.md` and the boards still describe "Category · Wallet" meta until #76 replaces it and adds a copy lint that fails on the dot.
- **No dot status chips** (owner, 20 Nov 2026): no capsule with a coloured dot and a label ("Looks like a duplicate", "RM500 unassigned"). Say the status through the title, text weight or colour, or an icon. The `standalone` `StatusPill` goes in #85.
- **Approvals:** AI writes to the ledger without Approve only for routine alerts, marked Auto and announced by the Added automatically notification on Android; vocabulary Approve and Not mine everywhere; a capture has no third answer (Later was removed, #69).

## Code gaps (designed but not supported yet)

Checked 21 Oct 2026. Every row is built; new data work adds Zod schemas in `packages/types` and migrations first (see [`DATABASE.md`](DATABASE.md)).

| Designed | Built on | Status |
| --- | --- | --- |
| Bills list with due dates, "Add a bill" | `selectUpcomingBills` (`@repo/core`); bill pages edit `recurring_overrides`; Remind schedules through `syncBillReminders` | Done |
| "Don't ask about similar" | `auto_add_rules`; `matchRoutine` applies a rule before the history heuristic | Done: Review (R1), list and "Ask again" in Capture sources (K3) |
| Source tile (Manual, Voice, Moni, Notification, Camera) | `transactions.metadata.source`; older rows read as Manual | Done (A2) |
| Merchant names | `merchantName(raw, aliases)` in `@repo/core` | Done on Home, Activity, wallet pages and Review |
| Main currency | `preferences.currency`, `useMainCurrency()`, set from Profile | Done on every focused page |
| Review history, Not mine | Approve and Not mine stamp `reviewed_at` and keep the row (`20261025000000_review_history.sql`); `later` is gone (`20261119130000_remove_review_later.sql`) | Done: deck (R1), Recently reviewed (G4) |
| Chat generative cards, draft cards, one thread per day | Message kinds in `lib/ai/chat/messages.ts` | Done (H2) |

Already supported: debts with repayments and write-off, monthly category budgets, multi-currency wallets, balance check-in, proposal review, routine auto-add, notification linking per wallet, transaction location, receipt scan (ML Kit), voice capture, custom categories, the spending map (`react-native-maps`), SVG and Skia charts, Funnel Display (400/600/700), the six motion tokens, the haptics table, balance correction (`correctBalance`), location from notifications per banking app, and stored capture log statuses.

## Open owner decisions (do not decide alone)

The app builds the default for each. [`redesign/PLAN.md`](redesign/PLAN.md) ("Operator actions and owner decisions") gives the full wording.

- D1. "Left this month" subtracts bills and debts due, labelled "after bills and RM40 to Mei" (Home, Budget, and Activity's safe to spend a day).
- D2. Budgets show as rings on the Budget tab.
- D3. No reactions and no logging streak. The brand (Cat Pebble, the wordmark, the icons) was locked on 18 Nov 2026 and is in the app, except onboarding, which the owner has not designed yet.
- D4. Decided 16 Nov 2026: Home keeps the ask box only; the Moni header button is gone from Home and Activity.
- D5. Debts hero tiles filter in place; Remind opens the Android share sheet.
- D6. Decided 25 Oct 2026: Review keeps its history. "Recently reviewed" lists 30 days; rows older than 90 days are soft-deleted.
- D7. Superseded by the owner on 1 Nov 2026: the next card shows real content under the top card, hidden until the top card moves.
- D8. Motion has six tokens: five springs and `drag`.
- D9. Decided 25 Oct 2026: the "Edit" link beside Budgets is gone (canvas thread 8cd5c2da). Rings open their category page, where the budget edits in place; the Budgets heading's chevron opens `V2P-BudgetEdit`.
- D10. The dev-only `debug/` route stays, reachable from Profile in `__DEV__` builds.
- D11. Scan a receipt uses the ML Kit document scanner instead of the in-app camera that `V2A-CaptureScan` draws.

## Where the app differs from a board

The screen tracks reported these differences in their handoffs. Each waits for the owner to accept it or ask for the board.

- Map: the range control offers Last 7 days, Last 30 days (the default) and All time, rolling windows ending today, where the board has a custom range (owner, 18 Nov 2026); the empty state's action is **Add an expense**.
- Map: a build with no Google Maps key has no board. It draws Sand where the map goes, with XM-Empty's capsule reading **Map unavailable** and no Fit button. The sheet and the place page keep working. The Budget tab's card is drawn art, so it needs no key.
- Debts: recording a debt with no wallet, and debt reminders.
- Budget: the Budgets heading has a routing chevron into Edit budgets, which the board does not draw (D9 removed the Edit link, and the chevron keeps the monthly total reachable).
- Budget calendar: the day cut-offs.
- Scan a receipt: the ML Kit scanner (D11). While Moni reads, the receipt is larger than the board draws it, with the cat on top reading along instead of beside it (owner, 19 Nov 2026, #52). The Added row also ends with the item count, which the board keeps to the check page.
- Type it (owner's direction, 12 Nov 2026): the fields are a 2 × 2 grid of half-width capture fields, Paid with (Into for income), Category, Date, Location, with Shop or note full width under it; a transfer keeps From and To in one row, then Date and Shop or note. **Location** has no board. It always shows for an expense or income and reads the place saved with the entry: the phone's position where permission is already granted, the wallet's app allows location and the entry is dated today, else **Add place**, or **Not saved** once the user turns it off. With a place set, an X in the chevron's slot takes it off the entry (owner's direction, 13 Nov 2026), so the place name keeps its width; the field then reads **Not saved** with its chevron back. A tap opens the **Choose a place** sheet (owner's direction, 13 Nov 2026): a map under a fixed centre pin with the shops Google draws and a my-location button, the selected place, search below them, then a list. With no query the list is **Near you**, the user's own places within about 500 m of the map's centre (nothing is asked of Google on open). Typing lists the user's places from the first letter, then Google's from the third (as you type, through the backend), then the phone's geocoder only when Google has nothing, and the map folds away while search is in use. Tapping a row, a shop on the map, or panning selects that place and moves the map to it; only **Confirm** saves it. A pick fills an empty Shop or note with a shop's name; **No place** saves none. Google's terms: Moni keeps a Google place ID, saves a Google place under the Shop or note words, never Google's name, and keeps Google's coordinates at most 30 days (the phone's position replaces them when the phone is within 150 m). The page never asks for location; the my-location button asks once, because the user pressed it.
- Type it: the place offer has no board. At a place the user has paid before, the Location field reads **Been here?** over the shop, with a Mint check that fills the shop, its usual category and the place. Tapping the field opens the sheet instead. It reads only the phone's position, so it follows the per-app location rule, and it goes once the user types a shop or picks a place.
- Scan a receipt and Say it, the check page (owner's direction, 12 Nov 2026): it reads like Type it. The amount edits in place, then the same capture-field grid (Paid with, Category, Date, Location) and the same Shop or note tile, where the boards have a Shop heading that edits in place. The receipt thumbnail sits beside the amount over "Receipt · 3 items", cropped to the middle of the photo, where the items and total sit (owner, 19 Nov 2026, #53). Approve saves the place as Type it does.
- Say it: when no run of the spoken words gives the amount Moni read, the amount hint falls back to "Moni heard RM9.80" instead of the board's "you said nine eighty".
- Say it, listening (owner's direction, 18 Nov 2026): a compact **Start over** button under the hint clears the words and restarts the mic, for a misspoken sentence. It has no board, and it stays inactive until Moni has heard something.
- Transaction detail: only notification rows captured by this build or later keep the bank alert, so older rows show the currency alone under the amount edit.
- States kit: the offline banner shows on the tab roots and the debt page that carry `SyncBanner`. Maestro cannot drive it over wireless adb, so Jest covers the state mapping.
- The category sheet's **Debt payment** opens the Debts tab, where the person is chosen; the board links the amount page, which needs a person first.
- Categories: an income preset pushes its rows for this month as a list under Categories. The board links every preset to the category page, which has no income view.
- Home and Capture sources: the quiet-source alert is an addition with no board. Home shows a Lemon card in the check-in card's style above Recent; Capture sources shows a `Banner` in the error tone, and the Alerts row on Edit wallet reads "Gone quiet". Each carries one fix, chosen by cause: Allow for the battery prompt, Autostart, Open settings, or Add it. Revoked access shows on Home only, because Capture sources already draws the `V2F-States` denied card.
- Edit wallet: reporting a missed transaction is an addition with no board. A wallet's Alerts section has **Report a missed transaction**, which opens Type it, and only saving counts the miss.
- Capture sources: **Keep capture running** is an addition with no board, in the `V2H-Permissions` row style. Battery is a switch that opens the system prompt, and Autostart is a link on Xiaomi, Redmi and POCO phones. The page falls back to Moni's App info and says so when the Autostart page cannot open.
- Edit wallet (owner's direction, 2 Nov 2026, moved off the wallet page on 16 Nov 2026): a wallet's Alerts section is the one home for its linked app, on every wallet type: any launchable app with its real icon, capture health ("Last captured 3 hours ago"), report a missed one, location per wallet, and the account hint. Capture sources says only whether Moni can see notifications.
- Budget tab (owner's direction, 2 Nov 2026): there is no Reports page. Month view adds By category and Top merchants for the chosen month. A row, a category page's See all and merchants, and a Calendar day's All link push `/budget/spending`, a paged list under Budget, not Activity. The merchant count beside Top merchants ("22 merchants") opens the one Merchants page at `/budget/merchants` for that month, under Budget; Profile opens the same page at `/merchants` (owner's direction, 18 Nov 2026, #50).
- Activity (owner's direction, 2 Nov 2026): the Spent against Money in chart leads the tab. A filter row above it holds the Dates, Type and Wallets pickers, each opening a sheet (owner, 18 Nov 2026). The dates, all time by default, set the totals, the chart and the list alike, bucketed by day, week, month or year as the span needs. Touching a bar shows its figures and a tap keeps them up; the chart never changes the dates (owner, 18 Nov 2026). The list shows 20 rows a page with Newer and Older, and search covers every row.
- Wallets (owner's direction, 2 Nov 2026): the net worth chart fills the plot for 1M, 7D, 30D, 90D, 1Y and All, with a Total and By wallet toggle drawing each wallet in its own colour (since 12 Nov 2026 the exact tint of its list bubble, with no key) (`components/wallets/net-worth-chart.tsx`, `balanceIndex` in `@repo/core`). 1M is the calendar month so far. Home's spent card takes the same chips (`lib/finance/chart-range.ts`): 1M stays the month against its budget, and the others show a running total on Pace and bars on Daily (`spendIndex` in `@repo/core`), widening to weeks, months or years as the range needs. A range change zooms the axes to the new range instead of redrawing, and the x axis dates each range by its own scheme: weekdays on 7D, Mondays on 30D, the 1st, 8th, 15th, 22nd and 29th on 1M, months on 90D, quarters on 1Y, years on All (owner's direction, 12 Nov 2026; tokens.md Charts). Those two charts show no callout at rest: the tooltip appears only while a finger is on the chart, moves through every day, and ticks on every day on every range, strong on days with transactions, spaced so a fast glide never buzzes (owner's direction, 12 Nov 2026).
- Profile and Debts (owner's direction, 2 Nov 2026): Capture sources is one row in Privacy and data, with a warning bubble when notification access is off. The Main currency note moved into its sheet. Record a debt is a button card right under the overall card, where the board has it in the header.
- Profile (owner's direction, 12 Nov 2026): the APPEARANCE section is gone. A 44 theme button in the header (moon in light, sun in dark) flips light and dark, and the new theme opens as a circle from the tap. A sliding control under the screenshot would freeze mid-slide; one tap does not. System is no longer offered; a stored `system` still follows the device.
- Profile: **Export data** has no subtitle. The file holds wallets, categories, budgets and debts as well as transactions. It opens the Android share sheet, so the button has no Saved state: Android does not say whether the user saved the file.
- Delete your account (issues #56 and #74, from the web board W2-Parts, which no phone board covers): the last row of Privacy and data, titled in Over red, opens a sheet (owner, 20 Nov 2026), not the board's page: one line, "Everything Moni keeps for you goes for good, on every device.", an **Export data first** text button, and Type DELETE to confirm, with Cancel and Delete my account pinned. The board's list of what goes and the backups line stay on the public web page. Delete my account uses the kit's destructive capsule rather than the board's solid Over fill, and stays off until the word matches. After the deletion the phone signs out to sign in with the toast "Your account is deleted"; the board's done page is for the web.
- Scan to sign in (W2-Auth names the path "Profile › Scan to sign in"; no phone board draws it): an ON THE WEB section above Privacy and data holds the one row. It opens a camera page, and a scanned code opens "Sign in on <browser>?" with Cancel and Sign in; a lapsed or used code says so and offers Scan again.
- Import data (no board; fits `V2H-Profile` and the components kit): a Profile row under Export data opens a page that chooses a file. A Moni export goes straight to **Check the file**, with the count of new rows and rows already here per table. Any other CSV first goes through **Match columns**: a wallet, then one picker per field, and Day first | Month first only when no date in the file settles it. Nothing is written before the check page's button. A row deleted since the export comes back on restore and counts as new: Moni can't tell it from a row the server never had.
- Create account (issue #60): a **Date of birth** month and year with "Moni is for people 18 and over. We keep only the month and year." under it, taken from the web board `W2-Auth`, since `V2H-Login` has none. Under 18 gets "Moni is for people 18 and over, so we can't create an account for you." and no account. Continue with Google does not ask yet.
- Wallet form (owner's direction, 16 Nov 2026): the fields are Paper on the canvas where `V2H-WalletForm` draws Sand, because a page of Sand fields read darker than the Paper cards around it. `PickerField` takes `fill="paper"` for it.
- Wallet page (owner's direction, 16 Nov 2026): the balance corrects in a bottom sheet instead of in place, so the sheet can say plainly that saving adds a correction transaction. The name does not edit on the wallet page; Edit wallet edits it.
- Moni's tone (no board; #66): Profile's MONI CHAT section has one row, **Moni's tone**, that opens a sheet of Friendly · Straight to the point · Playful. The pick is `preferences.moni_tone` and travels with every chat question; with none picked Moni answers Friendly. The names are placeholders until the owner names the tones.
- Edit wallet: **Use as default** is an addition. It sets the wallet captures fall back to, which v1 set on Profile.
- Wallet page (owner's direction, 16 Nov 2026): the page is for looking, the balance, the chart and the wallet's transactions, 20 a page with Newer and Older, so it has no See all. Alerts and Use as default moved to Edit wallet, and Edit wallet's Delete is a header trash button, as on Edit category. The chart takes the net worth chart's plot and range chips, opening on 1M, and its Earlier and Later buttons step the range back a window at a time, a calendar month on 1M, gliding the axes on the same zoom (issue #11).
- Review card (owner's direction, 2 Nov 2026): always 560 tall, clamped to the deck, and a notification capture shows its app's icon. A **Type** row in the card's field list is an addition. It opens a Type sheet (Expense, Income, Transfer), because a capture read as the wrong type could only be Not mine and typed again. It clears the category, and on a capture corrected this way **Don't ask about similar** hides, because a rule keeps no type. The card still has no date or note, as on the board; both edit on the transaction page after Approve.
- Review card: when Moni finds a likely duplicate, the card adds **Same payment**, or **It's a transfer** for the other side of a transfer, next to "Approve keeps both." These restore v1's duplicate actions in the `XA-Review` style, using the same path as automatic pairing, and the toast has Undo. The card drops **Don't ask about similar** while the warning shows. A card that already counts another alert shows **Same payment**, quotes that alert, and offers **Not the same payment**. Transaction detail quotes the second alert under the budget line.
- Review card: a capture Moni read as a transfer, such as a DuitNow reload, adds **It's spending** (or **It's income**) beside "Approve keeps it a transfer." No board draws it.
- Categories (owner's direction, 16 Nov 2026, #8): Edit category has a header trash button that deletes after the confirm sheet, where the board draws **Archive category** under the form, and the list has no Archived section. Underneath it stays a soft delete, so transactions keep the category.
- Categories: the presets **Transit** and **Tolls** come from the competitor research. `V2A-Categories` draws a sample list without them. **TNG Reloads**, **PTPTN** and **Takaful** were retired on 16 Nov 2026 (#7). Their three icons stay in the category form's grid.
- Review: **Recently reviewed** is an addition with no board, designed in the `XA-Review` and `V2F-Components` style (D6). It lists the last 30 days of Approve and Not mine by day under All caught up, and folds into one control under the deck buttons while captures wait. The All caught up card keeps its sentence and drops the session rows that the board draws, because the list below shows them. **Added for you** shows only under All caught up and Nothing to review, because the deck page does not scroll below its buttons.

## Suggested build order

1. Foundations: tokens in `global.css` and `hooks/use-theme-tokens.ts`, Funnel Display, spring and haptic constants, page chrome, list rows, sheets, in-place edit, progress, chart primitives.
2. Navigation shell: the five-slot bar, the + chooser, Moni chat as a pushed route, Debts as a tab, Insights renamed Budget.
3. Home and Activity with their charts; transaction detail with in-place edits.
4. Capture pages (type, voice, live scan) and Review.
5. Budget tab, category page, bills; Debts tab.
6. Account: profile, wallets, balance correction, capture sources.
7. Data gaps from the table above, each with its schema change first.
8. Map, dark mode, states kit coverage.

Each step ends in a working app on Android (the dev-client flow in [`apps/mobile/README.md`](../apps/mobile/README.md)) and a PR that updates this file's status line, `DESIGN_SYSTEM.md` and `apps/mobile/README.md` for what shipped.
