# Settings

## Sub-features

The section nav (`/settings`, then `/settings/profile`, `/settings/ai`, `/settings/merchants`, `/settings/import`). Profile: name and email read-only, Theme, Moni's tone, Sign out, Delete your account, which opens a confirm dialog. Moni's AI: Let Moni use AI and four per-use switches. Merchant names: All, To name, Named, search, sort, 25 a page, a name edited in its cell, Moni's guess, ticks with the Ink bulk bar (Rename, Use Moni's guess, Forget names). Import and export: Choose a file, Match columns beside the live preview, Check the file, Add with progress and Undo, and Export data. Under 700 wide `/settings` is the phone's Profile rows and each section a pushed page; CSV matching and ticks are desktop only there.

## How to get to it (user POV)

Settings in the sidebar or rail, G then S, or the K on the phone's Home. Pick a section in the nav.

## Driving it with Playwright

- `apps/web/scripts/verify/settings.mjs`, run with `--only settings`. Its clock is pinned to 3 pm on the seed's day, like the ledger part.
- Wait for `.settings`, then for `[aria-busy="true"]` to go: Export data and Choose a file stay busy until the store's first pull.
- Nav links are `.settings-link`; the section is `.settings-panel .set-card`. On the phone layout the nav shows only on `/settings` and the section only on a sub-route.
- Moni's tone: `getByRole('radio', { name: 'Playful' })`; the toast says `Moni's tone: Playful`.
- Moni's AI: `getByRole('switch', { name: 'Let Moni use AI' })` and one per use by its title. The master's line is `data-testid="ai-master-meta"`.
- Merchant names: rows `.mn-row[data-key]` (the merchant key), `.mn-count`, the name cell `input`, the tick `.cbx`. The bar is `getByRole('toolbar', { name: 'Selected codes' })`; Rename opens `getByRole('dialog', { name: 'Name 2 codes' })`.
- Import: `input[type="file"]` takes `setInputFiles`; the step is `[data-import-step]`; pickers are `getByLabel('Date column')` and so on, the wallet `getByLabel('Wallet to add to')`; the counts are `getByTestId('import-new' | 'import-here')`; a lit column is `.pth[data-lit]` with `data-column`.
- Export data: wait for the `download` event; the file's Transactions section must hold every live transaction.
- Pairs: `settings-import-1440` against `r2/W2-Data.png`, `settings-merchants-1440` against `r2/W2-Data-merchants/W2-Data.png` (the board rendered with `--state '{"section":"merchants"}'`).

## Gotchas

- Every write is put back: the tone by Ctrl Z (then the preferences PATCHed back over REST if Undo wrote `friendly` where nothing was), the rename by Ctrl Z, the import by Undo (its rows end soft-deleted, merchants `VERIFY … <run>`).
- With no AI answer on record, a real consent row could never be taken back, so that context answers `ai_consents` and `ai_consent_current` from memory and the server is untouched. Once the user has answered (a phone run), it flips a real switch and flips it back.
- The e2e user is shared with phone reseeds. When a data check fails, run it once more before looking for a bug.
