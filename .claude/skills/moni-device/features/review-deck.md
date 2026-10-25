# Review captures

Captures that Moni is not sure about wait in the Review deck as cards. Each card has Not mine, Later, and Approve, and swipes left, down, and right do the same. A capture with no wallet asks "Which wallet?" before it writes. When the deck is empty it shows "All caught up" with this session's results and a link to the capture log.

## Sub-features

- `review-open` opens the deck from Home's review block.
- `review-buttons` decides each card with the buttons and ends on All caught up.
- `review-needs-wallet` asks for a wallet for the chat capture.
- `review-swipe` approves, rejects, and snoozes by swipe, and a short drag snaps back.
- `review-edit` edits the amount in the card and approves with "Don't ask about similar".

## How to get to it (user POV)

- Tap the review block on Home (`home.review`).
- Tap "to review" on Activity (`activity.to-review`).
- Open `moni-e2e://review`.

## Driving it with run-flows.sh

Preconditions:

- The `full` seed. `seed.mjs --query pending-proposals` lists four pending captures, newest first: GRAB*FOOD (Maybank alert), Jaya Grocer (Maybank alert), Restoran Nasi Kandar Ali (receipt), and Parking KLCC (chat, no wallet).

- **Open the deck.** Run `run-flows.sh --sha <key> .maestro/flows/smoke/review.yaml`. It taps `home.review` and checks `review.card`, `review.not-mine`, `review.later`, and `review.approve`. It decides nothing.
- **Decide every card.** Run `run-flows.sh --sha <key> .maestro/flows/review/buttons.yaml`. It taps `review.not-mine` once, then `review.approve` until the deck is empty, picking the first `sheet.option.*` wallet when "Needs a wallet" shows. The end screen reads "3 approved, 1 not mine".
- **Second view.** Run `node apps/mobile/scripts/e2e/seed.mjs --query pending-proposals` after the flow. It prints `[]`. `--query latest-transaction` shows one of the approved captures.
- **Swipes and the editor.** Run `.maestro/flows/review/swipe.yaml` and `.maestro/flows/review/edit-in-card.yaml` the same way. Each needs a fresh seed, which `run-flows.sh` gives every call.
- **Proof.** Pair `smoke-review.png` with `XA-Review` and `r1-l10-caught-up.png` with `XA-Deck`.

## Gotchas

- Run each review flow in its own `run-flows.sh` call. The flows decide cards, so a second flow in the same run starts with fewer.
- The deck orders cards newest first by `created_at`. The seed spaces the four captures one minute apart to fix that order.
- Each decision shows a toast with Undo (`nav.toast.undo`). A tap on Undo reverts the decision, so do not tap near the toast unless the step means to.
