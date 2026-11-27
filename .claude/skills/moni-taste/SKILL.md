---
name: moni-taste
description: The Moni owner's design taste as rules with a do, a don't, a real before and after, and the owner's words. Use before designing, building, reviewing or filing anything a user sees in the Moni phone app, the web app or the design canvas, and when checking screenshots in moni-verify.
---

# Moni taste

The owner judges Moni as a user holding the phone: what fits on the first screen, what reads as clutter, what looks "AI-made". These rules come from the owner's issues, canvas comment threads and phone reviews (Oct to Nov 2026). They hold on the phone, the web and the canvas. The rule `.cursor/rules/project-overview.mdc` keeps those three in step.

Screen-by-screen specs stay where they are. This file does not repeat them.

- `docs/REDESIGN.md` "Rules that apply to every screen" covers the phone.
- `docs/WEB.md` "Phone rules the web bends" covers the web.
- `docs/redesign/glossary.md` holds the words and `docs/redesign/tokens.md` the values.

When the owner gives new design feedback, add or sharpen a rule here in the same pass, and add a check when a parser could see it.

## Checks

| Check | Rules it enforces | Run |
| --- | --- | --- |
| `apps/mobile/scripts/lint/check-taste.mjs` | sparkle icon, confirm dialog, text arrow (phone and web), native control (web) | `pnpm --filter moni lint:taste` (in `scripts/verify/gate.sh`) |
| `apps/mobile/scripts/lint/copy-rules.mjs` | glossary words, Archive, gesture hints, money and date format, middle dot (phone, shared packages and web) | `pnpm --filter moni lint:copy` and `pnpm --filter web lint:copy` (both in the gate) |
| `~/.local/share/moni-canvas/tools/lint_terms.py` | the same words on canvas boards | before publishing boards |
| Screenshot review | everything else below | `moni-verify` step 5 |

Known breaks are listed in `taste-allow.txt`, each with an open issue. The list only shrinks.

## Words

**1. Say it once.** The owner reads restating text as clutter.
- Do: keep only what the screen does not already show.
- Don't: add subtitles under simple rows, a summary line under a card, chart legends, "Tap or drag" hints, or a header number the chart already shows.
- Example: transaction meta "Mon 16 Nov · 8:48 pm · Alert says X" became the date and time only (#33). "Add a receipt photo / Keeps the slip with this transaction" became "Add a receipt photo" (#35). Budget previews that each said "nothing in October by now" lost the line (#49).
- Owner: "Remove this clutter text." "the charts dont need to have the 'Tap or Drag' text because that is already sort of implied"

**2. A sheet is a title and one short line.**
- Do: title, then at most one plain sentence.
- Don't: list the screens a setting affects, add footnotes, or explain how Moni works.
- Example: the Main currency sheet's list of screens and "Only currencies you hold a wallet in…" footnote became "The whole app uses this currency." (#75). Delete your account went from six rows to one line (#74).
- Owner: "It should just be simple. It should be not too verbose."

**3. The user's word, and labels that fit.**
- Do: name the action by what it does for the user, and use a short generic verb when a specific one would truncate.
- Don't: use internal or technical terms (`glossary.md` "Never use"). Don't build a button label from the form's values (a name, an amount, a date): the page already shows them, and a long value truncates the button (#137).
- Example: "Archive" became "Delete" (#8). The button "Make it an expe…" became "Confirm" (#37), and so did "Use this place". "Start with a clearer view" became "Create your Moni account" (#67). "Record: Great Eastern owes you RM1,275.…" is to become "Record" (#137).
- Owner: "from a user's perspective, it's effectively delete" "allowing the confirm button to be like free to form however they want makes it so that the button could have text that is like wrapped or truncated"

**4. No middle-dot separators.**
- Do: put two facts in two places (the right side, a second line), or set them apart with weight, colour or plain words.
- Don't: join text with " · ".
- Example: "5 wallets · RM2,555.40" became "5 wallets with RM2,555.40", "Bill · every month" became "Monthly bill", and "Today · 12:41 pm" became "Today at 12:41 pm" (#76). The copy lint fails on the dot in any string on the phone, the shared packages and the web. Review's "No category · MAE" became the category and the wallet, each with its small bubble, and "6 waiting · oldest first" became the count and a sort control (#119).
- Owner on #119: "different categories should have different ways to be showcased entirely"
- Owner: "I think it looks very AI-like… Feels a bit kind of sloppy."

**5. Nothing that looks AI-generated.**
- Do: draw an arrow as the `arrow-right` icon, and mark Moni with the cat (`Mascot`, `MoniGlyph`, `webkit.moni()`).
- Don't: use the text arrow "→", four-point sparkles (`creation`, `star-four-points`, `auto-fix`, `shimmer`), robot glyphs, or a bot mascot.
- Example: transfer meta "Maybank → Touch 'n Go" became wallet, arrow icon, wallet (#39). The sparkle Moni button and every sparkle mark became the cat (`520f8df8`, `cbc69b85`).
- Owner: "remove the diamond shaped sparkle. I feel like that is very generically AI looking." "I dont like a design of a bot, it feels too 'generically AI'."

**6. No dot-and-label status chips.**
- Do: say a status through the title, text weight, colour or an icon.
- Don't: use a capsule with a coloured dot and a label ("• Looks like a duplicate", "• RM500 unassigned").
- Example: the duplicate sheet's "• Looks like a duplicate" chip went, since the title says it, and Edit budgets' "• RM500 unassigned" became coloured bold text (#85). `StatusText` says a status in its tone's colour and weight. `StatusPill` is now only the 20-tall meta pill (Auto, To review, Not mine) with no dot and no `standalone` variant, so the type check refuses a chip. The web's `tone-pill` is coloured text.
- Owner: "the chip looks very sloppy"

## Layout

**7. Nothing moves after a tap.** Cards keep a fixed size, and actions never appear or collapse inside the content.
- Do: put a detail page's actions in `PageActions`, pinned under the scroll. A state change swaps what the bar holds in place.
- Don't: show buttons in the content that appear, grow or collapse.
- Example: the bill page's Mark as paid moved from inline buttons into the pinned bar, and the bill and debt pages now share one structure (#82, #86).
- Owner: "I don't want like changing, like collapsing in UI buttons to appear within the page… it messes up with the layout."

**8. One look per kind of control.**
- Do: give every field of one kind one style app-wide. Controls in a group share one shape, width and height, and the whole row is the hit area.
- Don't: mix chips, half-width fields and odd widths in one form.
- Example: web detail pane Category, Wallet, Type and Date at four widths (#100). Dropdown options only as wide as their text (#98). Bill and debt fields unlike the rest of the app (#84).
- Owner: "Please keep everything consistent and equal width." "even if the cursor hovers on the white space… it should select"

**9. Destructive actions sit top right and ask in a sheet.**
- Do: use a 44 round trash (or ⋯) icon button at the header's right that opens the confirm sheet.
- Don't: use a red button in the content or at the page bottom.
- Example: Edit category, Edit wallet, the bill page and the debt write-off (#8, #17, #82, #86).
- Owner: "turn it to the delete icon and put it at the top right corner"

**10. Primary actions in thumb reach.**
- Do: put the main action low on the screen.
- Don't: put it in the top corner of the phone.
- Owner: "record a debt button is literally like so high up… hard to reach"

**11. Compact first screen.**
- Do: on a 390 × 844 phone, show a tab's key content without scrolling (`REDESIGN.md`).
- Don't: squash a chart flat to fit. The web may scroll vertically instead.

**12. Rows are rows.**
- Do: make a list row one tappable row that opens its detail, and make anything tappable look tappable (chevron, ⋯, chevron-down on pickers).
- Don't: add inline action buttons on rows, or hide a feature behind long press alone.
- Example: Coming up rows lost their Pay and Remind buttons on the phone (#87). The landscape web keeps Pay (`WEB.md`).
- Owner: "No need for immediate action buttons."

**13. One way in, and no pages that don't pay their way.**
- Do: give each feature one entry point, where users look for it.
- Don't: add a second edit path, duplicate links to one page, or keep a page only to show logs.
- Example: in-place wallet rename removed (#15). Reports folded into Budget. The sparkle Moni header button removed, leaving Ask and Add as the ways into Moni (#14). Auto-add rules moved out of Permissions (#78).
- Owner: "there should be only a one-way entry to do that" "I'm not sure what it's doing here" (#78)

**14. One surface, rounded all the way. No card inside a card.**
- Do: use one flat sheet or one block, with a quote or a list straight on it. Clip a row's hover and press fill to the rounded list it sits in (`overflow: hidden` with the radius).
- Don't: put a card inside a card or a sheet (a white card on a Sand block, a bordered box in a pane), or let a square fill run past a rounded corner.
- Example: Review's bank alert was a white card inside the Sand source block, with the source and time said twice; it became one header line and the quote on the Sand block. Home's review rows painted their hover past the list's rounded corners (#119).
- Owner: "I don't like the box in a box design… Just make it like one sheet." "you seem to only round up the corners of the wrapper components" "I don't like card in the card designs like this"

## Sheets and pickers

**15. Confirmations are bottom sheets.**
- Do: confirm through the confirm sheet: `openSheet({ kind: 'confirm' })` on the phone, and the web's confirm sheet.
- Don't: use a pushed page laid out as a form, `Alert.alert` with buttons, or `window.confirm`.
- Example: Delete your account was a page, and became a sheet (#74). Archive and write-off moved from `Alert.alert` to the sheet (`3b0830bc`).
- Owner: "goes against all the common consistent design flow… confirmation drawers are bottom-up app drawers"

**16. Compact pickers.**
- Do: pick a month, year or day from a grid one page at a time (`grid-picker-sheet.tsx`), and use one date pattern everywhere. On the web, use Moni's popover and calendar.
- Don't: use a long radio list in a bottom sheet, or the browser's `<select>` or `<input type="date">`.
- Example: birth year list became a decade grid (#77). Due date list became a month calendar (#81). Web native controls (#99, #101, #107).
- Owner: "It should not be bottom of drawer like this. It's kind of weird." "I don't like how the dates are displayed as a long bottom drawer option"

## Charts

**17. One chart per kind, one home per chart.**
- Do: share one component per chart type, put each chart on one page (Home daily spend, Net worth balance, Budget ring), colour lines by wallet or category, and show the tooltip only while held.
- Don't: use legends, numbers on the resting line, a chart that changes filters on tap, or a second-looking donut.
- Example: the debts pie looked unlike the Budget donut (#79). Tapping a chart changed the filter (#42).
- Owner: "I don't want a legend for any of the charts." "the pie chart here looks completely different from the main… donut"

## Navigation

**18. A drill-down stays under its tab.**
- Do: make See all and counts push a deeper page under the current tab, so Back returns there.
- Don't: jump to a filtered Activity tab.
- Example: #13, #50.
- Owner: "it redirects the users to the activities page… very weird from a navigation standpoint"

**19. Lists page.**
- Do: use numbered pages, with search over every record.
- Don't: scroll endlessly, or search only what is rendered.
- Owner: "I don't want it to be like an infinite scrolling interface"

## Motion

**20. Every swap animates, with intent.**
- Do: grow things from where they were pressed. Deleted rows collapse and the rest "fall into place" (#5). Bubbles grow while a reply streams (#63). The theme swap changes everything together (#97).
- Don't: swap instantly, flicker, pop in, or bounce when nothing asked for it.
- Owner: "no animation and it's just a component chain is very flashy. It's not very premium" "The bouncing animation when we enlarge the image is unnecessary"

## Look and brand

**21. Cream and Capsule, sharp.**
- Do: use Style A's cream and capsule shapes, solid category colours with an Ink glyph, and high contrast, near-black in dark mode (`tokens.md`).
- Don't: use blue-led palettes, pale tints that wash out, or low dark-mode contrast (#96).
- Owner: "colors are a bit too plain, too warm… On dark mode, the contrast is completely off"

**22. Cat Pebble.**
- Do: use the cat from `@repo/brand` (`catart.py` on the canvas side): no tail, a gold coin held at its chest, and the one monochrome cat for one-ink uses.
- Don't: put the cat inside the wordmark, hand-draw another cat, or set the logo on Mint, Aqua, Coral or Sky.

## Web

**23. The web is not the phone made wider.**
- Do: in landscape, fit in more (quick actions, inline actions, data side by side). Details slide over from the right. Every passing message is the one toast at the bottom left. Key hints touch their control, and popovers stay on screen. Portrait web follows the phone.
- Don't: leave an empty side pane, or give a feature a page when a pane will do (#102, #104, #106).
- Maps are the exception to the slide-over: a map moves like Google's (drag, wheel and pinch zoom, double click; one finger scrolls the page on touch), sits in a wide band so the page shows it goes on, and a picked place swaps into the card beside it with "‹ All places", never a pane over the map.
- Example: Where you spend's square map took no drag or wheel, and a picked place opened a slide-over over the page; the map became a wide band and the place swaps into the Spent at places card (24 Nov 2026).
- Owner: "I don't want the desktop web UI to simply just be the same as the mobile UI, just wider" "the map itself is not exactly interactable like how I would expect a Google map to interact" "I don't like that the panel covers everything and I have to exit to see anything else"

## How to design

- Match the canvas boards closely, and invent only where they have a gap. Open canvas comment threads count as design.
- Before redesigning a weak screen, research it on Mobbin. Show two or three directions. The owner picks and grafts between them, and the losers move to the Archive page.
- Fewer choices: "Just keep it simple, like don't have too many options for the users" (#69: Later removed, leaving Approve or Not mine).

## Review a screenshot

For each screenshot of a changed screen, phone or web, answer each question. Report every "yes" as a finding with its rule number.

1. Is any text restating something visible, a hint, a legend or a footnote? (1, 2)
2. Is there a " · ", a "→", a sparkle, a robot or a dot-and-label chip? (4, 5, 6)
3. Do controls in one group differ in shape, width or height? (8)
4. Is a destructive action anywhere but the header's top right? (9)
5. Do actions sit inside the content instead of the pinned bar or thumb reach? (7, 10)
6. On a phone tab root, is the key content below y 744? (11)
7. Is there a card inside a card or a sheet, or a square fill past a rounded shape? (14)
8. Is a picker a long list, or a native browser control? (16)
9. Does a chart have a legend or numbers at rest, or differ from its twin on another screen? (17)
10. On the web in landscape, is there an empty pane, or is it the phone layout made wider? (23)
