# Moni Design Language

**Version:** 1.0  
**Status:** product direction and agent reference  
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

Moni is **cross-platform premium neutral**, built with Expo React Native and NativeWind/Tailwind bindings, with an iOS-quality visual bar and Android-quality expressive feedback.

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

| Token      | Value | Use                            |
| ---------- | ----: | ------------------------------ |
| `space-1`  |     4 | icon/text optical adjustment   |
| `space-2`  |     8 | tight related elements         |
| `space-3`  |    12 | field internals, list metadata |
| `space-4`  |    16 | standard component padding     |
| `space-5`  |    20 | screen gutter, grouped content |
| `space-6`  |    24 | major section spacing          |
| `space-8`  |    32 | major screen rhythm            |
| `space-10` |    40 | hero-to-body separation        |

- Prefer a single clean content plane over nested cards.
- Use one strong focal block per viewport, especially on Home and review screens.
- Financial dense areas may use compact list rows, but never compensate by shrinking body text below legibility.
- Keep touch targets at least 44 × 44pt; use visual size smaller than touch size when needed.

### 5.2 Shape

The system is rounded and soft, not cartoonishly pill-shaped.

| Token         | Value | Use                                   |
| ------------- | ----: | ------------------------------------- |
| `radius-sm`   |    10 | compact chips, small thumbnail frames |
| `radius-md`   |    16 | input fields, list-group containers   |
| `radius-lg`   |    22 | cards, wallet tiles, sheets           |
| `radius-xl`   |    28 | hero panels, large review artifacts   |
| `radius-full` |   999 | avatar, FAB, icon button only         |

Use pills sparingly: filter states, segmented controls, compact metadata, and the FAB label. Do not turn every card and button into a pill.

### 5.3 Elevation and material

Content surfaces are matte. Establish depth with tonal separation, thin hairlines, and restraint—not heavy shadows.

- Base background: near-white/near-black with **1–2% tactile grain or fog** where technically practical.
- Default card: opaque surface with 1px low-contrast border; no permanent heavy shadow.
- Raised transient element: a short soft shadow plus surface lift; reserve it for FAB menus, sheets, and active draggable controls.
- Glass/translucency: permitted only in navigation/transient controls where contrast is preserved. Never put core financial content inside decorative glass.

### 5.4 Typography

Use the platform system font family where possible: SF-family behavior on iOS and Roboto-family behavior on Android, locked to a shared scale and hierarchy.

| Style           | Size / line |  Weight | Use                                                                |
| --------------- | ----------- | ------: | ------------------------------------------------------------------ |
| Display         | 34 / 40     |     700 | net worth, page hero; use sparingly                                |
| Title 1         | 28 / 34     |     700 | major screen title                                                 |
| Title 2         | 22 / 28     | 650–700 | card/section title                                                 |
| Headline        | 17 / 22     |     650 | emphasis in rows and proposals                                     |
| Body            | 16 / 22     | 400–500 | default explanatory content                                        |
| Callout         | 15 / 20     |     500 | supporting financial context                                       |
| Label           | 13 / 17     |     600 | metadata, chart keys, button support                               |
| Caption         | 12 / 16     |     500 | timestamps and tertiary context; never essential information alone |
| Numeric display | inherit     | 600–700 | use tabular figures when supported                                 |

- Use tabular/monospaced numerals for aligned financial lists and calendar values.
- Let large amounts wrap or abbreviate predictably; never reduce type to preserve a layout.
- Dynamic Type is mandatory. Critical cards must reflow vertically instead of clip.

### 5.5 Iconography

Use simple, warm line icons with rounded terminals and a consistent optical weight. Use native symbol assets when they fit; customize the set’s stroke and fill behavior rather than mixing unrelated libraries.

- Icons support labels; they do not replace them for finance-critical actions.
- Category icon + category color is a recurring recognition pair.
- Use filled icon treatment only for selected/active state or high-emphasis status.
- Avoid generic robot/sparkle overload for AI. The future companion or a restrained sparkle/accent may signal assistance.

---

## 6. Color system

### 6.1 Palette logic

The palette is **neutral-led with disciplined pastels**. Mint is the brand anchor; violet/lilac, peach, lemon, coral, and aqua are semantic/category accents. A screen normally uses neutral surfaces plus one dominant expressive accent and at most two supporting category colors.

Exact contrast-adjusted variants must be verified in both themes; hexes below are starting points, not permission to ship low-contrast combinations.

| Role          | Light starting point | Dark starting point | Purpose                             |
| ------------- | -------------------- | ------------------- | ----------------------------------- |
| Canvas        | `#F7F7F2`            | `#141513`           | warm off-white / carbon background  |
| Surface       | `#FFFFFF`            | `#1D1F1C`           | cards, grouped content              |
| Surface muted | `#EFF0EA`            | `#282A27`           | secondary fills, input background   |
| Ink primary   | `#1E211E`            | `#F4F5EF`           | primary text, key amounts           |
| Ink secondary | `#60665E`            | `#B9BDB5`           | supporting text                     |
| Divider       | `#DEE1D9`            | `#343732`           | hairlines                           |
| Brand mint    | `#8ECF9D`            | `#79C98A`           | positive/action anchor              |
| Mint deep     | `#236B47`            | `#A9E8B5`           | text/icon on mint-adjacent surfaces |
| Lilac         | `#C9B7F4`            | `#BDA7EF`           | discovery/voice/category accent     |
| Peach         | `#F7C6A8`            | `#E9A77F`           | warmth/attention/category accent    |
| Lemon         | `#F1DC78`            | `#D9BC4D`           | highlight/progress/category accent  |
| Coral         | `#F19A91`            | `#E98780`           | spending/attention/category accent  |
| Aqua          | `#9CD9D1`            | `#7DC7BE`           | account/category accent             |

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

Each category gets one stable color and icon. Do not reassign colors per chart. Category hue may appear in a 12–16% tint for rows and cards, 100% saturation for chart segments, and a deep accessible companion for text/icon use.

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

Use the Moni mint, lilac, peach, lemon, coral, aqua, and neutral palette for wallet identity. Gradients may gently pair a matte neutral with one of those accents, but do not use a grain mask or payment-card-like texture. Ensure wallet labels and native balances use an accessible foreground chosen for the selected surface.

Never mimic real payment cards unless users need a real card identifier. The visual job is balance recognition, not faux banking branding.

### 7.5 Budget pulse and category progress

- A category row displays icon, name, used amount, remaining amount, and a clear progress treatment.
- On select, expand or navigate to a detail that states: “$186 of $300 used · 62%.” This follows the board’s desired category-percentage insight.
- Use a progress line/ring only with its textual amount and percentage.
- The warning threshold is contextual; do not make the whole card red at 80% by default.

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

### 7.10 Processing state

Processing must feel fast, transparent, and controlled.

- Voice: centered waveform/gradient field, concise status, visible cancel when applicable.
- Scan: document/receipt preview with progressive extraction status.
- Notifications: background processing is not visually exposed until review; status lives in the queue if processing takes meaningfully long.
- Never show fake precision (“99.7% certainty”) unless confidence changes the user’s decision.

### 7.11 Charts and insights

Charts exist to answer a question.

| Chart                        | Question                                | Rule                                                                                            |
| ---------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Category composition / donut | “Where did this month’s money go?”      | Use category colors and icons only where segments are large enough. Provide a list alternative. |
| Spending trend / line        | “Am I spending more or less over time?” | One meaningful series by default; tap/drag reveals a value.                                     |
| Budget progress              | “How close am I to my limit?”           | Pair progress with used/remaining amounts.                                                      |
| Calendar                     | “When did spending or bills happen?”    | Dots/heat reveal activity; selection reveals a detail list.                                     |
| Wallet balance comparison    | “Where is my money held?”               | Preserve original currencies; do not compare incompatible currencies as a false total.          |

Keep chart controls local and obvious: timeframe, category, wallet. Avoid chart walls. Pair every chart with one plain-language takeaway or drill-down path.

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
| Tap/click              | immediate scale/tint feedback                  | confirm the interface received input |
| Receipt processing     | subtle progress/wave/gradient movement         | show active work without fake drama  |
| Proposal enters review | source context visually resolves into artifact | reinforce provenance                 |
| Sheet opening          | anchored rise, light scrim                     | retain context                       |
| Chart selection        | color/label emphasis and value reveal          | bind data point to explanation       |
| Approve                | brief check/mint confirmation then return      | acknowledge deliberate completion    |

### Timing guidance

- Direct tap feedback: 80–120ms.
- Small opacity/position transition: 160–220ms.
- Sheet/full-screen presentation: 240–320ms.
- Expressive spring: short, low overshoot; it must settle quickly.
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
- Dark mode uses charcoal surfaces, not pure black everywhere; reserve near-black for canvas/immersive capture states.
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
bg.canvas / bg.surface / bg.surface-muted
text.primary / text.secondary / text.inverse
border.subtle / border.strong
brand.mint / brand.mint-ink
category.food / category.transport / category.shopping …
state.pending / state.attention / state.approved / state.destructive
radius.sm / radius.md / radius.lg / radius.xl
space.1 … space.10
motion.fast / motion.standard / motion.sheet
```

Do not name UI tokens after a one-off visual result (`purpleCard`, `greenButton2`, `chartBlue`).

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
