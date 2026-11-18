# Sign in with your phone (QR)

## Sub-features

The code from `qr-start`, drawn as a QR with the Moni tile; "New code in 0:42"; rotation when the code lapses (the poll after expiry returns a new code); approval from the phone; `verifyOtp` with the token hash; Show a new code after the request expires or fails.

## How to get to it (user POV)

`/login` or `/login/forgot` at 1024 wide or more: the Deep mint panel on the right. Narrower, the panel is hidden and asks for no code.

## Driving it with Playwright

- `[data-qr-state]` on the card is `starting`, `showing`, `approved`, `expired` or `failed`. `[data-qr-value]` holds the link, `moni-e2e://sign-in?code=<code>` in the drive.
- Approve as the phone: password-grant a token for the e2e user, then POST `functions/v1/qr-approve` with `{ code, step: 'check' }` (answers `{ browser }`) and `{ code, step: 'approve' }` (answers `{ ok: true }`). The page then lands on `next` (default `/home`).
- Rotation timing is unit-tested in `apps/web/src/lib/__tests__/qr-sign-in.test.ts`; the live rotation takes 61 s and is covered by `supabase/functions/_check/live-check.mjs`.

## Gotchas

- 10 live requests per address for 10 minutes. The drive stubs `qr-start` and `qr-poll` everywhere except this one step (`stubQr`).
- A failed state reading "Too many sign-in codes" is the rate limit, not a bug.
