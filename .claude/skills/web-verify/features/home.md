# Home

## Sub-features

Spent in October (Pace and Daily, P and D, a tooltip only under the pointer, what's left below), the lilac review card (Approve per capture, a wallet picker for one that needs it, Approve all N usual), Next 14 days (timeline and rows), Wallets with the check-in (That's right, Fix it in place, Not now), Recent (five rows; three on the phone), Where you spend (drawn map art, this month's three biggest places), and Customise (swap and hide cards, Reset, Done or Esc). The phone layout is V2H-Home: net worth, the spent card, the ask box, the review card, then the cards in the Customise order.

## How to get to it (user POV)

Sign in; `/home`, or G then H.

## Driving it with Playwright

- `scripts/verify/ledger-screens.mjs` reads the web e2e user's rows over REST with a password-grant token and pins the browser clock (`context.clock.setFixedTime`) to 3 pm on the seed's day (14 Oct 2026, which the drive reseeds at its start) in the profile's zone, so the numbers are the seed's whatever today is.
- Wait for `.home[data-loaded]` before reading numbers: the ledger loads in the browser.
- Numbers: the spent chart's `role="img"` label holds the spend so far; `.recent-card .txn-row` rows; the review card's `.card-title`.
- Chart: `.spent-card .chart-area`; the tooltip is `.chart-tip` and exists only while the pointer is over the plot. The toggle is `getByRole('radio', { name: 'Pace' | 'Daily' })`.
- Customise: `getByRole('button', { name: 'Customise Home' })`; each card's switch is `getByRole('switch', { name: 'Show <card> on Home' })`; a grip `getByRole('button', { name: /^Move <card>/ })` swaps with arrow keys; slots carry `data-slot-card`.

## Gotchas

- Approve and the check-in write to the web e2e user's rows; the drive does not press them. Its one write is Activity's cell edit, undone with Ctrl Z.
- Under the pinned clock, React reports a hydration mismatch in development: the server renders with the real date. Production builds recover silently; the screens read the clock only after hydration.
- The layout lives in `localStorage['moni-home-layout']`; a new browser context starts from the default.
