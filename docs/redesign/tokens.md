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

Pastels always carry ink text. Category colours come from the category, never from a screen.

Dark (`V2F-Dark`): Ground #161512 · Raised #211F1B (cards) · Fill #2C2924 (Sand) · Track #26241F (Sand light, tracks) · Hairline #3A362F · Tab pill #2A2823 · Text #F3EEE3 · Text 2 #C7C0B2 · Meta #A39C8E · Inactive #9D968A · Contrast #EDE6D8 (the ink role: primary buttons, AI cards) · Money in #7FCF98 · Over #F0897E · Mint key #8ECF9D. Pastels deepen and keep #17181A text: Mint #8FC79D, Lemon #E0C85E, Lilac #B29DE0, Peach #E3A47E, Coral #DE8B80, Sky #86AED6, Aqua #82C7BD. `apps/mobile/global.css` holds both themes under the same names.

## Type

- One family: **Funnel Display** (300–800) for display, numbers, body and labels. Its figures already align; add `tabular-nums` only where a font fallback might not.
- Scale: hero 64/64 700 (whole-ringgit hero) · amount hero 52/54 700 (2-decimal hero) · screen title 28/32 700 · section title 22/26 700 · card title 18/22 700 · row title 16/22 600 · body 15/21 · meta 13/18 · smallest 12/16 (caps labels 12/700 +0.04em). Nothing below 12.

## Shape, space, elevation

- Radii: capsule 9999 (buttons, chips, pills, bars, tab items) · card 26 · outline tile 22 · inner element / field 16 · sheet top 32.
- Screen sides 20 · section gap 24 · card padding 18 · row padding 12 × 18 · icon bubble 42 · touch targets ≥ 44.
- No elevation on cards. Only the floating tab bar and sheets: `0 12 32 rgba(23,24,26,0.18)`.

## Page chrome

- Status-bar inset 48 on every full-screen page (use the real safe area in code). Header row 44 tall (y 48–92), sides 20; content from y 104.
- Tab root title 28/32 700. Home header instead: 44 avatar (radius 16, Mint, initial 18/700) + date (13 Meta) over greeting (16/600), Moni button trailing.
- Pushed page: back = 44 circle, 1.5 Hairline border, chevron-left 22 ink; title 18/22 700 left-aligned; up to two trailing header buttons.
- Header icon button: 44 circle, 1.5 Hairline border, glyph 20 ink; pressed Sand fill, scale 0.97.
- Pressed fills, one step darker (`V2F-Components` Buttons): Ink #2E2F33, Sand to Hairline, Mint #9AD3A8, destructive fill #F9D5D0 to #F3C3BC (text #8E2F28), Paper rows to Sand light. Dark: destructive fill #43231F; the dark pressed fills (#D6CEBF, #80B98F, #532C27) are not on a board. The Moni glyph is #4B3A80 on the dark cream circle.
- ⋯ only in a header, only when the screen has secondary actions. Never on rows or cards. Transaction detail has none.
- Moni button: 44 Ink circle, `creation` 22 Lilac, Home and Activity headers only, trailing-most, label "Ask Moni". The only ink icon button.

## Navigation

- Floating ink pill: left 12, right 12, bottom 26, height 64, radius 32, five equal cells: Home (`home`) · Activity (`receipt-text`) · + · Budget (`chart-box`) · Debts (`handshake-outline`). Active cream icon + label, inactive #A9A397, labels 11/600.
- Centre +: 60 Mint key circle, top 16 above the pill, 6 cream ring; never an active state. Opens the + chooser sheet; it rotates 45° into the sheet's ×.
- Pushed pages and Moni chat have no tab bar.

## Lists and rows

- Paper list card radius 26, padding 6 0, no borders or dividers.
- Transaction row 66 tall: 42 tint bubble, title 16/600 one line, meta 13 Meta, amount 16/600. No chevron, no ⋯; the whole row opens the detail. Meta: "Category · Wallet" in day-grouped lists, otherwise "Date · Wallet". Transfers "Maybank → Touch 'n Go". "Auto" pill (20 tall Sand, 12/700 Ink 2) first in the meta. Pending: dashed bubble, "To review" pill, unsigned amount in Ink 2.
- Navigation row (settings, lists of places): trailing value 15 Ink 2, then chevron-right 20 Meta.
- Press: fill Sand light, scale 0.97 on the press spring, release on control.
- Hold (500 ms; bloom from the finger from 250 ms, Confirm haptic, row lifts 1.02): menu Paper radius 22, 220 wide, items 44 tall: Edit category, Change wallet, Delete (Over text). Nothing else. A one-time hint chip "Hold a row for quick actions" teaches it.

## In-place edit (existing values on detail pages)

- Pencil: 32 Sand circle, `pencil-outline` 16, 8 after the value, 44 hit area. Tapping the value also edits.
- Field: Paper, 2 ink border, radius 16. Amount 64 tall (sign + "RM" 28/700 Meta, digits 40/44 700). Name 52 tall, 18/600.
- Then cancel (44 Sand circle, close) and save (44 Ink circle, check). One field at a time; the rest of the page stays at full opacity; back or tapping outside cancels.
- The phone's own keyboard (numeric for amounts). Never a custom keypad or a sheet holding one.
- Saved toast: Ink capsule ≥ 56 tall, check-circle Mint, text 14/19 cream, Undo button (Mint text). 5 s.
- New money (a capture, a repayment, lending more, a new bill or debt) uses the full amount page instead (keypad page that slides in from the right). A fixed set (category, wallet, date) uses a picker sheet.

## Sheets

- Cream, top radius 32, grabber 36 × 5 Hairline, title 22/26 700, 44 close for pickers. Pinned action 56 tall, 20 from sides and bottom.
- Scrim rgba(23,24,26,0.32) over the page **and the tab bar**. Only the + (as ×) stays visible when the sheet came from the +.
- Pickers use the category grid: 52 search field, 3 columns, Paper tiles radius 22, 44 bubble, name 14/600, 4 bar, "RM100 left" / "RM20 over".
- + chooser: "Add a transaction"; four Paper capsule rows 60 tall, no subtitles: Type it (Mint, `dialpad`), Scan a receipt (Peach, `line-scan`), Say it (Sky, `microphone`), Ask Moni (Ink bubble, `creation` Lilac). Choosing one dismisses the sheet and slides the page in from the right.

## Progress

- Bar: Sand track, Ink 2 fill = spent ÷ budget. Over budget: 100% Coral fill and "RM20 over" 700 Over text. Never past the track, no pace tick, no split fill. 8 tall in rows, 4 in picker tiles, 12 for the category page hero. At ≥ 75% the label turns #6B5410.
- Ring (Budget tab root only): 44 box, stroke 5, Sand track, Ink 2 fill from 12 o'clock, tint bubble inside. Over: full Coral ring and "RM20 over".

## Charts

All inside a Paper card (radius 26, padding 14 18), plot 314 × 150, axis column 44 (labels right-aligned 12 Meta).

- Card header: caps label left, chart toggle right (Sand track 36 tall, Ink pill on the control spring, segments ≥ 70: Pace | Daily, Spending | Balance; Segment_Tick on change).
- Gridlines: top and baseline solid 1.5 Hairline; middle dashed Sand light.
- Callout (one shape everywhere): Ink box radius 12, 100 × 38 at the top of the plot, date 12 over value 14/700 cream, dashed ink guide to the point.
- Spent vs budget line (Home Pace, Budget root, category page): Ink 3 line, Sand fill at 0.8 up to today; even pace #A9A397 dashed from 0 to the budget at month end; budget as the top gridline with a Deep mint label and end dot; today point 14 Ink dot with cream border; scrub handle 28 × 20 Ink capsule. No projection line.
- Daily bars (Home Daily, Activity Spending): one 12-wide Ink bar per day so far, the part above even pace in Coral; even pace dashed line labelled "RM58"; today on a Sand light band with a dashed segment for safe to spend a day. No future bars.
- Balance line (Activity Balance, wallet page): the line chart without budget or even pace; axis does not start at 0 (say so in the accessibility label); main-currency wallets only.
- Captions: legend left, "Tap or drag" / "Tap a bar" right. No readout rows, no ‹ › buttons, no pace pills.
- Lines draw in once on first open (value spring); bars grow 14 ms apart; never on return or refresh. Scrub snaps per day with Segment_Tick.

## Approvals (Review card)

- Paper card radius 26: source row (bubble, "Maybank alert", time, "Usual for you" pill), quoted alert text, merchant and amount each with a pencil (in place), category and wallet chips (picker sheets), evidence line, "Don't ask about similar" checkbox (22 box, radius 6), result pill ("Food & Dining: RM76.80 left after this").
- Three equal 52-tall buttons: Not mine · Later · Approve (Mint). Swipe right Approve (Confirm), left Not mine (Reject), down Later; Toggle_On at 40% projected. Edge cues "Not mine" left, "Approve" right. No peek of the next card.

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

- Bounce belongs to containers, never values. Every animation is interruptible. Flings decide on projected position (x + 0.5·v), threshold 40%.
- One expressive moment per screen. Nothing loops on screens showing balances.
- A number is never hidden or moving for more than ~200 ms; no digit roll on first paint.
- Lists: first 6 rows rise 8 + fade, 30 ms apart, on first load only.
- Reduce motion: slides and scales become 150–200 ms fades, no bounce, 1:1 tracking kept.

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

At most one haptic per user action. expo-haptics 57 has no Gesture_Threshold constants.
