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

Use four stable bottom tabs. A tab navigates; it does not execute an action.

| Tab          | Job                                                      | Core contents                                                                                                                             |
| ------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Home**     | The present: what matters today and what needs attention | Net worth presentation, wallet/account balances, safe-to-spend/budget pulse, upcoming obligations, recent activity, subtle review access. |
| **Insights** | The past and patterns: understand money                  | Transaction history, category drill-down, budget progress, calendar, monthly analysis, trend and composition charts.                      |
| **Chat**     | Ask, explain, draft, and create with Moni                | Financial questions, record creation, planning assistance; every consequential output becomes a review card.                              |
| **Profile**  | Set up and maintain the system                           | Accounts/wallets, currencies, categories, notification sources, privacy/local-first controls, appearance, accessibility.                  |

### Central FAB

The FAB is a global action launcher, not a fifth tab. It opens with a short spring into a vertical/radial action menu:

1. **Scan receipt**
2. **Add transaction**
3. **Ask Moni** — voice/text capture, entering Chat with context
4. **Record debt**

Use labels; do not rely on icon recognition. The menu closes on selection or an explicit dismiss. On Android, respect back; on iOS, a tap outside or downward drag dismisses it.

### Review queue policy

Moni has two proposal channels with intentionally different interruption levels.

| Source                                          | Delivery                     | Review behavior                                                                                                                                                                 |
| ----------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Receipt scan, manual entry, Chat-created record | Immediate and user-initiated | Show a brief processing screen, then enter the full-screen proposal review in context.                                                                                          |
| Background notification parsing                 | Quiet and queued             | Do not interrupt the user while processing. On a later app open, offer the newest review as a focused overlay when appropriate; keep remaining items in a compact review queue. |

Never show multiple review popups in a sequence. Review one, then offer “2 more to review” with **Continue** and **Later**. A quiet review indicator can live in the Home header or activity area; it must not become a permanent dashboard card.

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
- `components/ui/button.tsx`: `Button` with `variant` `primary` (Ink), `secondary` (Sand), `tertiary` (Deep mint text, 44 tall), `approve` (Mint, Approve haptic), `notMine` (Sand, Not mine haptic), `destructive` (destructive fill); 52 tall, `loading` shows a spinner and `loadingLabel`, `disabled` turns Sand light with Meta text.
- `components/ui/header-icon-button.tsx`: `HeaderIconButton` (44 circle, 1.5 Hairline, pressed Sand) for every header action, and `MoniButton` (44 Ink circle, `creation` glyph, "Ask Moni") on Home and Activity only.

### 5.3 Elevation and material

Content surfaces are matte. Establish depth with tonal separation, whitespace, and restraint—not borders or heavy shadows.

- Base background: near-white/near-black with **1–2% tactile grain or fog** where technically practical.
- Light hierarchy: warm ivory canvas → bright white primary surface → muted inset surface only for a genuine contained group. Dark mode follows the same relationship with charcoal canvas → lifted charcoal surface → muted inset.
- Default card: opaque, borderless primary surface. Use 12–24pt of visible canvas around it and a meaningful surface-color difference to establish the edge.
- Expressive feature card: use a low-tint semantic surface (`mint`, `aqua`, `lilac`, `peach`, or `lemon`) when a card introduces a distinct financial story, drill-down, or action. The tint replaces the old decorative outline; keep dense repeated rows neutral and keep the tint low enough that values and actions remain primary.
- Borders are exceptions: focused inputs, selected controls, drag targets, deliberate dividers, and high-contrast accessibility fallbacks. Never use a border simply to make a card visible.
- Raised transient element: a short soft shadow plus surface lift; reserve it for FAB menus, sheets, and active draggable controls.
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

v2 roles with no v1 name: `sand`, `sand-light`, `hairline`, `track`, `ink-2`, `inactive`, `tab-bar`, `on-pastel`, `deep-mint`, `mint`, `mint-key`, `lemon`, `lilac`, `peach`, `coral`, `sky`, `aqua`, `over`. New screens use these; F2 to F4 move the v1 names over and delete them.

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

- Fixed four-item navigation: Home, Insights, Chat, Profile.
- Visually stable across top-level screens; preserve each tab’s navigation state.
- Label and icon always appear together. Active tab uses brand/deep mint or high-contrast ink; inactive is muted.
- The central FAB floats above/between the middle tabs without being mistaken for a tab.
- Use material/translucency only if the content remains legible beneath it and increased-contrast settings can fall back to opaque.

### 7.2 FAB and action menu

- Circle: 56–60pt visual diameter, 44pt minimum tap target is insufficient here; make it comfortably touchable.
- Default fill: brand mint with deep ink icon. Dark mode may use a light mint or high-contrast surface.
- On activation: button rotates/morphs subtly to close state; action items emerge with 40–70ms stagger and short spring.
- Action items: icon, short label, optional tinted round container. No more than four.
- Voice action has a small lilac/mint accent; scan action has a camera/document cue.
- Reduce Motion: replace expansion spring with a 150–200ms opacity and scale fade.

### 7.3 Hero net-worth block

Home begins with the user’s financial orientation, not an AI alert.

Contents:

- “Net worth” label, large primary number, native currency context.
- A discreet visibility toggle.
- Difference/trend only when it has an understood comparison period (e.g., “+$280 this month”).
- A compact account-balance visual immediately below or attached: segmented bar, stacked mini bars, or a wallet carousel showing cash, bank, e-wallet, and other accounts.

Do not force a converted aggregate across currencies. When accounts span currencies, show an `Accounts` summary with each original amount and currency. If a net-worth aggregate cannot be honestly calculated, explain the scope rather than fabricating one.

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

**Balance check.** When a stale balance blocks the forecast, Home and Chat open with one peach card, “Confirm balances to unlock your forecast”, listing each wallet with its native balance and two actions: **Yes, that’s right** (the row fades out) and **Fix it** (opens the wallet). It always offers **Not now**, which snoozes it for a week; it never becomes a permanent card.

### 7.5 Budget pulse and category progress

- A category row displays its icon, name, a right-aligned percentage, and a clear progress treatment. Keep any remaining amount as supporting text below the track when needed.
- On select, expand or navigate to a detail that states: “$186 of $300 used · 62%.” This follows the board’s desired category-percentage insight.
- Use a progress line/ring only with its textual amount and percentage.
- Budget progress fills retain the category color. Put the used amount at the left of the complete track and the percentage to the right of the category name; state any overage in explicit destructive text rather than recoloring the category.
- The warning threshold is contextual; do not make the whole card red at 80% by default.
- The progress track sits directly within its parent surface. It does not receive a separate outlined container.

### 7.6 Transaction row

**Leading:** category icon in a low-tint color circle.  
**Middle:** merchant/description and secondary category/source/date.  
**Trailing:** native amount, debit/credit direction, and optional compact review state.

- Merchant name is the most important text after the amount.
- Avoid unexplained plus/minus coloring; include “Expense”, “Income”, “Transfer”, or directional icon when needed.
- Rows are direct, list-like, and comfortably tappable—not individual floating cards.

### 7.7 Transaction proposal artifact

This is Moni’s signature trust component. It is a **financial review artifact**, closer to a receipt or invoice than a chatbot bubble.

#### Structure

1. Source/evidence header: “From receipt”, “From notification”, “From Moni chat”, with confidence only if it is meaningful and explainable.
2. Main amount and currency.
3. Merchant, date, category, wallet, and notes as editable fields.
4. Small evidence preview: receipt thumbnail or notification excerpt. It may expand to the image only; do not force a transcription view.
5. Clear actions: **Approve**, **Modify**, **Decline**.
6. Optional contextual note: “This would use 62% of Dining.”

#### Behavior

- User-initiated sources: show `Processing your receipt…` or equivalent for a short, honest interval, then transition to full-screen review.
- Background notification sources: queue silently; do not surprise the user with a sequence of full-screen approvals.
- Approve should show an immediate confirmation state and return the user to the prior context.
- Modify opens an editable sheet with prefilled values; it does not destroy the source context.
- Decline must be easy and nonjudgmental. Offer a low-friction reason only if it helps improve future parsing; never guilt the user.

### 7.8 Amount field and calculator

- Amount is a large, right-aligned numeric field with tabular figures.
- Offer a calculator/keypad flow from manual entry and proposal modification.
- Support arithmetic for quick calculations, but reveal the final evaluated value clearly.
- Currency is explicit and editable; no automatic conversion.

### 7.9 Full-screen proposal review

Use one full-screen review at a time. Its visual rhythm:

1. Compact source/processing context.
2. Large amount.
3. Receipt-like detail group.
4. Budget or account effect, only when useful.
5. Fixed bottom action area: secondary decline, tertiary modify, primary approve.

The background should be calm and mostly opaque. Do not place a dense modal atop an already busy Home dashboard.

### 7.10 Modal pickers and sheets

v2 (F3). One sheet host serves every sheet; the values are in [`redesign/tokens.md`](redesign/tokens.md#sheets). Use a sheet for a quick pick from a fixed set (category, wallet, currency, wallet type, date, the linked banking app) or to confirm a destructive action. A task with several fields gets its own page.

- Open a sheet with `openSheet(request)` from `lib/sheet/sheet-store.ts`. The request is one typed union (`category`, `wallet`, `currency`, `walletType`, `notificationApp`, `date`, `confirm`), and the promise resolves to that kind's result, or `null` when the user dismisses it. Only one sheet is open at a time; a second `openSheet` resolves the first to `null`.
- The sheet is Cream with a 32 top radius, a 36 × 5 Hairline grabber, a 22/26 title, and a scrim of `rgba(23,24,26,0.32)` over the page **and the tab bar**. It rises on the `sheet` spring and follows the finger 1:1 from its header; a release whose projected position passes 40% of its height closes it. The scrim, Android back, and a picker's 44 close also close it. Reduce Motion turns the rise into a 180 ms fade.
- Pickers close on pick and carry no pinned action. Options are rows in a Paper list card (42 bubble, 16/22 name, 13/18 Meta line, radio mark). The category picker is the `V2A-CategoryPick` grid: a 52 search field, three columns of Paper tiles with a 4 progress bar and "RM100 left", "RM20 over", or what was spent.
- A confirm sheet fits its content and pins two 56 actions split 50/50, the safe one first ("Keep it", then "Delete" in the destructive fill). Use it instead of `Alert.alert` for any destructive choice.
- The control that opens a picker is a `PickerField`: Sand, radius 16, 64 tall, label 13/18 over value 16/22 600, chevron-down.

### 7.11 Processing state

Processing must feel fast, transparent, and controlled.

- Voice: centered waveform/gradient field, concise status, visible cancel when applicable.
- Scan: document/receipt preview with progressive extraction status.
- Notifications: background processing is not visually exposed until review; status lives in the queue if processing takes meaningfully long.
- Never show fake precision (“99.7% certainty”) unless confidence changes the user’s decision.

### Empty states

For a screen with no content, render `FeedbackState` in a non-scrollable `flex-1` view centered both horizontally and vertically. Keep a scroll container only for populated content; use an in-list empty state only when the surrounding screen has meaningful content that must remain visible.

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

### 7.12 Chat and companion presence

Chat is a dedicated capability, not the application’s control center.

- Default conversation layout is uncluttered, with clear human vs. Moni attribution.
- Moni can explain transactions, help draft budgets, and prepare transaction/debt records.
- A consequential Chat output is rendered as the same review artifact used elsewhere; the user must approve, modify, or decline.
- The future companion is a small brand presence: a greeting marker, processing companion, or empty-state moment. It never blocks amounts, occupies major persistent screen space, or replaces useful labels.
- Use a compact “Suggested action” card rather than forcing users into a conversational loop.

### 7.13 Debt component

Show direction explicitly:

- **You owe** — warm attentive peach/coral accent, relationship/person, amount, due date, and repayment progress.
- **Owed to you** — cool mint/aqua accent, same information model.

Do not turn either state into an error by default. Escalate only actual overdue/urgent states with clear copy and accessible iconography.

---

## 8. Screen recipes

### Home

1. Safe top area with a friendly time-aware greeting or concise title; optional discreet review indicator.
2. Net-worth hero plus native-currency scope.
3. Wallet/account balance visual.
4. Budget pulse / safe-to-spend summary.
5. Upcoming obligation or debt snapshot, when relevant.
6. Recent activity list.
7. FAB remains readily discoverable.

Home must remain useful when there are no pending proposals. Do not reserve a large empty review area.

### Insights

1. Title and local timeframe selector.
2. One primary answer card—monthly spending, cash flow, or category composition.
3. Activity/transaction drill-down.
4. Budget/category section with selectable progress details.
5. Calendar and monthly-analysis modules as lower content or dedicated routes.

Vary composition across insight screens; do not duplicate the Home layout with more charts.

### Chat

1. Quiet header with a small companion/brand cue.
2. Conversation area.
3. Suggested prompts based on user data only when privacy expectations permit.
4. Composer with text/voice access.
5. Consequential output enters the standard review experience.

### Profile

Use grouped settings cells, not dashboard cards. Organize into Accounts & wallets, Currencies, Categories, Capture sources, Privacy & local data, Appearance, and Accessibility.

---

## 9. Motion language

### Principles

Motion must communicate cause and effect, preserve spatial orientation, and feel responsive to touch. It should never make finance feel frivolous.

| Moment                 | Motion                                         | Intent                               |
| ---------------------- | ---------------------------------------------- | ------------------------------------ |
| FAB opens              | short spring + 40–70ms action-item stagger     | reveal a focused action set          |
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

- iOS: sheet gestures and hierarchy should feel at home; use tab navigation consistently. Apple explicitly distinguishes tab bars for top-level navigation from actions, so Moni’s FAB remains outside the tab model. See [Apple HIG: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars).
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
