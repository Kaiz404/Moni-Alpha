# The phone layout

## Sub-features

Every signed-in screen under 700 wide or under 500 tall (W2-Responsive, the mobile v2 boards): tab roots with the floating Ink tab bar, pushed pages (a row's pane, Where you spend, Review, Settings and its sections, Moni chat, Add) with Back and no tab bar, held sideways in the phone's 480 column, and every control a 44 target.

## How to get to it (user POV)

A phone, or any window under 700 wide or 500 tall, such as a laptop window held short.

## Driving it with Playwright

- `scripts/verify/phone-layout.mjs`'s `verifyPhoneLayout` (part `phone`) visits each screen at 390x844, 800x450 and 667x375 in both themes, pinned to the seed's day. It finds a row to open on Activity, Budget and Debts from the screen and writes nothing.
- It asserts `<html data-layout="phone">`, no sideways scroll, the tab bar on tab roots only, the title visible and the last content reachable above the tab bar, and saves `phone-<screen>-<w>x<h>-<theme>` plus a `-end` shot scrolled to the bottom.

## Gotchas

- Held sideways the shell keeps a 480 column from 520 wide; narrower than that the page spans the width.
- Popovers stay popovers on the phone layout; the phone app's bottom sheets are not drawn on the web.
