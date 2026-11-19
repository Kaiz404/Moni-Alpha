# First run and empty screens

## Sub-features

Set-up (W2-Onboarding) at `/welcome`: the main currency (the browser's suggestion first, every current currency, `/` to search by code, name or country), Moni's AI (Turn on or Not now, recorded through `@repo/data` the way the phone records it, which moves on to the next step), the wallets (name, type, starting balance, each in its own currency; Continue waits for one name), and the phone app (the Play link as a QR, Google Play, Email me the link). Finish set-up and I'll do it later both write the wallets, then the main currency and `setup_finished_at`, and land on Home with the Mint Get set up card in the Review slot (W2-Onboarding's checklist: five steps, × hides it with Undo). Every other screen's empty state (W2-Empty): Activity (the flat chart, No spending yet with Add a transaction; filters that match nothing named in words), Review (Nothing to review and where captures come from, until something was decided today), Budget (No budgets yet), Debts (No debts yet, no idle pane), Where you spend (No places yet), Merchant names, Moni chat's first open, and Ctrl K with no match.

## How to get to it (user POV)

Create an account and sign in: Home sends a brand-new account (`needsSetup` in `@repo/data`: no `setup_finished_at`, no wallet and no transaction, deleted ones included) to `/welcome`. Any other account never sees it; `/welcome` sends it to Home.

## Driving it with Playwright

- `scripts/verify/states.mjs`'s `verifyFirstRun` (part `firstrun`) reseeds the web e2e user with `seed.mjs --user web --reset --profile empty`, and in `finally` reseeds `full`, so the drive's closing fingerprint still matches.
- Contexts use `locale: 'en-MY'`, so the browser suggests MYR.
- Fields: `getByLabel('Wallet <n> name' | 'Wallet <n> type' | 'Wallet <n> starting balance' | 'Wallet <n> currency')`, `getByLabel('Search currencies')`, options are `role="option"` with `aria-selected`.
- What set-up wrote is read back over REST (`wallets`, `profiles.preferences`, `ai_consent_current`).
- Pairs: each step against its W2-Onboarding frame (`frameY(n)`), Home's first run against frame 5 and W2-Empty's first band.

## Gotchas

- The empty profile still has AI consent rows (granted); Not now records `all: false`.
- Set-up keeps everything but Moni's AI in memory until Finish; a reload starts again at step 1.
- Another lane driving the web e2e user while this part runs sees an empty account for a few minutes.
