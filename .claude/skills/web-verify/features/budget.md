# Budget

## Sub-features

The month (`?month=YYYY-MM`, arrows and a picker), Month and Calendar (`?view=calendar`). The ring of the month's spending by category with what is left, after bills and debts due, and safe to spend a day. Bills still due this month. The Budgets table: Spent, Budget (edited in its cell), Left with a bar, Last month and 3-month avg, a total row, and No budget yet. "Copy <last month>'s spending" sets budgets from last month, with Undo. The category pane (`?category=<id>`): spent and left, Monthly budget · every month (edited in the pane too), the last 6 months against the budget line, this month's payments and captures to review. The phone layout shows the ring card, one ring per category and the bills; a ring opens the category as a page.

## How to get to it (user POV)

The Budget tab, or G then B. Pick a row or a ring slice for its pane.

## Driving it with Playwright

- Rows: `.budget-row[data-category]`, with `data-budgeted`, cells `[data-col="spent|budget|left|last|avg"]`. Click `.row-name`, not the row's middle, which can land on the budget cell and start an edit. The total is `[data-testid="budget-total"]`.
- The cell editor: `.budget-cell input`; in the pane or on the phone layout, `aside.detail input[aria-label$="budget in ringgit, editing"]`. Enter saves, Esc cancels.
- Keys: J and K move, E edits the selected budget (or starts Set budgets), Esc cancels the edit, then closes the pane.
- Compare with `seed.mjs --user web --query budgets` (category name, amount, currency).

## Gotchas

- Writes reach the dev project a moment later: poll the query, and hover the toast meanwhile so Ctrl Z still has it (it closes after 4 s).
- A cleared budget is soft-deleted and setting it again revives the same row, so the table never trips its key on user, category and currency.
- The category opens in the slide-over over the page at every desktop width; a cell edit stays in the table and opens nothing.
