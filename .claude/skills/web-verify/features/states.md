# Loading, errors and connection

## Sub-features

W2-States: first-load blocks (Home's cards keep their titles, Activity's block rows; still, never pulsing, and only after 300 ms of a session's first load, never on navigation), a card that couldn't load (Home's card says so with Try again; Moni retries on window focus), the 404, 500 and maintenance pages (a 120 cat, a way home, Privacy policy and Terms; Moni status once the owner names the page in `site-facts.ts`), offline (the Sand banner under the header with when the numbers last updated, Ask Moni dimmed, Review's card waiting; edits save in the tab's store and sync on reconnect), back online (an info toast with what synced, or an error toast with Try again if something didn't), the toast catalogue (done with Undo 4 s, Undone 2 s with no button, error until Try again or ×, info 4 s; Ctrl Z undoes the latest change after its toast has gone), and Sign in again (a dialog over the page when the session ends without Sign out; Esc doesn't close it).

## How to get to it (user POV)

Any signed-in page on a slow first load; a URL that doesn't exist; `/maintenance` (every page while `MONI_MAINTENANCE_UNTIL` is set); the network dropping; signing out in another tab.

## Driving it with Playwright

- `scripts/verify/states.mjs`'s `verifyStates` (part `states`).
- Slow first load: `context.route('**/rest/v1/transactions*')` delayed 2.5 s; a block's computed opacity is `0` at first and `1` after its delay.
- Couldn't load: `context.route('**/rest/v1/wallets*')` answers 500 until Try again.
- Offline: `context.setOffline(true)`, one category edited in its Activity cell, the row read over REST before and after `setOffline(false)`, then Ctrl Z after the toast has gone.
- Sign in again: two pages in one context with `**/auth/v1/logout**` stubbed, so the server session survives; the second page signs out from the account menu and the first gets the dialog through Supabase's cross-tab auth broadcast.

## Gotchas

- The 500 page (`app/error.tsx`) has no runtime check: nothing in the app throws on demand.
- The maintenance switch is read when the server starts; the drive checks `/maintenance` itself.
- Sync conflicts are last write wins in the shared store, so W2-States' conflict prompt is not built.
