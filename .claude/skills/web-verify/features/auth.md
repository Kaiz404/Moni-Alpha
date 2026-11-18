# Auth

## Sub-features

Sign in with email and password; Continue with Google; Create account (`/login?mode=create`) with name, email, password, birth month and year, and the terms; Forgot password (`/login/forgot`); Check your email (`/login/verify?email=`); Set a new password (`/login/reset`, where the reset link lands).

## How to get to it (user POV)

Open any private path signed out, or `/login`. The Sign in / Create account switch sits at the top of the form.

## Driving it with Playwright

- Fields by label: `getByLabel('Email')`, `getByLabel('Password', { exact: true })`, `getByLabel('Name')`, `getByLabel('Month')`, `getByLabel('Year')`, the terms `getByRole('checkbox')`. Submit with `locator('form button[type="submit"]')`, because the mode switch also has a button named Sign in.
- Wrong password: the text "That email and password don't match. Check both and try again."
- Under 18: pick December of (this year − 18); the text "Moni is for people 18 and over, so we can't create an account for you." shows and the submit stays disabled.

## Gotchas

- The drive never submits Create account or Forgot password: both send real email from the dev project.
- Google sign-in can't be driven headless; check its redirect URL by hand (docs/SETUP.md, Google Sign-In, Web).
- Signed in, `/`, `/login` and `/login/forgot` redirect to `next` or `/home`.
