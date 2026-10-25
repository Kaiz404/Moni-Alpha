# Sign in

A signed-out user sees the sign-in page ("Welcome back"), types an email and password, and lands on Home. Profile signs the user out. A wrong password shows "That email and password don't match. Check both and try again." and stays on the page.

## Sub-features

- `sign-in-email` signs in with the e2e user's email and password.
- `sign-out` signs out from Profile and returns to the sign-in page.
- `sign-in-wrong` shows the wrong-details line for a bad password.
- `sign-in-create-mode` swaps to Create account, which shows the name field and the 8-character hint.

## How to get to it (user POV)

- Open Moni E2E with no session, for example after `run-flows.sh` clears the app's data.
- Tap the avatar on Home, scroll to Sign out, and tap it.

## Driving it with run-flows.sh

Preconditions:

- Either seed. Sign-in does not depend on data.
- `E2E_EMAIL` and `E2E_PASSWORD` are set in `apps/mobile/.env.e2e`. `run-flows.sh` passes them to Maestro.

- **Sign out, then sign in.** Run `run-flows.sh --sha <key> .maestro/flows/smoke/sign-in.yaml`. It taps `home.avatar` and `profile.sign-out`, waits for `auth.email`, then types into `auth.email` and `auth.password` and taps `auth.sign-in`. The report shows 1/1 passed, and `smoke-signed-in.png` shows Home with the tab bar.
- **Wrong details and the Google cancel state.** Run `run-flows.sh --sha <key> .maestro/flows/account/sign-in-states.yaml`. It ends signed in. Screenshots `k1-l6-wrong.png` and `k1-l8-google-cancel.png` show the two error lines.
- **Proof.** Pair `smoke-signed-out.png` with the `V2H-Login` board through `review-pair.sh sign-in V2H-Login <png>`.

## Gotchas

- `subflows/sign-in.yaml` taps `auth.mode.sign-in` before it types, so it works when the page shows Create account. Keep that step.
- Google sign-in needs a person at the phone. The flows only test its cancel state.
- `seed.mjs --reset` sets the e2e user's password to `E2E_PASSWORD` each time, so a changed password in `.env.e2e` takes effect at the next run.
