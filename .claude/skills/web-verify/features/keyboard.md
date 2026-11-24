# Keys, command bar, toasts, account menu

## Sub-features

Ctrl K command bar (Go to and Actions, at most three rows a group while typing, "Ask Moni: <words>" with Tab), `/` Moni chat, `N` Add, `?` shortcuts dialog, `Esc` closes the top overlay then the pane, `Ctrl Z` runs the toast's Undo, G then H A B D W M R S. Toasts bottom left (above the tab bar on the phone), one at a time, 4 s with a Mint bar that pauses while pointed at. The account menu from the name at the foot of the sidebar or rail: Settings, Theme, Shortcuts, Help, Sign out.

## How to get to it (user POV)

Any signed-in page at desktop width. Keys rest while the focus is in a field, except Ctrl K and Esc.

## Driving it with Playwright

- Command bar: `getByRole('dialog', { name: 'Search or ask Moni' })`, rows `getByRole('option')`.
- Shortcuts: `getByRole('dialog', { name: 'Keyboard shortcuts' })`. Press `Shift+?`.
- Toast: `getByRole('status').filter({ hasText: … })`, its `Undo` button.
- Account menu: the button whose name ends in "Settings" opens `getByRole('menu', { name: 'Account' })`.
- The theme switch from the command bar is the one action with a toast today; `<html data-theme>` shows the result.

## Gotchas

- Screen keys go through `useScreenKeys` (`src/lib/screen-keys.ts`) and are listed in `SHORTCUT_GROUPS`. Home: P, D, Esc ends Customise. Activity: J, K, X, Enter, C, Del, and Esc (closes a menu or cell edit, then clears the ticks, then closes the pane). Review's A and L arrive with Review.
