# Say it and Scan a receipt

Say it listens while the user names the shop, the amount, and how they paid, then shows a heard card with pencils and Approve. Scan a receipt opens Google's ML Kit document scanner, reads the receipt, and shows a check page. Approve writes the transaction straight to the ledger with source Voice or Camera. In the e2e build the mock AI client gives the reading, so no backend is needed.

## Sub-features

- `say-listen` shows the listening page with the counter and Done speaking.
- `say-heard` turns the parking sentence into a RM6.00 Parking KLCC expense.
- `scan-read` imports the mamak receipt and shows RM15.30 from Restoran Nasi Kandar Ali.
- `scan-edit` edits the amount in place before Approve.
- `chat-capture` sends the parking sentence in Moni chat and shows a draft card.

## How to get to it (user POV)

- Tap `+`, then Say it or Scan a receipt.
- Type a purchase into Moni chat from Home's ask box.

## Driving it with run-flows.sh

Preconditions:

- The `full` seed.
- `run-flows.sh` grants the microphone and camera and pushes `receipt-mamak.png` and `receipt-blank.png` to `/sdcard/Pictures/moni-e2e/`.

- **Listening page.** Run `run-flows.sh --sha <key> --tag needs-speech .maestro/flows/capture/say.yaml`. The first half checks `capture.done-speaking` and the counter. The heard half waits for someone to say "paid 6 ringgit parking at KLCC" near the phone, so ask the operator or report the flow as skipped with `needs-speech`.
- **Scan.** Run `run-flows.sh --sha <key> .maestro/flows/capture/scan.yaml`. It taps `nav.chooser.scan`, imports `receipt-mamak.png` in Google's scanner, checks `capture.result.amount`, `capture.result.category`, and `capture.result.wallet`, edits the amount through `capture.amount.edit` and `capture.amount.save`, and approves with `capture.approve`.
- **Chat capture.** Run `run-flows.sh --sha <key> .maestro/flows/chat/draft.yaml`. It types the parking sentence into `chat.input` and taps `chat.send`. The mock reads it, and a draft card appears.
- **Second view.** `node apps/mobile/scripts/e2e/seed.mjs --query latest-transaction` shows the approved scan with `"source": "camera"`.
- **Proof.** Pair `c2-l2-pair.png` with `V2A-CaptureScan` and `c2-l3-added.png` with `V2A-CaptureScanAdded`.

## Gotchas

- The mock reads every scanned image as the mamak receipt. `capture/scan-failed.yaml` expects a blank receipt to fail, so it needs the real backend and keeps the `needs-ai` tag.
- Google's scanner UI is not Moni's. Its import button label comes from `maestro hierarchy` and can change with a Play services update.
- Speech recognition can write "six" or "RM6". The mock accepts "paid 6 ringgit", "paid six ringgit", and "paid rm6" forms of the sentence, with or without a final full stop.
