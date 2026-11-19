---
name: web-verify
description: Drive the Moni web app (apps/web, Next.js) in Chromium the way a user does and prove a change, with one command whose last line is PASS or FAIL. Builds and starts the app on a free port, reseeds the web's own e2e user for the boards' day and signs in only as it, visits every app route at 1440, 1024, 820 and 390 wide in light and dark, runs the keyboard paths, reduced motion, a resize across 700 with a half-typed field and a real QR sign-in, and saves screenshots with board pairs beside the canvas renders. Use for any apps/web change, "verify the web", "screenshot the web app", or before committing web work.
---

# Verify the web app

Prepend Node in every shell: `export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"`. Run commands from the repo root.

## Doctor

```bash
node apps/web/scripts/verify/drive.mjs --doctor
```

It checks that `apps/mobile/.env.e2e` (this checkout's, then the main checkout's) holds the dev project's URL, publishable key, secret key and the web's e2e user (`E2E_WEB_EMAIL`, `E2E_WEB_PASSWORD`, which must differ from the phone's `E2E_EMAIL`), that Playwright has its Chromium, and that the dev project answers `qr-poll` and serves `qr-start`. Last line: `web-verify doctor PASS` or `… FAIL`.

When Chromium is missing: `cd apps/web && npx playwright install chromium`. Ubuntu 26.04 needs `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` in front, because Playwright doesn't list it yet.

## Run

```bash
pnpm --filter web verify                                   # build, start, drive, stop
node apps/web/scripts/verify/drive.mjs --no-build          # reuse the last .next build
node apps/web/scripts/verify/drive.mjs --dev               # next dev instead of build + start
node apps/web/scripts/verify/drive.mjs --skip-qr           # leave out the real QR sign-in
node apps/web/scripts/verify/drive.mjs --out <dir>         # screenshots elsewhere
node apps/web/scripts/verify/drive.mjs --dev --only ledger # sign in, then only these parts
```

Parts for `--only` (comma-separated): `auth`, `qr`, `routes`, `delete`, `motion`, `keys`, `resize`, `ledger` (Home, Activity, Budget and Debts against the seed), `places` (Where you spend). Sign-in always runs.

It builds with the dev project's keys from `.env.e2e` (never `apps/web/.env`, so a run can't hit another project) and `NEXT_PUBLIC_MONI_APP_SCHEME=moni-e2e`, starts `next start` on a free port on 127.0.0.1, and kills only the server it started, also when a check throws. Each check prints `PASS <what>` or `FAIL <what> (<detail>)`. The last line is `web-verify PASS (<n> checks)` or `web-verify FAIL: <k> of <n> checks`; the exit code matches. Paste that line in the report. The password is never printed.

Two lanes can run at once: each takes a free port, but both write to the same commit folder unless one passes `--out`.

## Its own e2e user

web-verify never touches the phone's e2e user. Each run starts with `seed.mjs --user web --reset --profile full --today 2026-10-14` (the boards' day), so a Maestro run reseeding `E2E_EMAIL` in the middle of a web run changes no row under a web check. Every pinned page reads 3 pm on that day in the profile's zone. Right after the reseed it takes `seed.mjs --user web --query fingerprint` (a hash of every live row without timestamps), and the last check takes it again: `the web's e2e user's live rows end as the seed wrote them` fails with each row that drifted, so a write a check forgot to undo shows up. Query the web user by hand with `node apps/mobile/scripts/e2e/seed.mjs --user web --query <name>`.

## What it drives

The feature map in [`features/`](features/README.md) says how each part is reached and what proves it. In short:

1. Signed out: a private path redirects to `/login?next=…`; sign in, the wrong-password error, Create account's 18+ check and its Sand-until-valid button, forgot password, check your email, and sign in at 390.
2. A real QR sign-in: the page's code (from `data-qr-value`) is approved with the web e2e user's token through `qr-approve` (its `check` step, then `approve`), the way the phone does, and the browser must land on `/home`.
3. Signed in by password, every app route at each width in both themes. Per route it asserts the layout (`<html data-layout>`), that only that layout's nav shows (no tab bar on pushed pages at 390), the page title, the theme's ground colour and no sideways scroll.
4. Reduced motion: Add slides in normally and fades under `prefers-reduced-motion`.
5. Keys at 1440: Ctrl K, typing, Enter, `/`, Esc, `?`, G then D, Tab from the palette into Moni chat, the theme switch toast with Undo, Ctrl Z, and the account menu.
6. At 1024 it opens Add, types into it, resizes to 390 and back, and asserts the route, the text and the same DOM element survive.
7. Home and Activity against the e2e seed (`scripts/verify/ledger-screens.mjs`), with the clock pinned to 3 pm on the seed's day (14 Oct 2026): Home's spent figure, Recent's first row and the review count equal what the rows read over REST say; the tooltip follows the pointer; P and D; Customise hides, swaps, survives a reload and resets; Activity's total and 25-row page, sorting in the URL, J and K through the docked pane, X and the bulk bar, Esc in order, the right-click menu and ⋯, a category edited in its cell and undone with Ctrl Z, List kept across a reload, a half-typed cell surviving 700 and back, and the phone's pushed detail. Each screen at the four widths in both themes, with pairs against W2-Home, W2-Activity and W2-Responsive.
8. Budget and Debts (`scripts/verify/budget-debts.mjs`): both screens at each width in both themes with a row's pane open, the clock pinned like Home's, the numbers against the web e2e user's rows (`seed.mjs --user web --query budgets`, `debts`, `debt-activities`), a budget edited, cleared and copied and each undone with Ctrl Z, a repayment and a new debt recorded and undone, J, K, E, R, D, Esc, G then D, reduced motion on the pane, and the 700 crossing with a half-typed budget and repayment.
9. Where you spend (`scripts/verify/places.mjs`): the screen at each width in both themes with a place open, the clock pinned like Home's, the totals, places, Last 7 days, All time and Without a place against the web e2e user's expenses (`seed.mjs --user web --query expenses`), hover linking a row, its pin and its Day by day row, J, K, H, F, P and Esc, zoom and Fit, Visits, a category filter, Add a place undone with Ctrl Z, the 700 crossing keeping the open place, Home's Open map, and reduced motion on the pane, with pairs against W2-Places.
10. Delete your account at 1440 and 390 in both themes: `/delete-account` signed out (and, once, Email me a link), then signed in on `/delete-account` and `/settings/delete-account` before and after typing DELETE, then Delete my account against a stubbed `delete-account` through to the done page. No check deletes the e2e user.

Only the QR step calls `qr-start` for real. `qr-start` allows 10 live requests per address for 10 minutes, so every other page that shows the QR gets a stubbed code (`stubQr`). Opening `/login` by hand at 1024 wide or more uses one request each time. If the QR step fails with "Too many sign-in codes", wait 10 minutes; another lane on this machine may be using the same allowance.

## Evidence

Screenshots go to `~/.local/share/moni-canvas/web-r1/renders/app/<commit>[-dirty]/`, beside the board renders: `<route>-<width>-<light|dark>.png`, the auth states, the palette, shortcuts, account menu, Moni chat, toast and Add before and after the resize. `pairs/` holds the board render on the left and the app on the right, at the same height, for the screens a board draws (W2-Auth's states, Home at each width against W2-Home for the shell's chrome, and W2-Budget and W2-Debts at 1440 with a pane open, W2-Places at 1440 with and without a place open). Open every pair and list each difference in the report. A difference the change intends is fine; say which. Cleanup never deletes this folder.

## Extending it

Each screen phase adds its route to `ROUTES` (with `pushed: true` for a page pushed over a tab on the phone), its board pair in `pair(…)`, and its keys to the keyboard section. Assert what a user sees (a role, a label, a URL, a computed colour), not a class name. Wait for `open(page, path)` (it waits until the shell's keys work) before pressing a key, and `settle(page)` runs before every screenshot so none catches an entrance animation half way.
