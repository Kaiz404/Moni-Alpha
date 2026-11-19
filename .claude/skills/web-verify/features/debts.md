# Debts

## Sub-features

The net position with Owed to you and You owe, which filter the table (`?side=owed_to_me|i_owe`). Coming up: open debts with a due date, Pay (opens Record a repayment) or Remind <name> (the share sheet, else the clipboard). People: Person, Due, Owes you, You owe, and an Open total; Settled and written off below. The person pane (`?person=<debt id>`): what is still owed and the bar, Record a repayment (amount, All of it, wallet, date), Remind, the note, due date and wallet, the history, Write off (an alertdialog asks first, Cancel focused, Esc closes only the ask). Record a debt (`?record=debt`): who owes who, the name with past people, the amount, wallet, due date and note. Each write has Undo. The phone layout stacks the same cards with a Record a debt row, and the pane is a page.

## How to get to it (user POV)

The Debts tab, or G then D. D opens Record a debt anywhere on the page.

## Driving it with Playwright

- Rows: `.people-row[data-debt]` with `data-state`, cells `[data-col="due|owes-you|you-owe"]`; names are `.row-name .row-text b`. The total is `[data-testid="people-total"]`, the net `[data-testid="net-amount"]` and the tiles `[data-testid="net-owed_to_me|net-i_owe"]`. The pane's balance is `[data-testid="person-balance"]`.
- Record a repayment: `getByLabel('Amount paid back, in ringgit')`. Record a debt: `getByRole('textbox', { name: 'Who' })` (Who owes who is a radio group with a similar name) and `getByLabel('Amount, in ringgit')`.
- Keys: J, K, R record a repayment, M remind, D record a debt, Esc closes the form, then the pane.
- Compare with `seed.mjs --user web --query debts` and `--query debt-activities`.

## Gotchas

- Wait for `?person=` before pressing R: the key acts on the selected person.
- Record a debt for someone who already owes the same way adds the amount to that debt, as the phone does. Undo of a new debt soft-deletes the debt, its principal and the cash mirror (`planDebtDelete`), so each run leaves soft-deleted rows until the next reseed.
