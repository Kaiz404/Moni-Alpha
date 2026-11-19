# Moni chat

## Sub-features

The pane docked on the right (`?pane=chat`): the cat, "Moni chat", the Lilac AI label and "Looking at …" (the section; on Activity the open row, the view, categories, dates, a search and the ticked rows). First open: "Hi <name>. What did you spend?", three starter cards that fill the box and never send, and the AI line under the box. A question goes through Moni's AI once the user allows chat (W2-Parts' "Moni chat uses AI" dialog: Not now, closing counts as Not now, Turn on AI) and answers with a card (a category or the month by week against the even pace, the bills left, or the captures waiting) whose caption is the model's reply. "Move my Grab rides out of Food" drafts a category change from the ledger with no AI call: the rows, Food & Dining → Transport, each category after, Not mine and Approve (Enter), while the same rows light up in Activity behind. Approve becomes "Changed N rows to Transport · Undo"; Not mine "Kept in Food & Dining. Nothing changed." A spend ("12.50 at Mamak Ali") points to Add. Under 700 wide the pane is the pushed chat page.

## How to get to it (user POV)

`/` anywhere, the Ask Moni row in the sidebar or rail, or Tab in Ctrl K with words typed. Esc closes it.

## Driving it with Playwright

- The pane: `aside[data-pane="chat"]`; the header line `[data-testid="chat-context"]`; the box `getByLabel('Ask or add a transaction')` (Enter sends, Shift+Enter is a new line).
- Messages: `.chat-me` (the user's), `.answer-card` with `.week-bar[data-week]` (the value is the bar's previous sibling) and `.week-tip`, `.draft-card` with `.draft-row[data-row-id]`, `.draft-row-amount`, `.draft-after`, and `.draft-settled[data-state="done|kept"]`. The drafted rows behind: `.activity-table [data-draft]`.
- The consent dialog: `getByRole('dialog', { name: 'Moni chat uses AI' })`.
- Gateway calls: route `**/v1/chat/analyze`. With `NEXT_PUBLIC_AI_API_URL` set for the drive the route passes through to that gateway; without it the drive builds against a stub URL and the route answers `{ status: 'ok', reply, modelId }`.
- Oracle: the web e2e user's rows over REST (`transactions` with `category_id` and `merchant`), and `ai_consent_current` for the choice.

## Gotchas

- Consent: the part inserts `all: false` for the web e2e user so the dialog shows, then deletes every `ai_consents` row it added (secret key), which puts the choice back exactly. Once a user has answered, Not now writes nothing.
- The thread lives in the tab's shell store, so a new page starts an empty thread; open each check's context fresh.
- A local gateway needs this app's origin in `CORS_ALLOWED_ORIGINS`, so pass `--port` to the drive with the same port.
- The draft card takes the focus when it appears, so Enter approves it; type in the box again to send.
