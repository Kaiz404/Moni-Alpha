# Delete your account

## Sub-features

The public page `/delete-account` (the Play listing's deletion link): signed out it lists what is deleted, says it can't be undone, emails a sign-in link back to itself (Email me a link) and links to Sign in with `next=/delete-account`; signed in it is the deletion flow. Settings › Delete your account (`/settings/delete-account`) is the same flow inside the shell. Both end on `/delete-account/done`, outside the app.

## How to get to it (user POV)

Settings, then the last row, Delete your account, in Over red. Or open `/delete-account` from the store listing.

## Driving it with Playwright

- The field is `getByLabel('Type DELETE to confirm')`; the button is `getByRole('button', { name: 'Delete my account' })`. It is disabled until the field reads DELETE in any letter case, and Enter does nothing before then.
- `stubDeletion(context)` answers `delete-account` with `{ ok: true }` and `auth/v1/logout` with 204, and returns the calls it caught. A click on Delete my account must make exactly one call with a `Bearer` access token, then land on `/delete-account/done`, and `/home` must then redirect to sign in.
- `stubEmailLink(context)` answers `auth/v1/otp`; the request must carry `create_user: false` and `redirect_to` `…/auth/callback?next=%2Fdelete-account`.
- Pairs: `boardBand` cuts the Delete section out of `r3/W2-Parts.png` (frames 1 to 3 at y 3900, the public page at y 4630).

## Gotchas

- Never let a click reach the real `delete-account` for the e2e user: every context that can press Delete my account calls `stubDeletion` first. `supabase/functions/_check/live-check.mjs` deletes a throwaway user for real.
- The logout stub matters too: a real global sign-out would end the e2e user's other sessions, including the storage state later checks reuse.
- Signed in, the note's Export data downloads the Moni export (issue #70) once the store has pulled; the public page mounts `StoreSync` for it. Signed out, the page says to sign in or use the phone. `settings.mjs` checks the download from `/settings/delete-account`.
