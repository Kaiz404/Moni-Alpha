# Moni Design Language

**Version:** 1.0  
**Status:** v1, the design the app ships today. **Redesign v2 is replacing it:** read [`REDESIGN.md`](REDESIGN.md) before building or changing any screen. Its principles below still hold; where its visual rules conflict with v2, v2 wins for new work, and this file is rewritten section by section as v2 screens ship.  
**Product:** Moni — local-first, AI-assisted budget tracking  
**Audience:** designers, product engineers, and AI agents creating Moni screens, flows, or components

## 0. Read this first

Moni is not a bank dashboard and not an AI chat app with finance bolted on. It is a calm, optimistic personal-finance companion that makes financial capture and review feel **clear, tactile, and under the user’s control**.

The product promise is simple: Moni reduces the effort of tracking expenses from receipts, transcribed speech, and notifications. It can propose a transaction, budget, or debt record quickly, but it never makes a financial change without a person explicitly approving, modifying, or declining it.

### Non-negotiable rules

1. **Local-first trust.** Treat personal finance data as intimate. Explain where a proposed record came from, preserve evidence, and never imply a change is final before approval.
2. **One decision at a time.** Approval is focused, inspectable, and reversible where possible. Do not stack modal decisions or launch a chain of interruptions.
3. **Color conveys structure, not just decoration.** Colors are consistent category memory aids, but labels, icons, and amounts must always carry the meaning too.
4. **Premium is calm, not sterile.** Use generous space, clean type, light tactile atmosphere, and restrained expressive moments. Avoid generic fintech card soup.
5. **Expressiveness earns its place.** Motion, gradients, and the future companion mascot are used for capture, progress, delight, and explanation—not as ambient noise.
6. **Use native currencies honestly.** Moni displays each account and transaction in its own currency. It does not invent conversion totals.

---

## 1. Product stance

### Platform mode

Moni is **cross-platform premium neutral**, built with Expo React Native and Uniwind (Tailwind) bindings, with an iOS-quality visual bar and Android-quality expressive feedback.

- Keep the information hierarchy, safe-area rhythm, sheets, typography, and tab navigation calm and iOS-like.
- Use Android-style expressive motion principles: responsive touch feedback, clear state changes, purposeful transitions, and visible system status.
- Do not imitate either platform superficially. The shared Moni system wins; platform conventions influence behavior and rendering at the edges.
- Respect native back behavior on Android and native sheet/gesture expectations on both platforms.

### Product personality

**Calm, capable, optimistic, quietly companionable.**

Moni should feel like a well-organized desk with a little warmth—not a banking portal, surveillance tool, or overly cheerful game. A future small cat-like mascot may become a brand signature, but the visual system must work without it. Until then, use low-key brand moments: a subtle orb, curved mark, soft gradient haze, or small friendly glyph.

### Voice

Use concise, human, evidence-led writing.

| Prefer                                       | Avoid                                 |
| -------------------------------------------- | ------------------------------------- |
| “This looks like a $24.80 grocery purchase.” | “Transaction successfully extracted.” |
| “You’ve used 62% of Dining.”                 | “Dining budget utilization: 62%.”     |
| “Review before adding”                       | “AI will automatically process this.” |
| “Keep separate currencies”                   | “Normalized portfolio value”          |

Do not over-personify AI. “Moni found this” is appropriate; needy, apologetic, or overly familiar language is not.

---

## 2. The visual thesis

Moni combines the strongest themes in the mood board:

- **Pastel intelligence:** controlled soft mint, lavender, peach, lemon, and coral used in charts, category identities, and small moments of recognition.
- **Clean financial structure:** visible values, readable lists, unfussy account/budget structures, and concise charts.
- **Playful data:** category icons within charts, calendar activity, gradients representing spending intensity, and visually distinct wallets.
- **Tactile restraint:** off-white or near-black base surfaces, subtle noise or fog, rounded but not balloon-like geometry, and minimal shadows.
- **Actionable animation:** a memorable central FAB, short capture processing, clear transitions into review, and optional voice-mode gradient motion.

### What Moni must _not_ become

- A rainbow dashboard where every element competes for attention.
- A generic purple/blue “AI finance” template.
- A glassmorphism-heavy interface where text and numbers lose contrast.
- A grid of many floating cards with tiny metrics.
- A chat-first interface that obscures the actual money work.
- A cold, enterprise accounting app.

---

## 3. Source-of-truth inspiration in Figma

The board is reference material, not a component library. Inspect it for intent and pattern, then design original Moni components.

**Figma file:** [Moni Mood Board](https://www.figma.com/design/vitdKuC19WK7Uss5q3pKWV/Moni-Mood-Board?node-id=0-1)

### Named reference clusters

| What to study              |              Figma frame | Node ID | Moni lesson                                                                                          |
| -------------------------- | -----------------------: | ------: | ---------------------------------------------------------------------------------------------------- |
| Palette relationships      |          `Color Palette` | `63:87` | Pastel accents can feel premium when paired with disciplined neutrals.                               |
| Visual household / wallets |              `Home page` | `61:69` | Show balances and activity with a confident hierarchy, not a report-like grid.                       |
| Rapid entry                | `Transaction input page` | `61:70` | Financial input can be friendly and touchable; retain roomy controls.                                |
| Trend storytelling         |            `Line Charts` | `61:71` | A chart should answer one question at a glance.                                                      |
| Interaction ideas          |               `Concepts` | `61:72` | Voice, contextual action, and compact interaction panels can be lively without taking over a screen. |
| Primary action behavior    |     `Fast Action Button` | `61:73` | The FAB can be a memorable, animated access point to capture.                                        |
| Account/card presentation  |                  `Cards` | `61:74` | Wallet/account balances should be scannable and visually differentiated.                             |
| Debt/budget entry          | `Debt/Budget input page` | `61:75` | Amount entry must remain direct, legible, and low-friction.                                          |
| Calendar planning          |      `Calender Overview` | `61:76` | Dates, scheduled commitments, and spending patterns can share a calendar without becoming dense.     |
| Category browsing          |     `Categories display` | `61:77` | Category color and icon pairing creates rapid recognition.                                           |
| Composition by category    |             `Pie Charts` | `63:83` | Icons embedded in chart segments can support comprehension when they remain legible.                 |

### Comments to carry forward

| Comment                                                                                 | Product/design implication                                                                      |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| “This color scheme is nice”; “I really like the Pastel color palette”                   | A controlled, soft palette is a core brand preference—not an occasional campaign.               |
| “Spending gradient”                                                                     | Use gradients as a data scale or capture/voice state, not wallpaper.                            |
| “Nice Chart and Activities summary”; “Monthly analysis?”                                | Insights should connect visual trend to an understandable time period and actual activity.      |
| “Use this type of FAB menu design with animations”                                      | The FAB is the designated high-expression interaction, with stateful, spatial motion.           |
| “Animated gradients when using voice mode”                                              | Voice capture can have a distinct living surface, subject to Reduce Motion.                     |
| “Concept of representing transactions as receipts… proposals… invoices”                 | Proposals should look like inspectable financial artifacts, not chat messages or opaque alerts. |
| “Contemplate a calculator?”                                                             | Numerical entry should include a fast, trustworthy amount-entry mode.                           |
| “I like how clean this looks”                                                           | Whitespace and a single hierarchy must survive every feature addition.                          |
| “If a category is selected, it tells you what percentage of that budget is already set” | Selection should reveal an actionable detail, not merely highlight a graphic.                   |
| “icons embed into the pies”                                                             | Pair semantic icons with chart colors when it improves scanability.                             |

---

## 4. Information architecture

### Primary tabs

v2 (N1). Four tabs and the + in the centre cell: Home · Activity · ( + ) · Budget · Debts. A tab navigates; the + is an action, never the active cell.

| Tab          | Job                                                      | Core contents                                                                                                                             |
| ------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**     | The present: what matters today and what needs attention | Net worth, the spent card, the ask box, the review block, recent activity. The avatar pushes Profile; the Moni button pushes Moni chat.   |
| **Activity** | What happened                                            | The Spending / Balance chart, search, type and wallet chips, day groups with the hold menu, the To review capsule, and the Moni button.   |
| **Budget**   | The month against the plan                               | Month chart and calendar, budgets, bills.                                                                                                 |
| **Debts**    | Money between people                                     | Net position, people, record and settle a debt.                                                                                           |

Moni chat and Profile are pushed pages with no tab bar, as is every other root Stack page.

### The + chooser

The + opens the "Add a transaction" sheet (`components/nav/capture-chooser.tsx`, sheet kind `chooser`): **Type it**, **Scan a receipt**, **Say it**, **Ask Moni**. The scrim covers the tab bar; the + stays above it, turned into the close button. A picked row closes the sheet and pushes its page from the right in the same frame, so the page slides in over the sheet as it drops: the tabs layout hosts the chooser (`SheetHost layer="tabs"`), under pushed pages. Android back, the scrim, and the × close it. **Type it** (`app/transaction/new.tsx`, `V2A-CaptureType`) is the amount page with Expense, Income and Transfer, Category, Paid with and Date pickers (`PickerField size="capture"` with 32 tinted bubbles), and one "Shop or note" field; for an expense the category sheet adds "Not counted in budgets": **Transfer** switches the page to a transfer and **Debt payment** opens the Debts tab; its × returns to the screen the + was pressed on. A typed expense that repeats a saved row or a waiting capture from the last 3 days (same amount, and the same shop or, with no shop, the same wallet) opens the duplicate sheet with that row (the time when it is today's): **Review that one** (the row opens it too), **Add mine anyway**, **Change the amount**. **Scan a receipt** (`app/capture/scan.tsx`) opens the ML Kit document scanner as its camera (D11); **Say it** (`app/capture/say.tsx`) listens on the phone with a timer and the live transcript. Both then show Moni reading, a check page (shop and amount edit in place, the amount's hint quoting the words that said it, "MYR · you said nine eighty", category, wallet and date pickers, one evidence line) and **Approve**, which adds the row straight to the ledger with source Camera or Voice; nothing from them waits in Review. A failed read adds nothing and offers **Try again** and **Type it instead**; Say it with the microphone off offers **Turn on microphone**.

### Review queue policy

Captures wait in one place, the Review deck (`app/review.tsx`). Home's review block and Activity's To review rows push it with the capture's id, which goes first. Scan a receipt and Say it approve on their own check page and never wait here; Moni chat captures show a short processing step, then their review in context. Background notification captures never interrupt inside the app: nothing pops up on open. On Android each one posts a notification (`XA-Notification`) in Deep mint: "Moni · Maybank · now", the title "GRAB*FOOD · −RM23.40", the alert as the bank sent it, "Moni: Food & Dining, like the last 14 times.", and Not mine · Later · Approve, which work without opening Moni. Approve turns it into "Approved GRAB*FOOD −RM23.40" over the budget line with Undo and Don't ask about similar for 8 s (Don't ask about similar then reads "Moni adds GRAB*FOOD alerts like this without asking and marks them Auto."); Not mine and Later turn it into "1 not mine" ("Nothing was added.") or "Saved for later" ("It waits in Review and does not count yet.") with Undo for 8 s. A tap on the body opens the deck on that capture. The lock screen hides the contents. Only the first alert after install is heads-up. AI never writes to the ledger without Approve.

---

## 5. Foundations

### 5.1 Spacing and layout

Use a **4-point base unit**. Default screen gutters are 20pt on compact phones; 24pt on large phones. Respect status, camera, home indicator, and bottom-navigation safe areas.

Use Tailwind's 4-point scale (`p-1` = 4) plus the v2 named spacing in `global.css`: `screen` 20 (screen sides), `section` 24 (section gap), `card` 18 (card padding), `bubble` 42 (icon bubble), `touch` 44 (minimum touch target). Rows pad 12 × 18 (`py-3 px-card`).

- Prefer a single clean content plane over nested cards.
- Use one strong focal block per viewport, especially on Home and review screens.
- Financial dense areas may use compact list rows, but never compensate by shrinking body text below legibility.
- Keep touch targets at least 44 × 44pt; use visual size smaller than touch size when needed.

### 5.2 Shape

The system is rounded and soft, not cartoonishly pill-shaped. Surfaces are plain Uniwind rounded views on the v2 radii below; there is no squircle layer.

v2 radii (`global.css` `@theme`, values in [`redesign/tokens.md`](redesign/tokens.md)):

| Utility        | Value | Use                                          |
| -------------- | ----: | -------------------------------------------- |
| `rounded-full` |  9999 | capsule: buttons, chips, pills, tab items    |
| `rounded-card` |    26 | list cards, chart cards                      |
| `rounded-tile` |    22 | outline tiles, picker tiles, hold menu       |
| `rounded-field`|    16 | inner elements, in-place edit fields         |
| `rounded-sheet`|    32 | sheet top corners                            |

Use pills sparingly: filter states, segmented controls, compact metadata, and the FAB label. Do not turn every card and button into a pill.

#### Page chrome and controls (v2)

- `components/ui/page.tsx`: every full-screen page renders `Page` with a `screen` (the testID prefix) and one header `kind`. `home` draws the 44 Mint avatar, date over greeting, and the Moni button; `tabRoot` a 28/32 title with up to two trailing buttons; `pushed` a back circle and an 18/22 title; `task` a close circle, title, and optional subtitle; `bare` no header row (sign-in). It applies the real top inset, a 44 header row with 20 sides, and starts content 12 below it.
- `components/ui/press.tsx`: the press primitive. Scale 0.97 on the `press` spring at finger-down, a pressed fill (`pressedClassName`, default Sand light) fading in, release on `control`; `radius` morphs capsule corners to 16. Reduce Motion keeps only the fill fade. Its `testID` is a required `TestId`.
- `components/ui/text.tsx`: display variants track as V2F-Bible sets them: −0.02em from 18 up, −0.03em on the 64 hero, 0 on body text, +0.04em on caps.
- `components/ui/button.tsx`: `Button` with `variant` `primary` (Ink), `secondary` (Sand), `tertiary` (Deep mint text, 44 tall), `approve` (Mint, Approve haptic), `notMine` (Sand, Not mine haptic), `destructive` (destructive fill); 52 tall, 26 sides on Primary and Secondary and 22 on the icon-led capsules. `loading` turns the board's 14-long arc on a track one step off the fill, with `loadingLabel`; `disabled` turns Sand light with Meta text (Tertiary stays transparent); `waiting` is Sand with Ink 2 text while a form is missing something; `compact` is the 44 capsule inside a card or tile.
- `components/ui/header-icon-button.tsx`: `HeaderIconButton` (44 circle, 1.5 Hairline, pressed Sand at radius 16; `active` is the Ink Selected look) for every header action, and `MoniButton` (44 Ink circle, `creation` glyph, "Ask Moni") on Home and Activity only.
- `components/ui/segmented.tsx`: `Segmented` in three sizes: the 44 default, `medium` 48 with 15/600 labels and optional 18 icons (Appearance, sign-in), and `form` 52 (record a debt). Under Reduce Motion the pill cross-fades in 180.
- `components/ui/rise-in.tsx`: `RiseInGroup` and `RiseIn` play V2F-Motion's list entrance: the first 6 rows rise 8 and fade in 30 apart on first load only; a row that arrives later fades in alone. The + chooser uses it at 120 then 50 apart on `control`.

### 5.3 Elevation and material

Content surfaces are matte. Establish depth with tonal separation, whitespace, and restraint—not borders or heavy shadows.

- Base background: near-white/near-black with **1–2% tactile grain or fog** where technically practical.
- Light hierarchy: warm ivory canvas → bright white primary surface → muted inset surface only for a genuine contained group. Dark mode follows the same relationship with charcoal canvas → lifted charcoal surface → muted inset.
- Default card: opaque, borderless primary surface. Use 12–24pt of visible canvas around it and a meaningful surface-color difference to establish the edge.
- Expressive feature card: use a low-tint semantic surface (`mint`, `aqua`, `lilac`, `peach`, or `lemon`) when a card introduces a distinct financial story, drill-down, or action. The tint replaces the old decorative outline; keep dense repeated rows neutral and keep the tint low enough that values and actions remain primary.
- Borders are exceptions: focused inputs, selected controls, drag targets, deliberate dividers, and high-contrast accessibility fallbacks. Never use a border simply to make a card visible.
- Raised transient element: a short soft shadow plus surface lift; reserve it for the floating tab bar, sheets, and active draggable controls.
- Glass/translucency: permitted only in navigation/transient controls where contrast is preserved. Never put core financial content inside decorative glass.

### 5.4 Typography

**v2: Funnel Display for everything** (decision `XB-Type`). The app loads the 400, 600, and 700 static files from `@expo-google-fonts/funnel-display` and holds the splash screen until they load. Android picks a custom font by family name, so each weight is its own family: `font-display` (400), `font-display-semibold` (600), `font-display-bold` (700). Do not use `font-medium`, `font-semibold`, or `font-bold`; they would make Android fake the weight.

Every screen imports `Text` from `@/components/ui/text` (ESLint rejects the `react-native` import under `app/` and `components/`). `<Text variant="...">` sets family, size, and line height from the type scale in [`redesign/tokens.md`](redesign/tokens.md): `hero`, `amountHero`, `screenTitle`, `sectionTitle`, `cardTitle`, `rowTitle`, `body`, `meta`, `smallest`, `caps`. Without a variant, a `font-display*` class picks the weight and Regular is the default; nested text inherits.

- Funnel Display figures already align; add `tabular-nums` only where a fallback font might render.
- Let large amounts wrap or abbreviate predictably; never reduce type to preserve a layout. Nothing below 12.
- Dynamic Type is mandatory. Critical cards must reflow vertically instead of clip.
- Do not use subtitles beneath titles, section headings, sheet headings, or settings rows. A title stands on its own; keep essential instructions in the relevant control, state, or dedicated content instead.

### 5.5 Iconography

Use simple, warm line icons with rounded terminals and a consistent optical weight. Use native symbol assets when they fit; customize the set’s stroke and fill behavior rather than mixing unrelated libraries.

- Icons support labels; they do not replace them for finance-critical actions.
- Category icon + category color is a recurring recognition pair.
- Use filled icon treatment only for selected/active state or high-emphasis status.
- Avoid generic robot/sparkle overload for AI. The future companion or a restrained sparkle/accent may signal assistance.

---

## 6. Color system

### 6.1 Palette logic

**v2 "Cream & Capsule".** Cream ground, Paper cards, Ink text and primary buttons, and seven pastels that always carry ink text. Roles and hexes are in [`redesign/tokens.md`](redesign/tokens.md) (light) and the `V2F-Dark` board (dark: warm near-black grounds, deepened pastels, ink flips to cream). Category colours come from the category row, never from a screen.

The v1 semantic names that screens already use now carry v2 values:

| Utility                        | v2 role (light / dark)                      |
| ------------------------------ | ------------------------------------------- |
| `canvas`, `background`         | Cream `#F6F2E9` / Ground `#161512`          |
| `card`, `surface-1`, `surface-raised` | Paper `#FFFDF8` / Raised `#211F1B`   |
| `surface-2`, `background-muted`| Sand `#ECE5D6` / Fill `#2C2924`             |
| `foreground`, `expense`        | Ink `#17181A` / Text `#F3EEE3`              |
| `muted`, `transfer`            | Meta `#6B665C` / `#A39C8E`                  |
| `border`                       | Hairline `#DDD5C5` / `#3A362F`              |
| `primary` / `primary-foreground` | Ink on Paper / Contrast `#EDE6D8` with ink |
| `income`, `success`            | Deep mint `#236B47` / Money in `#7FCF98`    |
| `danger`                       | Over text `#B23E35` / `#F0897E`             |

v2 roles with no v1 name: `sand`, `sand-light`, `hairline`, `track`, `ink-2`, `inactive`, `tab-bar`, `on-tab-bar`, `on-pastel`, `deep-mint`, `mint`, `mint-key`, `mint-key-pressed`, `lemon`, `lilac`, `peach`, `coral`, `sky`, `aqua`, `over`. New screens use these; F2 to F4 move the v1 names over and delete them.

### 6.2 Semantic color

Semantic colors communicate state, not moral judgment.

| Meaning                                    | Treatment                                                    |
| ------------------------------------------ | ------------------------------------------------------------ |
| Approved / on track                        | mint plus check/icon and explicit label                      |
| Needs attention / approaching budget       | warm peach or lemon, never red alone                         |
| Declined / correction / destructive action | restrained coral/red plus text and icon                      |
| You owe                                    | warm attentive peach/coral treatment                         |
| Owed to you                                | cool mint/aqua treatment                                     |
| Pending review                             | lilac or neutral emphasis; do not make it look like an error |
| AI processing                              | low-contrast animated mint–lilac gradient, with text status  |

### 6.3 Category colors

Each category gets one stable Material Design icon and pastel color. Do not use emoji or reassign colors per chart. Category hue may appear in a 12–16% tint for rows and cards, 100% saturation for chart segments, and a deep accessible companion for text/icon use. Preset pairs are fixed; custom categories select only from the curated icon and pastel grids.

If two categories share nearby hues, differentiate them with icon silhouette and/or chart pattern in accessibility modes. Never use color alone to encode a debt direction, budget warning, or approval state.

### 6.4 Gradients

Gradients are a **stateful signature**, not a default background.

Approved uses:

- Voice capture / AI parsing: a slow mint → lilac → aqua haze.
- Spending intensity: a single-hue or analogous scale inside an insight visual.
- Future companion presence: a small, low-opacity aura.
- One hero moment per screen, at most.

Avoid high-saturation multi-color gradients behind important numbers, animated gradients on ordinary screens, and gradients used simply because a card needs decoration.

---

## 7. Core component specifications

### 7.1 Bottom tab bar

v2 (N1). The values are in [`redesign/tokens.md`](redesign/tokens.md#navigation).

- A floating Ink pill (`components/nav/tab-bar.tsx`): 12 from the sides, 26 from the bottom (or 8 above a taller system bar), 64 tall, five equal cells. Tab roots pad their scroll content by `useTabBarClearance()` (120 with no system nav bar) so the last row clears it.
- The open tab's icon and label are cream; the others are `inactive`. Nothing slides between cells, and tab roots swap with a 150 ms cross-fade. A pressed cell scales to 0.94 with a 12% cream layer.
- TalkBack reads Home, Activity, Add a transaction, Budget, Debts; the open tab reads selected.
- The bar shows on the four tab roots only. Pushed pages, Moni chat, and capture pages have none, and any sheet covers it.

### 7.2 The + button

- `components/nav/plus-button.tsx`: a 60 Mint key circle 16 above the pill inside a 72 ring in the ground colour, plus glyph 28 in ink. Pressed: radius 30 to 20, scale 0.97, `mint-key-pressed`.
- It opens the chooser. The chooser draws its own + at the same spot above the scrim and turns it 45° on the `control` spring into the ×; Reduce Motion swaps it without turning.
- No haptic on the + or a tab switch: the screen change is the feedback.

### 7.3 Hero net-worth block

Home begins with the user’s financial orientation, not an AI alert. v2 (`V2H-Home`), top to bottom:

- **Net worth**: the sum of main-currency wallets only, amount hero 52. Tapping it opens Wallets. Other currencies never appear on Home.
- **Spent in October** card: spent of the month's budget, then "RM443 left for 18 days · RM24 a day". What's left subtracts bills still due and money owed to a person by month end (D1); the bills strip names it ("RM240.80 set aside for bills and RM40 to Mei"), or the left line does when there is no bill ("after RM40 to Mei"). Pace / Daily toggle over the shared chart (7.12).
- The ask box and the Moni header button both open Moni chat (D4).
- The Lilac review block appears only while captures wait.
- Recent: three main-currency rows (press and hold for Edit category, Change wallet, Delete) and **See all**; the bills strip; the Lemon check-in for one stale main-currency balance (**That's right**, **Fix it**, **Not now**, each answer with **Undo**).
- First run (`V2H-HomeFirstRun`, no wallets and no transactions): "Welcome to Moni", the three setup steps on Mint, the chart's empty shape with a hint, and empty tiles for transactions and bills. The setup steps stay until the user has a transaction.

Do not force a converted aggregate across currencies. Wallets (`V2H-Wallets`) lists the main currency first with its closing-balance line, then each other currency in its own section with the "Kept apart" note.

### 7.4 Wallet/account cards

Use a horizontally scrollable, snap-aware strip only when it genuinely improves comparison. Otherwise use a short vertical wallet list.

Each wallet item includes:

- account name and type (Cash, Bank, E-wallet)
- native balance and ISO/symbol currency
- restrained category/account accent
- optional last-synced or manual indicator

Treat each wallet as one borderless, squircle-edged balance island. Keep its metadata and any mini visual on the same surface; do not turn every internal grouping into a second card.

Use the Moni mint, lilac, peach, lemon, coral, aqua, and neutral palette as solid fills for wallet identity. Do not use gradients, grain masks, or payment-card-like textures. Ensure wallet labels and native balances use an accessible foreground chosen for the selected surface.

Never mimic real payment cards unless users need a real card identifier. The visual job is balance recognition, not faux banking branding.

**Balance check.** When a stale main-currency balance blocks the forecast, Home shows the Lemon check-in for one wallet, "Is Maybank Savings still RM2,281.80?": **That's right** stamps it, **Fix it** opens the wallet page in its balance edit, and **Not now** snoozes every check-in for a week. Each answer leaves one line with **Undo** for a few seconds; it never becomes a permanent card.

**Wallet page (v2, `V2H-WalletDetail`).** A pushed page titled "Wallet" with a ⋯ menu (Edit wallet, Delete wallet). The wallet's name and its BALANCE (amount hero, the wallet's own currency, never converted) each edit in place: tap the value or its pencil, type with the phone keyboard, then ✕ or ✓; one field at a time, and Android back cancels. "Last checked … · **Balance not right?**" opens the balance field with a live line ("Moni adds a −RM3.60 balance correction. Not counted as spending or income."). Saving writes one **Balance correction** row (income or expense of the difference, kept out of budgets and spending) and shows the toast "Correction −RM3.60 added" with **Undo**; saving the same balance only marks it checked. Every list shows a correction as "Balance correction · Not in budgets" on a Lemon bubble. Below the hero, in order: the month card ("Down RM791.60 since 1 Oct", In · Out · Moved, and the Activity chart's closing-balance line for this wallet, tap or drag to read a day; charts show the main currency only, so a wallet in another currency has no month card), "N captures to review" when captures wait for this wallet, Transactions grouped by day with a day total and **All N** into Activity, and ALERTS (Alerts from, Capture log), then the **Use as default** switch. That switch is not on the board: it sets the wallet Moni falls back to when a capture names none, which v1 set on Profile. Deleting the wallet closes the page.

**Wallet form (v2, `V2H-WalletForm`).** New wallet and Edit wallet share one pushed page (back to leave) with a live preview of the bubble, name, and "Type · Currency · alerts from App" line. Fields are Sand: Name, Type and Currency side by side (Currency locks on edit), Starting balance on new only, Alerts from (a note instead for cash), and the Colour row. Edit adds the hint to fix the balance on the wallet page and **Delete wallet**. The pinned primary reads "Create wallet" or "Save changes".

### 7.5 Budget pulse and category progress (v2)

- One progress style: `components/ui/progress-bar.tsx`. Sand track, Ink 2 fill of spent ÷ budget, and the label "RM114 left" beside the category name. At 75% the label turns attention brown. Over budget the track fills in Coral and the label says "RM20 over" in Over text. Nothing draws past the track; there is no pace tick and no split fill. Heights: 8 in rows, 4 in picker tiles, 12 on the category page hero.
- Money goes through `lib/finance/format-money.ts`: `formatMoney` (`RM45.90`, U+2212 for negatives, `{ whole: true }` for forward-looking money rounded down) and `formatSignedMoney` for transaction amounts. The bar's label comes from `budgetNote` in `lib/finance/budget-note.ts`, the same label the category picker tiles show.
- Rings are the Budget tab root's progress (D2), `components/budget/ring.tsx`: a 44 box, stroke 5, Sand track, Ink 2 sweep from 12 o'clock on the `value` spring, the tint bubble inside, and "RM100 left" under it. Over budget the ring is full Coral and says "RM20 over". A category spent with no budget gets a dashed ring and what was spent. Everywhere else uses the bar.
- Existing values edit in place (`components/ui/in-place-field.tsx`, 7.6c). New money (Add a bill) uses the amount page.
- Status pills (`components/ui/status-pill.tsx`) come in the `standalone` variant with a dot (On track, Near the limit, Over, To review) and the 20-tall `inline` variant that leads a row's meta (Auto, To review). A standalone pill's `size` is `default` 30, `small` 28 (the place page), or `compact` 26 with a 12/700 label (the capture pages, the capture log); `align="center"` centres it; the `quiet` tone is the capture log's Ignored. Never add a pill that repeats a number already on screen.

### 7.6 Lists and rows (v2)

- `components/ui/list-card.tsx`: `ListCard` is the Paper list card (radius 26, 6 top and bottom, no dividers); `ListSection` puts a caps label over one, as day groups and settings sections do.
- `components/ui/transaction-row.tsx`: the 66-tall `TransactionRow`. Tint bubble from the category's own colour (`TintBubble`, `size` 32, 42, 44 or 52 with a 17, 20, 22 or 24 glyph: Type it fields, rows, picker tiles, detail heroes; `CategoryBubble` takes the same sizes for a custom category's solid fill), title, meta, amount. No chevron and no ⋯: the whole row opens the detail. Meta reads "Category · Wallet" in day-grouped lists (`metaLead="category"`) and "Date · Wallet" elsewhere (`metaLead="date"`); transfers read "Maybank → Touch 'n Go" with no sign in Meta. Expenses use U+2212 (`−RM45.90`), income `+RM4,200.00` in Deep mint. A pending capture has a dashed bubble, the To review pill, and an unsigned Ink 2 amount. `lib/transactions/row.ts` maps a transaction or proposal to the row's data.
- `components/ui/nav-row.tsx`: `NavRow` for rows that open a page (settings, wallets, people, bills): optional bubble, title, optional value in Ink 2, then chevron-right 20 in Meta.
- Hold (`components/ui/hold-menu.tsx`, V2A-ActivityMenu): pass `onHold` to a `TransactionRow`. Press feedback at 0 ms, a Bloom fill grows from the finger from 250 ms, and at 500 ms the hold commits with the `holdCommit` haptic. A release in between, or a drift over 10 px, cancels and opens nothing; a release inside 250 ms is a tap. `HoldMenu` lifts the row to 1.02 over a 16% dim and springs a 220-wide Paper menu out of the finger on the `sheet` spring, 20 from the screen edge and tucked 10 under the row: Edit category, Change wallet, Delete (Over text). TalkBack reaches it as the row's "Quick actions" action. `HoldHint` shows "Hold a row for quick actions" above the list until its ✕ or the first hold: a 36 Sand chip, 12 before an 18 glyph, 6 apart, ending in a 44 ✕ target. Long press only repeats controls the detail page shows.

### 7.6a Chips and segmented controls (v2)

- `components/ui/chip.tsx`: 36-tall capsule with a 44 hit area for filters and picks; Sand, pressed Hairline, selected Ink with cream text, disabled Sand light.
- `components/ui/segmented.tsx`: one of a few fixed options (type, appearance, who owes who). A 44 Sand track with an Ink pill that slides on the `control` spring; a change plays `scrubStep`. Segment testIDs are `<screen>.<name>.<value>`.
- `components/charts/chart-toggle.tsx`: `ChartToggle` on chart cards, a 36 Sand track with 70-wide segments (Home's Pace | Daily) or `segment={88}` (Activity's Spending | Balance).
- `components/ui/search-field.tsx`: `SearchField`, the 52 Paper capsule (picker sheets, past days); `compact` is Activity's 48 field.

### 7.6b Toasts and banners (v2)

- `lib/toast/toast-store.ts` holds at most one toast. `showToast({ text, tone, icon, undo, commit })` shows it for 5 s; Undo runs `undo`, and leaving any other way (timeout, a newer toast, the app going to the background) runs `commit`. `components/ui/toast.tsx` mounts `ToastHost` once in `app/_layout.tsx`: an Ink capsule at least 56 tall, Mint check (a grey bin for `removed`, or `icon` in cream, as the Review deck's close for Not mine and clock for Later), cream 14/19 text, and Undo on the pressed-Ink fill. It rises 8 on the `sheet` spring, 20 above the bottom inset.
- Delete from the hold menu opens the confirm sheet the detail page uses ("Delete this transaction?", **Keep it** first, then **Delete**), as `V2A-ActivityMenu` draws it, and soft-deletes on **Delete**. It shows no toast: a deleted row drops out of the synced store once the delete syncs back, so an Undo could not restore it.
- `components/ui/banner.tsx`: the capsule under the header that says what happened and what happens next. `SyncBanner` shows the Sand "You're offline. New spends save here and sync later." while the phone has no connection (`expo-network`), the Lemon "Couldn't sync N changes. It's safe on this phone." with Retry when sync fails online, and nothing while sync works. Offline wins over a sync error (`lib/store/sync-banner-state.ts`).

### 7.6c In-place edit and transaction detail (v2)

- `components/ui/in-place-field.tsx` (tokens.md "In-place edit") is the one in-place edit for every detail page, card and row. `InPlaceField` shows the value with a 32 Sand pencil 8 after it; tapping either swaps in a Paper field with a 2 Ink border (amount 64 tall with the signed currency prefix, text 52, note multiline at 10 × 12 padding, three rows tall), a Sand cancel circle, and an Ink save circle that stays off until the value is valid, on the system keyboard (number pad for whole amounts, decimal pad otherwise). `InPlaceGroup` keeps one field open at a time and hides every other pencil while it is open. Android back, the keyboard closing, or a tap outside cancels, so the page's ScrollView needs `keyboardShouldPersistTaps="handled"`. A save that hands back `{ undo }` shows the "… saved" toast with **Undo**; a save that throws shows its message.
- Transaction detail (`app/transaction/[id].tsx`, `V2A-TxnDetail`): name and date line, the amount, the 2 × 2 tiles (Category and Wallet open the picker sheets, Type confirms a switch between expense and income, Source reads Manual, Voice, Moni, Notification, or Camera and links a notification to the Capture log), the budget line for a budgeted category this month (it opens that budget), the full-width note, the place, receipt, and same-merchant rows, and a visible **Delete transaction** that opens the confirm sheet. No ⋯ and no Tags. A notification row's name edit saves a merchant name for every payment from that raw merchant, and its amount edit reads "MYR · the alert said RM30.40" from the bank alert the row kept.
- Categories (`app/categories/`, `V2A-Categories`, `V2A-CategoryForm`): Expenses | Income, Yours, the presets with this month against the budget and a running-total spark, and Archived with **Restore**. An expense preset opens its category page; an income preset opens Activity scoped to it for this month. The form has the name with its count, the icon grid, the colour swatches, and **Archive category** when editing.

### 7.7 Review card deck

The signature trust component (`XA-Review`; values in [`redesign/tokens.md`](redesign/tokens.md#approvals-review-card)). One Paper card at a time, with a blank Sand light card at scale 0.96 under it (D7). `components/review/`:

- `review-card.tsx`: source row (a 36 bubble on the source's light tint, "Maybank alert", time, a 28-tall pill only for facts the app knows: Needs a wallet, Maybe a duplicate), the alert quoted exactly, merchant (one line) and amount with pencils (`components/ui/in-place-field.tsx`, the system keyboard), category and wallet chips on one row that open the picker sheets (`picker-chip.tsx`, also on Moni's draft card), the evidence line, "Don't ask about similar" (notification captures), and the result pill (`result-pill.tsx`, "Food & Dining: RM76 left after this"; Lemon under 15% left, Coral over, Lilac "No budget for Health yet"; `budgetLine` in `lib/proposals/budget-line.ts`).
- `deck.tsx`: `Gesture.Pan` on the UI thread, 1:1 drag tilting 12° per card width, with the drag shadow and a 3 ring in the coming action's colour that firms to 4 once armed; the card leaves 150 under it on a 390 × 844 phone for the Later cue and the toast; release decides on the projected position x + 0.5·v at 40% of the card (`swipeIntent` in `lib/proposals/review-card-state.ts`): right Approve, left Not mine, down Later. Crossing the threshold fires Toggle_On once; Approve fires Confirm, Not mine Reject. The pan is off while a field edits or a decision saves. Three equal 52-tall buttons, Not mine · Later · Approve, do the same; without a wallet Approve turns Lemon, reads "Pick wallet" and opens the picker. `edge-cues.tsx` centres "Not mine" and "Approve" on the card's edges and puts "Later" under it; each fills toward its colour as the card moves its way, dims to 0.3 while the card heads elsewhere, and swaps its arrow for the action icon once armed.
- `caught-up.tsx`: the last card ends on "All caught up" with this session's counts ("1 approved, 1 not mine. RM12.00 now counts in October."), SAFE TO SPEND A DAY before and after them ("RM24 → RM23", "RM420 left for 18 days after these.") when the month has a budget, and a Capture log link; an empty queue shows "Nothing to review". Both pin **Back to Home** where the deck buttons were.
- `added-for-you.tsx`: **Added for you**, the rows Moni added without asking in the last 7 days (Auto), under All caught up and Nothing to review.
- `recently-reviewed.tsx` (board addition, no board; D6): **Recently reviewed** under All caught up and Nothing to review, a `sectionTitle` heading and one `ListSection` card per review day ("Today · Sun 25 Oct"), newest first, 30 days. Meta is the source and the capture time ("Notification · 12:41 pm"). An Approve row is the `TransactionRow` body of the ledger row it created and opens it. A Not mine row has a Sand close bubble, the inline **Not mine** pill, a struck Muted amount, and a visible 44-tall Sand **Move back to review** button, which puts the card back on top of the deck with the toast "Moved back to review". While captures wait, the list folds into a self-centred Sand **Recently reviewed · N** capsule with a chevron under the deck buttons; opening it shows the list in place of the deck.

Toasts: "Approved GRAB −RM12.00" and "1 not mine" with Undo, "Saved for later". The card state is the `ReviewCardState` union (`idle`, `dragging`, three armed states, `editing`, `needsInput`, `saving`, `error`) with one reducer.

### 7.8 Amount page (v2)

New money uses one full page, `components/amount/amount-page.tsx` (`V2P-AmountPage`): Type it, Record a debt, a repayment and lending more. Existing values edit in place.

- The amount is the centred hero (64/68 700, shrinking only to fit) with the sign and symbol: `−RM0` before the first key, `−RM45.90`, `+RM100`, transfers unsigned in Meta. One sentence under it says what the amount does, in Over text when it passes a budget. On Type it an expense at 0 shows the month's safe to spend (`RM443 left for 18 days · RM24 a day`, as on Home); once typed, what it leaves in the category.
- Picker fields and the note sit under the amount. The Paper keypad (56 tall keys, radius 20, digits 26/600, Sand while pressed, `Keyboard_Tap` on each; a key that cannot change the amount, such as a third decimal, reads Inactive and does nothing) and one 56 primary button stay at the bottom.
- `lib/amount/amount-input.ts` is the keypad's pure reducer: nine digits before the point, two after. A suggested amount (`prefilled`) is replaced by the first key.
- No arithmetic and no currency switch on the page. The wallet sets the currency; Type it lists main-currency wallets only.

### 7.10 Modal pickers and sheets

v2 (F3). One sheet host serves every sheet; the values are in [`redesign/tokens.md`](redesign/tokens.md#sheets). Use a sheet for a quick pick from a fixed set (category, wallet, currency, wallet type, date, the linked banking app) or to confirm a destructive action. A task with several fields gets its own page.

- Open a sheet with `openSheet(request)` from `lib/sheet/sheet-store.ts`. The request is one typed union (`category`, `wallet`, `currency`, `walletType`, `notificationApp`, `date`, `chooser`, `confirm`), and the promise resolves to that kind's result, or `null` when the user dismisses it. Only one sheet is open at a time; a second `openSheet` resolves the first to `null`.
- The sheet is Cream with a 32 top radius, a 36 × 5 Hairline grabber, a 22/26 title, and a scrim of `rgba(23,24,26,0.32)` over the page **and the tab bar**. It rises on the `sheet` spring and follows the finger 1:1 from its header; a release whose projected position passes 40% of its height closes it. The scrim, Android back, and a picker's 44 close also close it. Reduce Motion turns the rise into a 180 ms fade.
- Pickers close on pick and carry no pinned action. Options are rows in a Paper list card (42 bubble, 16/22 name, 13/18 Meta line, radio mark). The wallet sheet's Meta line is each balance; `suggestedId` tints one row Mint and adds "Suggested" (the Review deck suggests the wallet that last paid the merchant). The category picker is the `V2A-CategoryPick` grid: a 52 search field, three columns of Paper tiles with 44 tinted bubbles (the pick ringed in Ink outside the bubble), a 4 progress bar and "RM100 left", "RM20 over", or what was spent. `onTransfer` and `onDebtPayment` add the "Not counted in budgets" footer under the grid; the sheet closes before each runs.
- A confirm sheet fits its content and pins two 56 actions split 50/50, the safe one first ("Keep it", then "Delete" in the destructive fill). Use it instead of `Alert.alert` for any destructive choice.
- The control that opens a picker is a `PickerField`: Sand, radius 16, 64 tall, label 13/18 over one row of `mark` (an 18 glyph or 10 dot), value 16/22 600 and an 18 chevron-down, 6 apart; `placeholder` names an empty pick. `size="capture"` is the Type it field: 60 tall, radius 22, a 32 bubble in `leading`, label 12/16 Ink 2 over a 15/20 value, and a 20 Ink 2 chevron at the end.
- `SheetHost` has two layers: `root` above the root Stack for every sheet, and `tabs` inside the tabs layout for the chooser, so pages pushed from it draw above it.
- The + chooser grows from the + centre at scale 0.2 on the `sheet` spring and shrinks back into it (`growFromBottom`), spaces its parts 16 apart, and its rows rise 50 apart. The tab bar hides while the keyboard is up; toasts float 10 above the + ring on tab roots and 20 above the keyboard or bottom edge elsewhere.

### 7.11 Processing state

Processing must feel fast, transparent, and controlled.

- Voice: centered waveform/gradient field, concise status, visible cancel when applicable.
- Scan: document/receipt preview with progressive extraction status.
- Notifications: background processing is not visually exposed until review; status lives in the queue if processing takes meaningfully long.
- Never show fake precision (“99.7% certainty”) unless confidence changes the user’s decision.

### Empty, loading, and missing states (v2, V2F-States)

- Empty list: `EmptyTile` (`components/ui/empty-tile.tsx`), a dashed outline tile (#B9B0A0) with one icon, a title, one sentence that says what to do, and at most one action. `tone="quiet"` is the Hairline tile with a 16/600 title for a section that fills in on its own (Home first run); `tone="notice"` is a page's whole empty state on Hairline dashes (Capture log).
- Missing or failed page: `NotFound` from the same file: a 72 Sand circle, title and what it means ("This spend isn't here any more"), top-aligned, with an optional `action` drawn as the primary button 28 below.
- Loading: `Skeleton` (`components/ui/skeleton.tsx`), static Sand-light rows shaped like the real ones, their bars varying row to row. It appears only after 300 ms, reads as busy with its `label`, and never shimmers; nothing loops where balances show.

### 7.12 Charts and insights

Charts exist to answer a question.

| Chart                        | Question                                | Rule                                                                                            |
| ---------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Category composition / donut | “Where did this month’s money go?”      | Use category colors and icons only where segments are large enough. Provide a list alternative. |
| Spending trend / line        | “Am I spending more or less over time?” | One meaningful series by default; tap/drag reveals a value.                                     |
| Budget progress              | “How close am I to my limit?”           | Pair progress with used/remaining amounts.                                                      |
| Calendar                     | “When did spending or bills happen?”    | Dots/heat reveal activity; selection reveals a detail list.                                     |
| Wallet balance comparison    | “Where is my money held?”               | Preserve original currencies; do not compare incompatible currencies as a false total.          |

Keep chart controls local and obvious: timeframe, category, wallet. Avoid chart walls. Pair every chart with one plain-language takeaway or drill-down path.

Chart surfaces are borderless and quiet: use the parent surface plus spacing to frame them, a very low-tint category fill for contextual areas, and clearer pastel category hues only for active data marks, selected states, or legible segments. Avoid dark grids, boxed legends, and saturated decorative fills.

Activity chart (v2, `components/charts/activity-chart.tsx`, `V2A-Activity`): a Paper card with the month's caps label and a Spending | Balance segmented toggle. Spending draws one Ink bar per day so far, the part above even pace in Coral, even pace as a dashed Ink line with its label on the axis, and today on a Sand-light band with a dashed segment for safe to spend a day; without a main-currency budget it drops even pace and that legend. Balance draws the closing balance of the main-currency wallets across the whole month; its axis does not start at 0, and the accessibility label says so. Tapping a bar or a point (dragging on Balance) moves the Ink callout and narrows the list to that day, with **Whole month** to clear it. Bars grow 14 ms apart and the line draws in on the `value` spring, once per app session.

v2: `components/charts/pace-chart.tsx` draws the three tokens.md line and bar charts from one `series` of per-day values: `pace` (spent against the budget, with even pace), `daily` (one bar a day, Coral above even pace, today's safe-to-spend segment) and `balance` (closing balance, axis not from zero). One callout, a scrub that snaps per day with `scrubStep`, draw-in once per mode, and no projection line or readout row. On the line charts the first day sits at the plot's left edge and the month end at its right edge; Today and the daily bars' labels centre on their day. `chart-toggle.tsx` is the 36-tall card toggle on every chart card (Home's Pace | Daily, Activity's Spending | Balance).

### 7.12 Chat and companion presence

Chat is a dedicated capability, not the application’s control center.

- Default conversation layout is uncluttered, with clear human vs. Moni attribution.
- Moni can explain transactions, help draft budgets, and prepare transaction/debt records.
- A consequential Chat output is rendered as the same review artifact used elsewhere; the user must approve, modify, or decline.
- The future companion is a small brand presence: a greeting marker, processing companion, or empty-state moment. It never blocks amounts, occupies major persistent screen space, or replaces useful labels.
- Use a compact “Suggested action” card rather than forcing users into a conversational loop.

v2 (`V2H-AskMoni`, `V2H-AskMoniAnswer`, `V2H-ChatHistory`): Moni chat is a pushed page titled "Moni" with today's date, reached from the Home ask box, the Moni header button (Home, Activity) and the chooser's Ask Moni; all three open today's thread. The user writes on Sand, Moni answers on Ink. A capture becomes a draft card ("Moni's draft · not counted yet"): merchant and amount edit in place, category and wallet chips open picker sheets, and **Not mine** · **Later** · **Approve** settle it behind a 5 s toast with Undo (Approve reads "Pick wallet" until a wallet is set). A question shows the thinking card, then an Ink answer card whose title, bar and chart come from the ledger and whose caption is the model's reply. A category answer puts its Pace chart on a Paper inset (radius 18) and, when over, says Budget shows it over until month end; a bill answer draws the bills still due this month as bars (the asked one Lemon) with "Bills and RM40 to Mei come to … before 31 Oct" and links the bill; "Show my 3 captures" lists the waiting captures with 44 Not mine · Later · Approve circles that settle each row in place (the status pill undoes it) and Open Review. "Moni noticed" opens the day with what stands out, each line a question to Moni on a soft bubble (the category's tint, Lilac for captures, Lemon for a bill). After two idle hours today's thread reopens folded under "Earlier today · N messages", unless a draft still waits or Moni is still replying; a past day never folds. The thread sits at the bottom above a 52 composer (camera, the system keyboard, the Ink mic; the mic turns the composer into an Ink "Listening" capsule with a Mint key Done). Past days lists each day with search, delete and Undo.

### 7.13 Debt component

v2 (D1, boards `V2P-Debts`, `V2P-DebtDetail`, `V2P-DebtNew`, `V2P-DebtSettle`, `V2P-DebtsEmpty`). Debts show only in the main currency and never sum across currencies.

- **Debts tab.** Header **Record a debt** (Sand capsule). A Mint hero with the net position in whole ringgit and two Paper tiles, **Owed to you** and **You owe**; a tile filters the people list in place and turns Ink (D5). A Lemon **Coming up** block lists each open debt with a due date: **Pay** for money you owe, **Remind** for money owed to you, then "Reminded today". **People** rows: pastel initial tile, "Lent Sun 27 Sep", 2-decimal balance with "owes you" in deep mint or "you owe" in ink. **Settled and written off** is a hairline capsule with a count that opens the closed debts. No debts at all shows the dashed empty tile.
- **Debt page.** Name and note edit in place; the due date opens a picker sheet. An open debt shows the caps direction line, the amount hero, a repaid bar, **Record repayment** and **Lend more** / **Borrow more**, then **Paid back in full** / **I paid it all** and **Remind** as deep-mint text buttons. A paid debt turns into the Mint "All square" card; a written-off one shows RM0.00. **Write off** is a destructive capsule behind the confirm sheet (**Keep it**, **Write off**). Every change toasts with Undo.
- **New money** (a repayment, lending more, a new debt's amount) uses the amount page: the hero amount, one sentence on where the debt ends up, the wallet and note fields, quick amounts, the Paper keypad, and one primary action.
- Remind opens the Android share sheet with a prefilled message; Moni sends nothing itself. Debt colour never carries direction alone: the words "owes you" and "you owe" always appear.

---

## 8. Screen recipes

### Home

1. Safe top area with a friendly time-aware greeting or concise title; optional discreet review indicator.
2. Net-worth hero plus native-currency scope.
3. Wallet/account balance visual.
4. Budget pulse / safe-to-spend summary.
5. Upcoming obligation or debt snapshot, when relevant.
6. Recent activity list.
7. The + remains readily discoverable.

Home must remain useful when there are no pending proposals. Do not reserve a large empty review area.

### Budget (v2)

1. Title "Budget" with the month chooser (a Sand capsule that opens the `month` sheet), then Month | Calendar.
2. Month: the "Spent in October" card with the pace chart (`components/charts/pace-chart.tsx`) and what is left after bills and debts due (D1), the ring grid under a Budgets heading whose chevron opens Edit budgets (D9) and "No budget yet", the bills still due with **Add a bill**, and the "Where you spend" teaser that opens `/map`.
3. Calendar: days coloured Under, 1.5×, 2× or Over 2× against even pace (`calendarHeat`), a dot on bill due days, the picked day's first three rows with a link to the rest in Activity, and top merchants with **See all**.
4. One page per category (`/budget/[categoryId]`): spent of the budget on the 12 bar, the monthly budget in place, its chart, bills, transactions with pending "To review" rows (five, then **See all**), and top merchants, where a bank code still to name gets the in-place **Name this merchant** pencil. **Edit budgets** (`/budget/edit`) edits the monthly total and every cap in place and saves them together.
5. A bill page (`/bill/[seriesKey]`): name and amount in place, Mark paid, Skip this month, due day, wallet and category pickers, Remind and Auto-add switches, history, and Stop tracking.

Debts never appear on the Budget tab beyond the D1 label ("after bills and RM40 to Mei").

### Chat

1. Quiet header with a small companion/brand cue.
2. Conversation area.
3. Suggested prompts based on user data only when privacy expectations permit.
4. Composer with text/voice access.
5. Consequential output enters the standard review experience.

### Profile (v2, `V2H-Profile`)

Grouped settings rows, not dashboard cards, in board order: the account (Mint initial, name, email and "Google" for a Google account), **Main currency** (opens the Main currency sheet, which lists only the currencies held in a wallet with their wallet count and total, writes `preferences.currency`, with the note that focused pages show only it), APPEARANCE (Light, Dark, System), MONEY (Wallets, Categories, Merchant names), CAPTURE SOURCES with **Set up** (Bank notifications, Location, Camera, Microphone, each with On, Off or Not set up), PRIVACY AND DATA (Capture log, Export data as a CSV), then **Sign out**. Rows carry a 13 meta line and light pastel bubbles (`components/profile/profile-row.tsx`). Profile has no Budgets or Debts row. A Debug panel row shows only in development builds.

### Sign in (v2, `V2H-Login`)

One page for both modes: the "Moni" word and "Know what's safe to spend.", a Sign in / Create account toggle, the fields (Name only when creating an account, Email, Password with a reveal), the Ink primary, "or", the Sand **Continue with Google**, and a link that swaps the mode. One state at a time: wrong details (Over border and line under the fields), Confirm your email (Lilac card after creating an account), Google sign-in didn't finish (Lemon), and offline (outline). No logo mark (D3).

### Where you spend (v2, `XM-Places`, `XM-Detail`, `XM-Empty`)

1. The map fills the top half in the board's warm map style, with the header floating over a cream fade. Pins are Paper capsules (category bubble, whole-ringgit total); pins that would overlap merge and show a count; the selected place's pin turns Ink.
2. A cream sheet starts over the map's bottom edge. Its grabber drags or taps it up to just under the header; the map keeps its own pan and pinch.
3. In the sheet: the range segmented control (This week, this month, last month), category chips, then the selected place as a fixed card in its top category's colour with **See this place**. It is part of the page and cannot be swiped away. "Top places" lists every place, largest first.
4. The place page has a static map strip, the "Spent here" hero, "Your top place", captures pinned here that wait for review (kept out of the totals), "What you bought" as one split bar, a Moni noticed card when a merchant is a regular, the payments, and **See these in Activity**.
5. With no located expenses the sheet shows the XM-Empty state: **Add an expense**, or **Turn location back on** when location is denied. With places and location denied, the places stay and one line offers to turn it back on.
6. Main currency only; other currencies never reach the map.

### Merchant names, Capture sources, and Capture log (v2)

- **Merchant names** (`V2H-Merchants`): To name lists bank codes with three or more payments and no name; Named lists the rest. The pencil edits the name in place (Paper field, cancel, save) and offers Moni's guess. Save and Forget this name confirm with a toast and Undo.
- **Capture sources** (`V2H-Permissions`): one switch per phone permission. Moni cannot revoke a permission, so the switch asks while Android still allows it and opens Settings otherwise. Location from notifications nests one switch per linked banking app. Revoked notification access replaces its row with the permission-denied card from `V2F-States`. ADDED WITHOUT ASKING lists auto-add rules with Ask again and Undo.
- **Capture log** (`V2A-NotifLog`, `V2A-NotifLogEmpty`): day groups, filter chips only for statuses present, the alert text as sent, one status pill in glossary words, and one next step per entry (Review it, See transaction, Link the app to a wallet). A Not linked entry whose RM amount another app's Added alert named within 10 minutes gets a Meta note: "Same payment as the Touch 'n Go alert at 9:40 pm, which was added." Three days show before Show N older. The empty state points at notification access and explains each status.

---

## 9. Motion language

### Principles

Motion must communicate cause and effect, preserve spatial orientation, and feel responsive to touch. It should never make finance feel frivolous.

| Moment                 | Motion                                         | Intent                               |
| ---------------------- | ---------------------------------------------- | ------------------------------------ |
| + opens the chooser    | glyph turns 45° on `control`, sheet rises on `sheet` | reveal a focused action set     |
| Tap/click              | `Press`: scale 0.97 and pressed fill on finger-down | confirm the interface received input |
| Receipt processing     | subtle progress/wave/gradient movement         | show active work without fake drama  |
| Proposal enters review | source context visually resolves into artifact | reinforce provenance                 |
| Sheet opening          | anchored rise, light scrim                     | retain context                       |
| Chart selection        | color/label emphasis and value reveal          | bind data point to explanation       |
| Approve                | brief check/mint confirmation then return      | acknowledge deliberate completion    |

### Springs and haptics (v2)

- `lib/motion/tokens.ts` holds the six motion tokens from [`redesign/tokens.md`](redesign/tokens.md): `springs.press`, `value`, `control`, `sheet`, `throw` (mass 1, for `withSpring`) and `drag` (1:1, no spring while held). Flings decide on `projectedPosition(x, v)` against `FLING_COMMIT_THRESHOLD` (40%). Containers may bounce; anything that encodes money uses `value`.
- `lib/haptics` has one function per moment in the tokens.md haptics table: `keypadTap`, `approve`, `notMine`, `thresholdOn`, `thresholdOff`, `scrubStep`, `toggleOn`, `toggleOff`, `holdCommit`. Android plays the `AndroidHaptics` constant, iOS the table's equivalent. ESLint rejects `expo-haptics` imports under `app/` and `components/`.
- Fire a haptic on the same frame as the visual, at most once per user action, and never as the only feedback. Pressing the + and choosing from it play none.
- Continuous AI gradient: slow and low-contrast; never pulse urgently unless an error actually requires attention.

### Reduced Motion

When Reduce Motion is enabled:

- Replace scale/bounce/parallax with opacity and short crossfades.
- Freeze or simplify animated gradients/waveforms.
- Never auto-advance a proposal because an animation finishes.
- Keep all status changes textually explicit.

---

## 10. Light and dark theme rules

Light and dark mode are first-class siblings, not inverted afterthoughts.

- Preserve semantic relationships and category identity across themes.
- Dark mode uses the `V2F-Dark` warm near-blacks (Ground `#161512`, Raised `#211F1B`), never grey. Pastels deepen a step and keep ink text (`on-pastel`); the ink role (`primary`) flips to cream.
- Lift muted text and dividers enough for readability; do not simply lower every opacity.
- Pastel accents often need a deeper or brighter companion in dark mode to retain contrast.
- Ensure receipt thumbnails, imported notification evidence, and charts remain interpretable in either theme.
- Treat system appearance as default, with an explicit Profile override.

---

## 11. Accessibility and inclusive design

Moni’s system must remain perceivable, adaptable, and comfortable. This aligns with Apple’s current HIG accessibility guidance, which emphasizes familiar interactions, larger text support, sufficient control size, avoiding reliance on a single cue, and honoring Reduce Motion. See [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) and [Motion](https://developer.apple.com/design/human-interface-guidelines/motion).

### Required checks

- Meet an appropriate accessible contrast target for all text, key icons, and controls in light and dark themes.
- Do not encode money direction, category, review status, or urgency with color alone.
- All core interactions have a visible control alternative to swipe/gesture-only paths.
- Preserve logical screen-reader order: source → amount → fields → evidence → actions in proposal review.
- Announce processing completion and approval result accessibly.
- Support Dynamic Type / font scaling with reflow, not clipping.
- Keep critical tap targets generous; avoid dense icon-only action rows.
- No fast blinking, aggressive looping, or automatic dismissal of decision-critical screens.
- Provide haptic feedback as enhancement only; pair it with visible change.

### Cross-platform convention

Use a consistent Moni visual system, while retaining native affordances:

- iOS: sheet gestures and hierarchy should feel at home; use tab navigation consistently. Apple explicitly distinguishes tab bars for top-level navigation from actions, so Moni’s + remains outside the tab model. See [Apple HIG: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars).
- Android: preserve clear back navigation, visible touch feedback, and Material-like state clarity without turning the UI into a generic Material template.

---

## 12. Agent operating instructions

When designing or implementing a Moni screen, agents should follow this order:

1. Identify the user’s immediate question or decision.
2. Choose one primary focal point and reduce competing cards/ornament.
3. Select semantic tokens; never hardcode arbitrary colors or gray values.
4. Use a stable component from this document before inventing a new one.
5. Preserve native currency, source evidence, and explicit confirmation wherever financial data changes.
6. Add motion only where it teaches state, confirms action, or supports capture.
7. Validate light/dark, larger text, reduced motion, and long currencies/merchant names.
8. If visual inspiration is needed, inspect the named Figma frame above and its associated comment—not merely the board thumbnail.

### Implementation-facing token naming

Use semantic names such as:

```text
bg-canvas / bg-card / bg-sand / bg-sand-light
text-foreground / text-ink-2 / text-muted / text-on-pastel
border-hairline / bg-track / bg-tab-bar / text-inactive
text-deep-mint / text-over / bg-mint / bg-lilac / bg-mint-key …
state-pending / state-attention / state-approved / state-destructive
rounded-card / rounded-tile / rounded-field / rounded-sheet / rounded-full
p-screen / gap-section / p-card / size-bubble / size-touch
font-display / font-display-semibold / font-display-bold
springs.press / value / control / sheet / throw, drag
```

Do not name UI tokens after a one-off visual result (`purpleCard`, `greenButton2`, `chartBlue`).

Token values live only in `apps/mobile/global.css`. `pnpm --filter moni gen:tokens` copies the light and dark semantic colours into `constants/theme-tokens.generated.ts` for `useThemeTokens()`, and CI fails when that file is stale.

### Design-review checklist

- Does the screen have one clear financial question or next action?
- Are important numbers readable at a normal phone size?
- Is there more than one nested card layer? If yes, remove one unless it represents a genuine containment relationship.
- Does the component work in both themes without losing hierarchy?
- Is the AI proposing and explaining rather than silently changing data?
- Is the source of a proposed transaction available without overwhelming the review screen?
- Are colors meaningful, consistent, and backed up with text/icon/amount?
- Does motion reduce to a calm, functional alternative?
- Does the result feel like Moni—pastel-smart, tactile, calm, and actionable—rather than a generic fintech template?

---

## 13. Final creative guardrails

**Make Moni feel:**

- personal rather than institutional
- capable rather than bossy
- expressive rather than noisy
- visually rich rather than densely boxed
- trustworthy rather than automated-away
- cross-platform rather than platform-agnostic

**Use:** generous spacing, softened geometry, clear numbers, category-icon memory, quiet texture, one expressive action layer, receipt-like review artifacts, and intentional data visualization.

**Avoid:** unexplained AI, automatic financial writes, dashboard clutter, permanent card shadows, random rainbow accents, tiny labels, decorative glass content cards, and animation without meaning.

Moni’s defining interaction is not “AI did something.” It is: **“Moni made this easy to understand, and I remain in control.”**
