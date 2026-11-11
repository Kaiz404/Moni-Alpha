# Redesign v2 tokens and component values

The measured values behind the canvas boards `V2F-Components`, `V2F-Bible` and `V2F-Nav`. Units are px at 1x on a 390 × 844 phone (dp in React Native). When this file and a board disagree, the board wins; report the drift so this file is fixed.

## Colour

| Role | Hex | Use |
| --- | --- | --- |
| Cream | #F6F2E9 | Screen ground (light grain, 6% multiply). Sheets. |
| Paper | #FFFDF8 | List cards, chart cards, icon bubbles on colour blocks. |
| Sand | #ECE5D6 | Chips, secondary buttons, tracks, pencil circle. |
| Sand light | #EFE8DA | Press fill, inner dividers, today's chart band. |
| Hairline | #DDD5C5 | 1.5 borders, outline tiles, gridlines. |
| Dashed outline | #B9B0A0 | Dashed empty tiles (`border-strong`). |
| Ink | #17181A | Text, primary buttons, tab bar, AI cards, Moni button. |
| Ink 2 | #4A463E | Secondary text, progress fill. |
| Meta | #6B665C | Meta text (min 12, never lighter). |
| Inactive on ink | #A9A397 | Inactive tab labels, even-pace line. |
| Deep mint | #236B47 | Money in, links, positive deltas, budget line label. |
| Mint | #A9DDB5 | Colour block, Approve, Groceries. |
| Mint key | #8ECF9D | The + button only. |
| Lemon | #F2DC72 | Colour block, warning, Subscriptions. |
| Lilac | #C9B6F0 | Review / AI, Moni glyph, Entertainment. |
| Peach | #F5BE98 | Colour block, Shopping. |
| Coral | #F1A399 | Food, over-budget fill. |
| Sky | #9FC4E8 | Transport. |
| Aqua | #9FDCD3 | Housing. |
| Over text | #B23E35 | Over-budget and destructive text. |

Pastels always carry ink text; their secondary text is #6B5410 on Lemon, #3E3654 on Lilac and #174831 on Mint in both themes (`on-lemon`, `on-lilac`, `on-mint`). Secondary text on an Ink card is #A9A397 and #EFE8DA (`on-ink-meta`, `on-ink-body`; dark #575653 and #2C2D2D on the cream card are not on a board). Category colours come from the category, never from a screen.

Dark (`V2F-Dark`): Ground #161512 · Raised #211F1B (cards) · Fill #2C2924 (Sand) · Track #26241F (Sand light, tracks) · Hairline #3A362F · Tab pill #2A2823 · Text #F3EEE3 · Text 2 #C7C0B2 · Meta #A39C8E · Inactive #9D968A · Contrast #EDE6D8 (the ink role: primary buttons, AI cards) · Money in #7FCF98 · Over #F0897E · Mint key #8ECF9D. Pastels deepen and keep #17181A text: Mint #8FC79D, Lemon #E0C85E, Lilac #B29DE0, Peach #E3A47E, Coral #DE8B80, Sky #86AED6, Aqua #82C7BD. `apps/mobile/global.css` holds both themes under the same names.

## Type

- One family: **Funnel Display** (300–800) for display, numbers, body and labels. Its figures already align; add `tabular-nums` only where a font fallback might not.
- Scale: hero 64/64 700 (whole-ringgit hero) · amount hero 52/54 700 (2-decimal hero) · screen title 28/32 700 · section title 22/26 700 · card title 18/22 700 · row title 16/22 600 · body 15/21 · meta 13/18 · smallest 12/16 (caps labels 12/700 +0.04em). Tracking −0.02em from 18 up, −0.03em on the hero, 0 below 18. Nothing below 12.

## Shape, space, elevation

- Radii: capsule 9999 (buttons, chips, pills, bars, tab items) · card 26 · outline tile 22 · inner element / field 16 · sheet top 32.
- Screen sides 20 · section gap 24 · card padding 18 · row padding 12 × 18 · icon bubble 42 · touch targets ≥ 44.
- No elevation on cards. Only the floating tab bar and sheets: `0 12 32 rgba(23,24,26,0.18)`.

## Page chrome

- Status-bar inset 48 on every full-screen page (use the real safe area in code). Header row 44 tall (y 48–92), sides 20; content from y 104.
- The header row scrolls away with the content on every scrolling page (owner's direction, 12 Nov 2026). The status-bar inset is padding above the header that scrolls away with it, so scrolled content passes under the status bar. Pages that don't scroll (Moni chat, Review, the amount page) keep a fixed header.
- Tab root title 28/32 700. Home header instead: 44 avatar (radius 16, Mint, initial 18/700) + date (13 Meta) over greeting (16/600), Moni button trailing.
- Pushed page: back = 44 circle, 1.5 Hairline border, chevron-left 22 ink; title 18/22 700 left-aligned; up to two trailing header buttons.
- Header icon button: 44 circle, 1.5 Hairline border, glyph 20 ink; pressed Sand fill, scale 0.97.
- Pressed fills, one step darker (`V2F-Components` Buttons): Ink #2E2F33, Sand to Hairline, Mint #9AD3A8, Mint key #7DC48D (the +, `V2F-Nav`), destructive fill #F9D5D0 to #F3C3BC (text #8E2F28), Paper rows to Sand light. Dark: destructive fill #43231F; the dark pressed fills (#D6CEBF, #80B98F, #532C27) are not on a board. The Moni glyph is #4B3A80 on the dark cream circle.
- ⋯ only in a header, only when the screen has secondary actions. Never on rows or cards. Transaction detail has none.
- Moni button: 44 Ink circle, `creation` 22 Lilac, Home and Activity headers only, trailing-most, label "Ask Moni". The only ink icon button.

## Navigation

- Floating ink pill: left 12, right 12, bottom 26, height 64, radius 32, five equal cells: Home (`home`) · Activity (`receipt-text`) · + · Budget (`chart-box`) · Debts (`handshake-outline`). Active cream icon + label, inactive #A9A397, labels 11/600.
- Centre +: 60 Mint key circle in a 72 touch area, top 16 above the pill, no ring; never an active state. It stays a circle when pressed (owner's direction, 12 Nov 2026). Opens the + chooser sheet; it rotates 45° into the sheet's ×.
- Pushed pages and Moni chat have no tab bar.

## Lists and rows

- Paper list card radius 26, no padding, no borders or dividers. Rows reach its edges and keep their own padding; the card clips them to its corners (owner's direction, 1 Nov 2026).
- Transaction row 66 tall: 42 tint bubble, title 16/600 one line, meta 13 Meta, amount 16/600. No chevron, no ⋯; the whole row opens the detail. Meta: "Category · Wallet" in day-grouped lists, otherwise "Date · Wallet". Transfers "Maybank → Touch 'n Go". "Auto" pill (20 tall Sand, 12/700 Ink 2) first in the meta. Pending: dashed bubble, "To review" pill, unsigned amount in Ink 2.
- Navigation row (settings, lists of places): trailing value 15 Ink 2, then chevron-right 20 Meta.
- Press: fill Sand light, scale 0.97 on the press spring, release on control. A row in a list card or menu does not scale, and its fill reaches the card's edges. A press with no corners and no row around it draws no fill.
- Hold (500 ms; bloom from the finger from 250 ms in #E3D8C2 (`bloom`; dark #3A362F is not on a board), Confirm haptic, row lifts 1.02): menu Paper radius 22, 220 wide, items 44 tall: Edit category, Change wallet, Delete (Over text). Nothing else. A one-time hint chip "Hold a row for quick actions" teaches it.

## In-place edit (existing values on detail pages)

- Pencil: 32 Sand circle, `pencil-outline` 16, 8 after the value, 44 hit area. Tapping the value also edits.
- Field: Paper, 2 ink border, radius 16. Amount 64 tall (sign + "RM" 28/700 Meta, digits 40/44 700). Name 52 tall, 18/600.
- Then cancel (44 Sand circle, close) and save (44 Ink circle, check). One field at a time; the rest of the page stays at full opacity; back or tapping outside cancels.
- Motion: value and field cross-fade (200 in, 160 out) while the height follows the `sheet` spring and the content below reflows with it. The field settles from scale 0.98; cancel and save slide 12 in from the trailing edge at 30 and 70 delays. Under Reduce Motion only the fades run.
- The phone's own keyboard (numeric for amounts). Never a custom keypad or a sheet holding one.
- Saved toast: Ink capsule ≥ 56 tall, check-circle Mint, text 14/19 cream, Undo button (Mint text, `on-ink-positive`; dark #236B47 on the light capsule is not on a board). 4 s, with a 3 tall `on-ink-positive` bar along the bottom edge that runs out with the time left (owner's direction, 1 Nov 2026; the board has 5 s and no bar).
- New money (a capture, a repayment, lending more, a new bill or debt) uses the full amount page instead (keypad page that slides in from the right). A fixed set (category, wallet, date) uses a picker sheet.

## Sheets

- Cream, top radius 32 (the Cream carries on below the sheet's bottom edge, so the spring's overshoot and an upward drag never show the page), grabber 36 × 5 Hairline, title 22/26 700, a bare close glyph in a 44 touch area for pickers (owner's direction, 1 Nov 2026). Pinned action 56 tall, 20 from sides and bottom.
- Scrim rgba(23,24,26,0.32) over the page **and the tab bar**. Only the + (as ×) stays visible when the sheet came from the +.
- Pickers use the category grid: 52 search field, 3 columns, Paper tiles radius 22, 44 bubble, name 14/600, 4 bar, "RM100 left" / "RM20 over".
- + chooser: "Add a transaction"; four Paper capsule rows 60 tall, no subtitles: Type it (Mint, `dialpad`), Scan a receipt (Peach, `line-scan`), Say it (Sky, `microphone`), Ask Moni (Ink bubble, `creation` Lilac). Choosing one dismisses the sheet and slides the page in from the right.

## Progress

- Bar: Sand track, Ink 2 fill = spent ÷ budget. Over budget: 100% Coral fill and "RM20 over" 700 Over text. Never past the track, no pace tick, no split fill. 8 tall in rows, 4 in picker tiles, 12 for the category page hero. At ≥ 75% the label turns #6B5410.
- Ring (Budget tab root only): 44 box, stroke 5, Sand track, Ink 2 fill from 12 o'clock, tint bubble inside. Over: full Coral ring and "RM20 over".

## Charts

All inside a Paper card (radius 26, padding 14 18), plot 314 × 150, axis column 44 (labels right-aligned 12 Meta).

- Card header: caps label left, chart toggle right (Sand track 36 tall, Ink pill on the control spring, segments ≥ 70: Pace | Daily; Segment_Tick on change). A spent-vs-budget card has no header number, because the callout and the budget line already show it; "RM317 left for 18 days · RM17 a day" sits below the chart in both modes (owner's direction, 1 Nov 2026).
- Gridlines: top and baseline solid 1.5 Hairline; middle dashed Sand light.
- Callout (one shape everywhere): Ink box radius 12, 100 × 38 at the top of the plot, date 12 over value 14/700 cream, dashed ink guide to the point.
- Spent vs budget line (Home Pace, category page): Ink 3 line, Sand fill at 0.8 up to today; even pace #A9A397 dashed from 0 to the budget at month end; budget as the top gridline with a Deep mint label and end dot; today point 14 Ink dot with cream border; scrub handle 28 × 20 Ink capsule. No projection line.
- Spending ring (Budget root, owner's direction, 2 Nov 2026): box 284, centre line radius 124, stroke 34, round caps, 10 clear between any two neighbours, biggest first clockwise from 12 o'clock. Visible length (sweep plus caps) follows the share; the smallest keeps a 2° sweep, at most 8 arcs with the smallest folded into a last "Other" (`dots-horizontal`, Hairline; dark Inactive). Arcs wear the category's solid colour, never the 45% bubble tint; dark deepens it 12%. Glyph 20 #17181A on the arc. Centre: digits 46/50 700 with symbol and cents 18 Meta, then "of RM1,800" 13 Meta, or "RM20 over" 13/700 Over, or "spent" with no budget. Selected: stroke +4, others 60%, centre fades in over 140 ms with amount, name 15/600 and "31% of spending"; Segment_Tick on change. Empty: Sand circle and "RM0". First show sweeps from 12 o'clock on `value`, once a session; a month that keeps the order springs to new lengths, one that reorders fades over 180 ms, as Reduce Motion does.
- Daily bars (Home Daily, Activity Spending): one 12-wide Ink bar per day so far, the part above even pace in Coral; even pace dashed line labelled "RM58"; today on a Sand light band with a dashed segment for safe to spend a day. No future bars.
- Balance line (Activity Balance, wallet page): the line chart without budget or even pace; axis does not start at 0 (say so in the accessibility label); main-currency wallets only.
- Net worth chart (Wallets, owner's direction, 2 Nov 2026): the first day of the range on the left edge, today on the right, whatever the range. Range chips under the plot (1M, 7D, 30D, 90D, 1Y, All; compact Segmented, 36 tall), shared with Home's spent card. A wallet with no history yet shortens the range rather than drawing a flat line before it existed. Total | By wallet toggle in the header. Total is the Ink 3 line with Sand fill. By wallet is one 2.5 line per wallet in the deeper chart step of its colour (`walletLineColor`), a dash pattern for wallets sharing a colour, and a key of line sample, short name and value under the chips; the key reads the scrubbed day. Range and view changes redraw left to right on the value spring (fade under Reduce Motion).
- Captions: no chart has a legend or a "Tap or drag" hint (owner's direction, 1 Nov 2026); the By wallet key on the net worth chart is the one exception, since its lines need names. No readout rows, no ‹ › buttons, no pace pills.
- Lines draw in once on first open (value spring); bars grow 14 ms apart; never on return or refresh. Scrub snaps per day with Segment_Tick.

## Approvals (Review card)

- Paper card radius 26, always 560 tall, clamped to the deck (owner's direction, 2 Nov 2026): source row (36 installed app icon on a notification capture, with the bell as its fallback; "Maybank alert", time, "Usual for you" pill), quoted alert text, merchant and amount each with a pencil (in place) centred in the space left, one rounded group of 48 rows (label on the left, 28 bubble, name and chevron on the right; Type, Category, Wallet, or Type, Wallet, Moves to on a transfer; a picker sheet each, Lemon capsule when empty), the duplicate or pairing explanation when there is one, the pair control, "Don't ask about similar" checkbox (22 box, radius 6). Merchant one line, amount auto-fits, quote up to 3 lines, explanation up to 2. When the height runs short the quote gives way first, then the explanation, then the checkbox; the rows and the pair control never do. No AI reasoning line and no budget pill (owner's direction, 2 Nov 2026).
- The card sits centred in the page below the header, keeping 44 under it for the Later cue and 60 at the bottom for Recently reviewed. Swipe right Approve (Confirm), left Not mine (Reject), down Later, with no buttons (owner's direction, 2 Nov 2026); a screen reader gets the three as actions on the source row, Approve reading "Pick wallet" with no wallet. Edge cues "Not mine" left, "Approve" right, centred on the card, and "Later" 12 under it.
- Under the top card, the next card with its real content at scale 0.96, mounted before the top card moves and the same mounted card once on top (replaces D7). It stays at opacity 0 until the top card has moved 8% of the way to 45% of the card width, and grows to 1 as the top card leaves.
- Swipe selection, on finger distance alone while held: a side leans past 16 and lets go under 8. Its option engages at the finger travel `max(20, min(45% of the card along its axis, 60% of the room from the touch to that screen edge))` (Toggle_On, once), so a finger starting near an edge still reaches it. It holds down to `min(7/9 of that, that − 12)` (Toggle_Off), 35% of the card at full distance. Another side takes over only when it leads by `clamp(16% of the engage distance, 12, 24)`.
- Release: the engaged option commits, unless flung back at 800/s or more. With nothing engaged, a fling at 800/s or more commits the way x + 0.5·v points, once it has moved the card 12%.
- Undo: the card slides back on `sheet` from where it left, right for Approve, left for Not mine, below for Later, by swipe or button; the card it covers settles from 1 to 0.96 under it. Same payment and reduced motion fade in over 180 ms.

## Motion

Springs (mass 1):

| Token | Use | stiffness / damping | Overshoot |
| --- | --- | --- | --- |
| press | press squish, colour, digit roll | 1600 / 80 | 0 |
| value | lines, bars, rings, anything encoding money | 700 / 47.6 | ~0.1% |
| control | segmented pill, tab pill, + morph | 800 / 33.9 | ~9% |
| sheet | sheets, cards expanding in place | 380 / 31.2 | ~1.4% |
| throw | snap-back after a fling | 157.9 / 17.6 | ~4.5% |
| drag | finger-tracked | 1:1, no spring | none |

- Bounce belongs to containers, never values. Every animation is interruptible. Sheets decide flings on projected position (x + 0.5·v), threshold 40%; the Review deck has its own rule under Approvals.
- One expressive moment per screen. Nothing loops on screens showing balances.
- A number is never hidden or moving for more than ~200 ms; no digit roll on first paint.
- Lists: first 6 rows rise 8 + fade, 30 ms apart, on first load only.
- Reduce motion: slides and scales become 150–200 ms fades, no bounce, 1:1 tracking kept.
- Theme reveal (owner's direction, 12 Nov 2026): picking Light, Dark or System opens the new theme as a circle from the centre of the picked option, over a still of the old one, ease-in-out (0.77, 0, 0.175, 1) for 450 ms, until it covers the farthest corner; the status bar keeps the old icons until it ends. One reveal at a time: a pick during one recolours under it. Animations off: the still fades in 180 ms. iOS switches at once.

## Haptics (expo-haptics; Android constant, iOS equivalent)

| Moment | Android | iOS |
| --- | --- | --- |
| Keypad digit | Keyboard_Tap | none |
| Approve | Confirm | success notification |
| Not mine | Reject | light impact |
| Swipe crosses the commit threshold | Toggle_On / Toggle_Off | light impact |
| Chart scrub step | Segment_Tick | selection |
| Toggle | Toggle_On / Toggle_Off | selection |
| Row hold commits | Confirm | medium impact |
| Segmented pill picked up for a glide | Drag_Start | light impact |
| Glided pill reaches an option | Segment_Tick | selection |
| Glided pill lands | Gesture_End | light impact |

At most one haptic per user action; a glide is one action with a tick per option it crosses, like a picker. expo-haptics 57 has no Gesture_Threshold constants.
