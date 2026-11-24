# Wallets

## Sub-features

All wallets (`/home/wallets`): net worth in the main currency with its balance chart over 1M to All, the split between money in wallets and what is owed on cards, a section a currency (main first, the others kept apart with their note), a row a wallet with its This month change and balance, Add a wallet, New wallet in the docked pane (`?new=wallet`) and Download CSV. A wallet (`/home/wallets/<id>`): its name and type, its balance with Edit amount (a correction, with Undo), its balance chart in the main currency, captures waiting for it, its transactions 25 a page, Open in Activity (`/activity?wallets=<id>`), Edit wallet in the pane (`?edit=wallet`) and Delete with a confirm. In landscape All wallets also asks the balance check-in under net worth (That's right, Fix it, Not now).

## How to get to it (user POV)

The sidebar's or rail's Wallets, or G then W; a card in Home's wallet strip opens its wallet; on the phone layout, Home's net worth. Wallets lights in the nav, Home does not.

## Driving it with Playwright

- Wait for `[data-screen="wallets"]` or `[data-screen="wallet"]`.
- Rows: `.wallet-line[data-wallet]` with `.row-title` and `.wallet-line-balance`. Net worth: `[data-net-worth]` in minor units.
- A wallet: `.wallet-hero-name`, `[data-balance-minor]`, `.wallet-amount input` once Edit amount is pressed, `.wallet-txns .txn-row`.
- Panes: the forms named `New wallet` and `Edit wallet`.
- Compare with `seed.mjs --user web --query wallets` (`wallet_balances`).

## Gotchas

- Edit amount writes a correction; undo it with Ctrl Z before the part ends so the seed fingerprint holds.
