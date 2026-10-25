# Add a transaction

The + in the tab bar opens a chooser with Type it, Scan a receipt, Say it, and Ask Moni. Type it slides in the amount page with a keypad, an Expense / Income / Transfer switch, the wallet and category pickers, and a note. Saving returns to the page the user came from, with the new row on top.

## Sub-features

- `chooser` opens and closes the + chooser.
- `type-expense` saves an expense typed on the keypad.
- `type-transfer` switches to a transfer, which shows From and To.
- `type-back` leaves the page with Back and writes nothing.
- `type-duplicate` warns when the typed expense matches a recent one.

## How to get to it (user POV)

- Tap `+` in the tab bar, then Type it.
- Home's recent list has an Add link when it is empty.

## Driving it with run-flows.sh

Preconditions:

- The `full` seed, so the MYR wallets and categories exist.

- **Open the chooser.** Run `run-flows.sh --sha <key> .maestro/flows/smoke/chooser.yaml`. It taps `nav.plus`, checks `nav.chooser.type`, `nav.chooser.scan`, `nav.chooser.say`, and `nav.chooser.ask`, and closes with `nav.chooser.close`.
- **Type and save an expense.** Run `run-flows.sh --sha <key> .maestro/flows/capture/type-it.yaml`. It types RM12.50 with `capture.key.1`, `capture.key.2`, `capture.key.point`, `capture.key.5`, and `capture.key.0`, types the note `Tesco` into `capture.note`, and taps `capture.submit`. Activity shows a Tesco row on top.
- **Second view of the write.** Run `node apps/mobile/scripts/e2e/seed.mjs --query latest-transaction`. It prints `"amount": 12.5`, `"type": "expense"`, and `"metadata": { "source": "manual" }` once the app has synced.
- **Duplicate warning.** Run `run-flows.sh --sha <key> .maestro/flows/capture/type-duplicate.yaml`, which types RM23.40 with the note GRAB*FOOD. That matches the pending GRAB*FOOD capture, so "Looks like a duplicate" opens with `capture.duplicate.review` and `capture.duplicate.add-anyway`.
- **Proof.** Pair `c1-l2-pair.png` with `V2A-CaptureType` and `c1-l8-origin.png` with `V2A-Activity`.

## Gotchas

- The amount uses U+2212 for the minus, as in `−RM45.90`. Assert with that character.
- The wallet picker lists main-currency wallets only, so Wise USD is never offered.
- Sync to Supabase is asynchronous. If `latest-transaction` still shows a seeded row, wait a few seconds and query again before you report a failure.
