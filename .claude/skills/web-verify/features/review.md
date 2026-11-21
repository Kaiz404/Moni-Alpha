# Review

## Sub-features

A drawer on Home (the slide-over, `aside[aria-label="Review"]`), not a page. One by one (the deck) or All N (the inbox), oldest first, with a checkbox per capture, Select all, the familiarity pill (Needs a wallet, Same payment, Usual for you, Seen before) and the header's "<total> not counted yet". The open capture: the source (a bank alert quoted, the line said in Moni chat, a receipt photo from the `receipts` bucket), the merchant and amount edited in place, Type, Category, Wallet (and To for a transfer) as listbox popovers, "Don't ask about similar" for a bank alert with its rule preview (the alerts it would have matched this month and Next time), or the merchant's month. Not mine and Approve (Approve N with ticks; Pick a wallet, off, when none is set). The Ink bulk bar. All caught up with today's decisions, and Recently reviewed (30 days) with Move back to Review for a Not mine. There is no Later (issue #69). The phone layout is the deck as a full-screen pushed page: one capture at a time with Not mine and Approve, focus on its heading, Home inert behind it.

## How to get to it (user POV)

Home's review card (its Review link or a capture), Ctrl K, G then R, chat's Open Review, Activity's To review, or Budget's capture rows. Old `/review` links redirect to `/home?review=deck`. Esc, Close or Back shuts it.

## Driving it with Playwright

- `scripts/verify/review.mjs` pins the clock like Home's and reads the web e2e user's captures with `seed.mjs --user web --query proposals`, the rules with `--query auto-add-rules` and the filed bank alerts with `--query alerts`.
- Wait for `[data-screen="review"]`. The drawer is `getByRole('complementary', { name: 'Review' })`. Rows are `.inbox-row[data-capture]` with `.inbox-name`; the open capture is `section.capture-card` with `data-capture`; the amount is `getByTestId('capture-amount')`; the rule preview is `[aria-label="Rule preview"]` and its `.rule-meta`.
- Keys: J, K, Space (only when no button or box has focus), A, X, Esc, Ctrl Z. Esc shuts an open picker first, then clears the ticks, then closes the drawer. `?review=deck|list|recent` says what the drawer shows; the open capture is `?capture=<id>`.
- The bulk bar is `getByRole('toolbar', { name: 'Selected captures' })`.

## Gotchas

- Every decision writes to the web e2e user's rows; the drive undoes each with Ctrl Z or Move back, and the drive's last check fails if a row is left changed.
- `seed.mjs --user web` uploads `apps/mobile/scripts/e2e/receipt.jpg` for the receipt capture; the phone's seed keeps none.
- The PLACE map the board draws beside the source is not shown: where the phone was is kept on the phone (`proposal-location-cache`) and only reaches the ledger row on Approve.
