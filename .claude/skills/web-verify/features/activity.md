# Activity

## Sub-features

The running chart (this month against last month dashed, the budget line, Money in), saved views (All, To check, Auto-added, and views saved from the current filters), filters (Dates, Type, Wallets, Category, Source, Amount, a search chip, Clear filters), Table with sortable columns or List grouped by day, checkboxes and the Ink bulk bar (Category, Wallet, Export CSV, Delete), a category edited in its cell (Enter saves, Tab moves to the next row, Esc cancels), right-click and ⋯ row menus, 25 rows a page, and the transaction in the side panel beside the table (another row swaps it in place) with chip popovers, in-place merchant, amount and note, Make it a bill (New bill in the panel, filled from the payment, #153), and Delete. The rail with one column shows the grouped list and slides the pane over a scrim; the phone layout has the To review pill, a search field, the type chips, and the detail as a pushed page.

## How to get to it (user POV)

`/activity`, or G then A. A row opens `/activity/<id>`.

## Driving it with Playwright

- URL parameters: `show=list`, `view=check|auto|<id>`, `sort=date|merchant|category|wallet|source|amount`, `dir=asc`, `page`, `from`, `to`, `type`, `wallets`, `categories`, `sources`, `min`, `max`, `q`. Defaults are left out.
- Rows: `.activity-table [role="row"][data-row-id]` (Table), `.activity-days [data-row-id]` (List and narrow layouts). The pane is `getByRole('complementary', { name: 'Transaction' })`; the bulk bar `getByRole('toolbar', { name: 'Selected rows' })`; the row menu `getByRole('menu')`.
- The cell editor is `#cell-edit-input` with `getByRole('listbox', { name: 'Categories' })`. Mark it with `data-marker` before a resize to prove it was not remounted.
- `.running-total` holds the spend so far; `.activity-foot .meta` reads `1–25 of N`.

## Gotchas

- Wait for `.activity[data-loaded]`.
- Keys rest while a field has focus, except Esc, which closes the cell editor first.
- The drive's one write (a category changed in its cell) is undone with Ctrl Z in the same run; it checks the cell reads the old category again.
- `bills.mjs` (`--only bills`) picks a payment this month to a merchant paid once with no bill verdict, opens New bill (`getByRole('form', { name: 'New bill' })`) from its row menu, saves it, checks `recurring_overrides` over REST, and undoes it with Ctrl Z.
