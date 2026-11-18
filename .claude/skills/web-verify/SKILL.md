---
name: web-verify
description: Drive the Moni web app (apps/web, Next.js) in Chromium the way a user does and prove a change, with one command whose last line is PASS or FAIL. Builds and starts the app on a free port, signs in as the e2e user, visits every app route at 1440, 1024, 820 and 390 wide in light and dark, runs the keyboard paths, reduced motion, a resize across 700 with a half-typed field and a real QR sign-in, and saves screenshots with board pairs beside the canvas renders. Use for any apps/web change, "verify the web", "screenshot the web app", or before committing web work.
---

# Verify the web app

Prepend Node in every shell: `export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"`. Run commands from the repo root.

## Doctor

```bash
node apps/web/scripts/verify/drive.mjs --doctor
```

It checks that `apps/mobile/.env.e2e` (this checkout's, then the main checkout's) holds the dev project's URL, publishable key and the e2e user, that Playwright has its Chromium, and that the dev project answers `qr-poll` and serves `qr-start`. Last line: `web-verify doctor PASS` or `… FAIL`.

When Chromium is missing: `cd apps/web && npx playwright install chromium`. Ubuntu 26.04 needs `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` in front, because Playwright doesn't list it yet.

## Run

```bash
pnpm --filter web verify                                   # build, start, drive, stop
node apps/web/scripts/verify/drive.mjs --no-build          # reuse the last .next build
node apps/web/scripts/verify/drive.mjs --dev               # next dev instead of build + start
node apps/web/scripts/verify/drive.mjs --skip-qr           # leave out the real QR sign-in
node apps/web/scripts/verify/drive.mjs --out <dir>         # screenshots elsewhere
```

It builds with the dev project's keys from `.env.e2e` (never `apps/web/.env`, so a run can't hit another project) and `NEXT_PUBLIC_MONI_APP_SCHEME=moni-e2e`, starts `next start` on a free port on 127.0.0.1, and kills only the server it started, also when a check throws. Each check prints `PASS <what>` or `FAIL <what> (<detail>)`. The last line is `web-verify PASS (<n> checks)` or `web-verify FAIL: <k> of <n> checks`; the exit code matches. Paste that line in the report. The password is never printed.

Two lanes can run at once: each takes a free port, but both write to the same commit folder unless one passes `--out`.

## What it drives

The feature map in [`features/`](features/README.md) says how each part is reached and what proves it. In short:

1. Signed out: a private path redirects to `/login?next=…`; sign in, the wrong-password error, Create account's 18+ check and its Sand-until-valid button, forgot password, check your email, and sign in at 390.
2. A real QR sign-in: the page's code (from `data-qr-value`) is approved with the e2e user's token through `qr-approve` (its `check` step, then `approve`), the way the phone does, and the browser must land on `/home`.
3. Signed in by password, every app route at each width in both themes. Per route it asserts the layout (`<html data-layout>`), that only that layout's nav shows (no tab bar on pushed pages at 390), the page title, the theme's ground colour and no sideways scroll.
4. Reduced motion: Add slides in normally and fades under `prefers-reduced-motion`.
5. Keys at 1440: Ctrl K, typing, Enter, `/`, Esc, `?`, G then D, Tab from the palette into Moni chat, the theme switch toast with Undo, Ctrl Z, and the account menu.
6. At 1024 it opens Add, types into it, resizes to 390 and back, and asserts the route, the text and the same DOM element survive.

Only the QR step calls `qr-start` for real. `qr-start` allows 10 live requests per address for 10 minutes, so every other page that shows the QR gets a stubbed code (`stubQr`). Opening `/login` by hand at 1024 wide or more uses one request each time. If the QR step fails with "Too many sign-in codes", wait 10 minutes; another lane on this machine may be using the same allowance.

## Evidence

Screenshots go to `~/.local/share/moni-canvas/web-r1/renders/app/<commit>[-dirty]/`, beside the board renders: `<route>-<width>-<light|dark>.png`, the auth states, the palette, shortcuts, account menu, Moni chat, toast and Add before and after the resize. `pairs/` holds the board render on the left and the app on the right, at the same height, for the screens a board draws (W2-Auth's states, and Home at each width against W2-Home for the shell's chrome). Open every pair and list each difference in the report. A difference the change intends is fine; say which. Cleanup never deletes this folder.

## Extending it

Each screen phase adds its route to `ROUTES` (with `pushed: true` for a page pushed over a tab on the phone), its board pair in `pair(…)`, and its keys to the keyboard section. Assert what a user sees (a role, a label, a URL, a computed colour), not a class name. Wait for `open(page, path)` (it waits until the shell's keys work) before pressing a key, and `settle(page)` runs before every screenshot so none catches an entrance animation half way.
