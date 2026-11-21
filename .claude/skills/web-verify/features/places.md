# Where you spend

## Sub-features

The drawn map with a pin per place, merged into one pin with a count when two touch at the current zoom; + and − zoom, Fit (F), and a drag to pan once zoomed. Pins | Heat (H, `?view=heat`). Range (Last 7 days, Last 30 days, All time; `?range=7d|all`), Category (`?category=`) and Wallets (`?wallet=`) on the map. The places list beside it: spent at places, the hot spot, Spent | Visits (`?sort=visits`), a row a place, and a link down to the expenses without a place. Picking a row or a pin opens the place in the slide-over (`?place=<id>`, #106): total and each, its share, visits by day, what you bought, payments newest first, Open in Google Maps. Day by day: a row a place, a column a day, weekends shaded. Without a place: the range's expenses with no location; tick some and Add a place (P) pins them to one of your places, with Undo. Empty states: no places at all (the map stays, one dashed card), nothing in the filters (one line on the map), every wallet's location off (a banner, pins faded). The phone layout shows the map, the filters and the list or the place, as a page pushed from Home.

## How to get to it (user POV)

Home's Where you spend card, Open map. The page is `/home/places`; Home stays lit in the nav.

## Driving it with Playwright

- Wait for `[data-screen="places"]` and a `.map-pin-big[data-shown]`.
- Rows: `.place-row[data-place]` with `.row-title`, `.row-meta` ("… · 6 visits") and `.place-amount .num`. The total is `[data-testid="places-total"]`, the count `.side-hero-of`.
- Pins: `.map-pin-big[data-place]`; shown ones carry `data-shown`, the open place `data-on`, the hovered one `data-hot`. Heat blobs: `.heat-blob[data-on]`. The art's zoom is the inline transform of `.map-art-pan`.
- The place: `aside.slide-over .place-pane h2`, the position ("2 of 9") in `.slide-over-steps`, `.visit-bar`.
- Day by day: `.day-axis .day-col[data-weekend]`, `.day-row[data-place]`.
- Without a place: `.without-row[data-transaction]` with its `checkbox`, the toolbar `Selected expenses`, the dialog `Choose a place`.
- Compare with `seed.mjs --user web --query expenses` (every live expense with its location columns).

## Gotchas

- Wait for the URL after Esc before the next key: the URL updates a moment later, and a key that sets another parameter in between brings the old `place=` back.
- Hovering in Playwright scrolls the element into view, so a screenshot after a hover may be scrolled.
- Add a place writes the location to the expense; poll the query until it lands, hover the toast so Ctrl Z still has it, and poll again for the undo.
