# Web app: implementation handoff

Moni is getting a full web app with the same features as the phone app, plus desktop-only capabilities. The design is locked on the claude.ai design canvas. This file tells an implementing agent where the design lives, which boards are final, the rules every screen follows, and what is still the owner's call. The architecture and the build order are in [`web/PLAN.md`](web/PLAN.md). The prompt for an implementing agent is in [`web/PROMPT.md`](web/PROMPT.md).

**Status (19 Nov 2026):** the design is locked (round 2 screens, round 3 edges, and the combined landing page). Phase 0 of PLAN.md is done: the v1 dashboard is gone and `apps/web` is an empty Next.js 16 app with the Supabase cookie session, the auth callback and the private-path proxy. Phase 3 is done: tokens (`@repo/design`, with `tokens.css` for the web) and the mascot (`@repo/brand`) are shared packages that mobile's generated files come from. Phase 6 is done: auth (email, Google, forgot, verify, 18+ check, sign in with your phone by QR) and the shell (sidebar, rail, phone tab bar, Ctrl K, shortcuts, account menu, toasts, Moni chat and Add panes, light and dark, reduce motion), each section showing its title and empty state. Delete your account (issue #56) works on the public `/delete-account` page, which lists what goes, and as a confirm dialog from Settings › Profile with one line on what goes (issue #74), with Export data (issue #70) on both. The `web-verify` skill drives it. Phase 4 is done: the shell mounts the shared store (`@repo/data`, memory persistence), pulls the ledger on sign-in and clears it on sign-out; Phase 7 has begun: Home (the spent chart with Pace and Daily, inline Approve and Approve all usual, Next 14 days, wallets with the check-in, Recent, Where you spend on drawn map art, Customise) and Activity (the running chart against last month, saved views, filters, List and Table, sortable columns, a category edited in its cell, ticks and the Ink bulk bar, the docked detail pane, right-click and ⋯ menus, 25 rows a page, J, K, X, Esc and Ctrl Z, the view in the URL and the open row in the path) are built at all four layouts in both themes, on the shared read model and write plans. Moni chat is built too: docked beside any view with "Looking at …" from the route, Activity's filters and ticks, the first open, Moni's AI asked before the first question (#57), answer cards from the ledger captioned by the gateway's reply, and a draft that changes many rows' category from words like "Move my Grab rides out of Food" (no AI call; the rows light up in Activity, Approve with Undo, Not mine); adding a spend from chat opens Add's Ask Moni with the words. Add (#93) opens on a chooser with two of the phone's four ways, each with its key: **Type it** (T), the phone's manual page (Expense, Income or Transfer, the amount, Paid with, Category, Date, Location as a typed name, Shop or note), and **Ask Moni** (A), a sentence Moni reads into Type it for the user to check (Moni's AI for Add asked first, as Say it does); Scan a receipt and Say it stay phone-only. Budget (the ring, the budget table edited in its cells with last month and 3-month average, the category pane with six months, bills, the calendar) and Debts (net position, Coming up, the people table, the person pane with Record a repayment, Remind and Write off, Record a debt) are built the same way, and so are Review (the inbox oldest first beside the open capture, J, K, Space, A, X and Ctrl Z, bulk Approve, the bank alert, chat line or receipt photo beside the proposal with every field edited in place, the rule preview for "Don't ask about similar", All caught up and Recently reviewed with Move back; no Later, issue #69) and Where you spend (`/home/places`, pushed from Home's card: the drawn map with pins by coordinates that merge when they touch, zoom and Fit, Pins and Heat, range, category and wallet filters, the places list linked to its pins, the place pane, Day by day, and Without a place with Add a place and Undo). "Copy last month's budgets" became "Copy <last month>'s spending" (it sets each category's budget from what it spent then, with Undo), since a category budget repeats every month and has no month of its own to copy. Settings is built: the section nav (the phone's Profile rows under 700), Profile with Moni's tone, Moni's AI, Merchant names (bulk rename, Moni's guess, Forget names) and Import and export (Match columns beside the live preview, Check the file, Add with Undo, Export data); Wallets, Categories, Rules and Capture sources are not built yet and stay out of the nav: no web board draws them (W2-Data lists them in the nav only, and W2-Empty's Capture log reads the phone's own log, which isn't synced). Phase 8 is done: set-up for a brand-new account (main currency, Moni's AI, wallets, the phone app) and Home's Get set up card, every W2-Empty state in its screen, W2-States (first-load blocks, a card that couldn't load, 404, 500 and maintenance, offline and back online, the toast catalogue, Sign in again), the phone layout on every screen upright and held sideways, and one docked detail pane (`SidePane`) for Activity, Budget and Debts.

## Authority

1. **The canvas boards** listed under "Build these" are the spec for screens, layout, behaviour and copy.
2. [`redesign/tokens.md`](redesign/tokens.md) and [`redesign/glossary.md`](redesign/glossary.md) hold the values and the words. They apply to the web unchanged, except where a "web" board states a desktop rule.
3. [`REDESIGN.md`](REDESIGN.md) holds the phone app's rules. The web keeps them unless the "Phone rules the web bends" list below says otherwise.
4. Research behind the design: [`research/web-features-2026-11.md`](research/web-features-2026-11.md), [`research/data-import-formats-2026-11.md`](research/data-import-formats-2026-11.md), [`research/import-ai-compliance-2026-11.md`](research/import-ai-compliance-2026-11.md), [`research/international-compliance-2026-11.md`](research/international-compliance-2026-11.md).

## Reading the canvas

- URL: https://claude.ai/artifact/8d2qRf6GtxCL9bog1E41fF, page **Web app**. Read a board with the Artifact tool (`action: "read"`, `path: "project/W2-Home.dc.html"`). Never web-fetch it.
- Boards are interactive: their states live in `renderVals()` and `this.state`. Many boards list their states in the generator's docstring.
- On the owner's machine, each board is generated by a script in `~/.local/share/moni-canvas/web-r1/boards/<Board>.gen.py` from the shared kit `webkit.py` (tokens, charts, chips) and `boards/w2_shell.py` (the sidebar, rail, command field, bulk bar, panes). Renders are in `~/.local/share/moni-canvas/web-r1/renders/{r2,r3,land}/`. The canvas is the source; the mirror can be stale.
- The kit's token names drifted from the app's: the kit's `mint` (`#A9DDB5`) is the app's `block-mint`. Use the app's names from `@repo/design` (`packages/design/tokens.css`) and `tokens.md`.
- Numbers on boards are sample data (Kai, Wed 14 Oct 2026). Never hardcode them.
- Owner feedback arrives as canvas comment threads. Read them with the ArtifactComments tool before starting an area.

## Build these (Web app page)

Row 1, the locked app screens (round 2):

| Board | Defines |
| --- | --- |
| `W2-Features` | Spec: what the web adds per function, which phone rules it bends and keeps |
| `W2-Home` | Dashboard: Ctrl K command field, spent chart with Pace and Daily, inline Approve and "Approve all usual", next 14 days, wallets with check-in, Recent, Where you spend, Customise mode |
| `W2-Activity` | Scrolling page: running-totals chart against last month, saved views, filters, List and Table, sortable columns, inline cell edit, checkboxes and the Ink bulk bar, docked detail pane, right-click and hover menus, 25 rows a page |
| `W2-Review` | Inbox with J, K, Space, A, X and Ctrl Z (L and Later are gone, issue #69), bulk Approve, the source beside the proposal, rule preview for "Don't ask about similar", All caught up, Recently reviewed with the rules that checkbox made and Ask again with Undo (#78); a rule shows the wallet its alert app is linked to, since a browser can't read the app's icon |
| `W2-Budget` | Spending ring (laid out as the phone's) beside a budget table edited in its cells, the monthly total in the Total row's Budget cell, Ask Moni to suggest a budget in a dialog (#80, no board yet), last month and 3-month average, Copy last month's budgets, category pane with month history, bills |
| `W2-Debts` | Net position, Coming up, people table with Owes you and You owe, person pane with timeline, Record a repayment and Record a debt in the pane |
| `W2-Chat` | Moni chat docked beside the current view, "Looking at …" context, answer cards with charts, a draft change for many rows that lights them up behind |
| `W2-Data` | Settings with a section nav; Import data at Match columns beside a live preview; Merchant names table with bulk rename |
| `W2-Places` | Where you spend: big drawn map, clustered pins, places list linked on hover, place pane, Day by day grid, expenses without a place |

Row 2, the edges (round 3):

| Board | Defines |
| --- | --- |
| `W2-LandingFinal`, `W2-LandingFinalPhone` | The approved public landing page and its phone width |
| `W2-Auth` | Sign in and create account, forgot, verify, error, loading; 18+ age check; sign in with your phone by QR |
| `W2-Onboarding` | First run: main currency, Moni's AI opt-in, wallets, get the phone app, Home's first-run checklist |
| `W2-States` | Skeletons (first load only), inline progress, errors, 404, 500, maintenance, offline, toast catalogue |
| `W2-Empty` | Every empty and first-run state inside its real screen |
| `W2-Motion` | The motion language on the six spring tokens, with reduce-motion fallbacks |
| `W2-Parts` | Ctrl K palette, shortcuts dialog, confirm dialogs, account menu, menus, popovers, toasts, sidebar and rail, Delete your account (in the app and the public page), Moni's AI settings and label |
| `W2-Responsive` | Two layouts: desktop and phone; breakpoints; how each desktop part becomes its phone form |

Ignore everything on the Archive page, including the rejected web directions A, B and C and the landing directions L1, L2 and L3. The Competitor research page's `R-Web` board is background.

## Layouts

- Width 1360 and up: the full Ink sidebar (W2-Parts still says 1280; W2-Responsive's 1360 wins). Its fold button (or `[`) folds it to the rail and back, remembered per browser; narrower windows always show the rail. 1024 to 1359: the labelled rail. 700 to 1023: the rail with one column, and docked panes become overlays.
- Under 700 wide, or under 500 tall: the **phone layout**, which is the mobile v2 app's design drawn in the same Next.js app (floating Ink tab bar, the same cards and words). It is not a third design and not a separate app.
- The layout follows the viewport, not the device. Crossing a breakpoint keeps the route, the selected row and any half-typed field, because that state lives in the URL and the store.
- iPad and other touch screens keep the desktop layout, with hover-only affordances made visible (⋯ on the selected row, long-press as right-click) and targets of at least 44.

## Rules that apply to every web screen

- All of `REDESIGN.md`'s rules, with the exceptions below. One main currency on focused pages, one progress style, charts lead, one home per chart, visible affordances, Approve and Not mine, Delete visible on a detail view, numbered pages, every state change animates.
- **Phone rules the web bends:** a ⋯ shows only on the hovered or selected row and right-click opens the same menu; a key hint sits inside or touching the control it works (Pace P, the up chevron's K), never in a cluster to one side; detail, Moni chat and Add dock on the right instead of opening as sheets or pushed pages; every passing message (saved, undone, failed, sent) is the one toast, bottom left, and a field shows no Saving or Saved of its own; a sent link's instructions, an offline banner and a filter's empty map stay inline because they hold until something changes; chart tooltips follow the pointer; desktop pages scroll vertically and never squash a chart to fit the first screen. In landscape (rail and sidebar), Coming up keeps a **Pay** quick action on rows you owe, where the phone and the portrait web show plain rows that open the person (#87).
- **The Ask Moni mark is the cat** everywhere on the web, never the MDI `creation` sparkle.
- **Android and the web only.** No App Store links or iPhone app copy until the owner opens iOS.
- Compliance items designed into the boards: account deletion in the app and on a public page (issue #56), Moni's AI opt-in before any data goes to an AI provider and the AI label on Moni chat (#57), the privacy policy and terms linked from the app and the site (#58), the 18+ age check (#60).

## Decided

- Data layer: Option C, the web shares the phone's Legend-State store through `createMoniStore` (19 Nov 2026).
- Hosting: Vercel Pro in Singapore (19 Nov 2026).

## Open owner decisions

- The [CONFIRM] facts on the landing page and in the privacy policy and terms, all in `apps/web/src/lib/site-facts.ts`: data region, price, launch countries, tested banking apps, support email, domain, legal entity, the Google Play link, postal address, the AI providers' retention, the effective date and governing law. Then a lawyer's review of the drafts (`LEGAL_REVIEWED`).
- The landing page's tagline "Money, sorted kindly." was flagged as a soft phrase.
- Whether deleting one transaction asks to confirm or only offers Undo (built as W2-Parts draws it: Delete asks first, with what it takes off the month, then the toast offers Undo); AI consent as one master switch plus per-use switches (drawn) or per-use only; loading skeletons still or pulsing (built still, as W2-States says: blocks never pulse); sync conflicts prompt or last write wins (W2-States draws a prompt, but the shared store is last write wins and has no conflict signal, so the web is last write wins until `@repo/data` reports a conflict).
- W2-Empty's Home first run ("Three steps and Moni is ready", no wizard) and W2-Onboarding (a wizard, then Home's Get set up checklist) disagree. The web follows W2-Onboarding, with its checklist in W2-Empty's Review slot.
- Moni status: the 404, 500 and maintenance pages link it once its address is confirmed (`statusPage` in `site-facts.ts`).
