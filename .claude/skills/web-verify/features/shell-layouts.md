# The shell at four widths

## Sub-features

Ink sidebar (1360 wide and up), labelled rail (1024 to 1359), rail with one column (700 to 1023, panes overlay with a scrim), phone layout (under 700 wide or under 500 tall: floating Ink tab bar, phone headers, panes full screen, no tab bar on pushed pages). Light, dark and System themes. Moni chat docked (`?pane=chat`) and Add (`?pane=add`). Each section's title and W2-Empty empty state.

## How to get to it (user POV)

Sign in, then resize the window. Routes: `/home`, `/activity`, `/budget`, `/debts`, `/settings`. Review is a drawer on Home (`/home?review=deck`), not a route; `/review` redirects there.

## Driving it with Playwright

- The layout: `document.documentElement.dataset.layout` (`sidebar`, `rail`, `rail-one-column`, `phone`). The navs: `nav.sidebar`, `nav.rail`, `nav.tabbar`; exactly one is displayed.
- The theme: put `localStorage['moni-theme']` to `system` and set the context's `colorScheme`, or `light` / `dark` to force it. The body ground is `rgb(246, 242, 233)` light and `rgb(11, 10, 9)` dark.
- A half-typed field: `#add-draft` in Add, `getByLabel('Ask or add a transaction')` in Moni chat. Mark the element (`data-marker`) before a resize to prove it was not remounted.

## Gotchas

- Wait for `<html data-shell-ready="true">` before pressing keys; the drive's `open()` does.
- Panes slide in for 434 ms; read their box after `settle()`.
