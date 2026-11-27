// All wallets and a wallet's page in web-verify (`--only wallets`): the sidebar's Wallets and Map
// open their pages and light themselves, All wallets asks the check-in, every
// wallet's balance against the e2e user's wallet_balances, Home's wallet strip with a mouse drag undone by Ctrl Z, net worth in the main currency, a wallet's
// page with its transactions, Edit amount saved then undone with Ctrl Z, and the New wallet and Edit
// wallet panes closing on Esc, and deleting the default wallet then Ctrl Z. Each write is undone before the part ends.

function ringgit(text) {
  const match = /(−|-)?[^\d−-]*([\d,]+(?:\.\d+)?)/.exec((text ?? '').replace(/\s/g, ''));
  if (!match) return Number.NaN;
  const value = Number(match[2].replace(/,/g, ''));
  return match[1] ? -value : value;
}

export async function verifyWallets(t) {
  const { browser, storage, check, shot, settle, open, widths, background, query, seed } = t;
  async function until(name, test, ms = 20_000) {
    const end = Date.now() + ms;
    let rows = query(name);
    while (!test(rows) && Date.now() < end) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      rows = query(name);
    }
    return test(rows);
  }
  const pinned = async (options) => {
    const ctx = await browser.newContext({ timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    return ctx;
  };
  const wallets = query('wallets');
  const main = wallets.filter((wallet) => wallet.currency === seed.currency);
  const netWorth = Math.round(main.reduce((sum, wallet) => sum + Number(wallet.current_balance), 0) * 100);

  for (const theme of ['light', 'dark']) {
    for (const size of widths) {
      const ctx = await pinned({ viewport: { width: size.width, height: size.height }, storageState: storage, colorScheme: theme });
      await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      const p = await ctx.newPage();
      await open(p, '/home/wallets');
      await p.locator('[data-screen="wallets"]').waitFor({ timeout: 20_000 });
      const where = `/home/wallets at ${size.width} ${theme}`;
      const state = await p.evaluate(() => ({
        layout: document.documentElement.dataset.layout,
        bg: getComputedStyle(document.body).backgroundColor,
        wide: document.documentElement.scrollWidth <= innerWidth,
        title: document.querySelector('h1:not([hidden])')?.textContent,
      }));
      const rows = await p.locator('.wallet-line').count();
      check(
        `${where}: ${size.layout}, ${theme} ground, a row for each of the ${wallets.length} wallets, no sideways scroll`,
        state.layout === size.layout && state.bg === background[theme] && state.wide && rows === wallets.length,
        { ...state, rows },
      );
      await shot(p, `wallets-${size.width}-${theme}`);
      await ctx.close();
    }
  }

  const ctx = await pinned({ viewport: { width: 1440, height: 900 }, storageState: storage });
  const p = await ctx.newPage();
  await open(p, '/home');
  const strip = p.locator('.wallet-strip');
  await strip.locator('.wallet-card').first().waitFor({ timeout: 20_000 });
  const cards = () =>
    strip.locator('.wallet-card').evaluateAll((links) =>
      links.map((link) => ({ id: link.dataset.wallet, label: link.getAttribute('aria-label'), x: link.getBoundingClientRect().left })).sort((a, b) => a.x - b.x),
    );
  const atRest = await cards();
  const others = wallets.length - main.length;
  check(
    "Home's wallet strip has a card per wallet: the main currency's first, the others in their own money",
    atRest.length === wallets.length &&
      atRest.slice(0, main.length).every((card) => card.label?.includes('RM')) &&
      atRest.slice(main.length).every((card) => !card.label?.includes('RM')) &&
      (await strip.locator('.wallet-strip-divider').count()) === (others > 0 ? 1 : 0),
    atRest,
  );
  await shot(p, 'home-wallet-strip-1440-light');
  if (main.length > 1) {
    const box = await strip.locator(`.wallet-card[data-wallet="${atRest[0].id}"]`).boundingBox();
    await p.mouse.move(box.x + 40, box.y + 48);
    await p.mouse.down();
    await p.mouse.move(box.x + 210, box.y + 48, { steps: 12 });
    await p.mouse.up();
    await p.waitForTimeout(700);
    const moved = await cards();
    check(
      'dragging a card past its neighbour with the mouse swaps them, and Home stays',
      moved[0]?.id === atRest[1].id && moved[1]?.id === atRest[0].id && new URL(p.url()).pathname === '/home',
      { moved, url: p.url() },
    );
    await p.keyboard.press('Control+z');
    await p.waitForTimeout(700);
    const back = await cards();
    check('Ctrl Z puts the wallet order back', back.map((card) => card.id).join() === atRest.map((card) => card.id).join(), back);
  }
  check('Home in landscape has the wallet strip and no Wallets card or check-in', (await p.locator('section[aria-label="Wallets"]').count()) === 0 && !(await p.getByRole('region', { name: 'Check-in' }).isVisible()));
  const nav = p.getByRole('navigation', { name: 'Moni' });
  await nav.getByRole('link', { name: 'Map', exact: true }).click();
  await p.waitForURL(/\/home\/places$/);
  check("the sidebar's Map opens Where you spend and lights itself, not Home", (await nav.getByRole('link', { name: 'Map', exact: true }).getAttribute('aria-current')) === 'page' && (await nav.getByRole('link', { name: 'Home', exact: true }).getAttribute('aria-current')) === null, p.url());
  await nav.getByRole('link', { name: 'Wallets', exact: true }).click();
  await p.waitForURL(/\/home\/wallets$/);
  await p.locator('[data-screen="wallets"]').waitFor({ timeout: 20_000 });
  check("the sidebar's Wallets opens the Wallets page and lights itself", p.url().endsWith('/home/wallets') && (await nav.getByRole('link', { name: 'Wallets', exact: true }).getAttribute('aria-current')) === 'page', p.url());
  const checkIn = p.getByRole('region', { name: 'Check-in' });
  check("All wallets asks the balance check-in in landscape, with That's right, Fix it and Not now", (await checkIn.isVisible()) && (await checkIn.getByRole('button', { name: "That's right" }).isVisible()) && (await checkIn.getByRole('button', { name: 'Fix it' }).isVisible()));
  await checkIn.getByRole('button', { name: 'Not now' }).click();
  await checkIn.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  check('Not now puts the check-in away without a write', (await checkIn.count()) === 0);

  const shown = await p.locator('.wallet-line').evaluateAll((links) =>
    links.map((link) => ({ name: link.querySelector('.row-title')?.textContent, balance: link.querySelector('.wallet-line-balance')?.textContent })),
  );
  const mismatched = wallets.filter((wallet) => {
    const row = shown.find((item) => item.name === wallet.name);
    return !row || Math.round(ringgit(row.balance) * 100) !== Math.round(Number(wallet.current_balance) * 100);
  });
  check('every wallet shows its balance from wallet_balances', mismatched.length === 0, { mismatched, shown });
  const total = Number(await p.locator('[data-net-worth]').first().getAttribute('data-net-worth'));
  check(`net worth is the ${seed.currency} wallets' total`, total === netWorth, { total, netWorth });

  await p.getByRole('button', { name: 'New wallet' }).click();
  const form = p.getByRole('form', { name: 'New wallet' });
  await form.waitFor();
  await form.getByRole('combobox', { name: /^Type: / }).click();
  await p.getByRole('listbox', { name: 'Type' }).getByRole('option', { name: 'Cash' }).click();
  const typeShown = await form.getByRole('combobox', { name: /^Type: / }).getAttribute('aria-label');
  await form.getByRole('combobox', { name: /^Currency: / }).click();
  const currencyList = p.getByRole('listbox', { name: 'Currency' });
  const currencyRows = await currencyList.getByRole('option').count();
  await p.keyboard.press('Escape');
  const listClosed = await currencyList.waitFor({ state: 'detached', timeout: 2000 }).then(() => true, () => false);
  check(
    "New wallet's Type and Currency open Moni's own lists, and Esc closes a list before the form",
    typeShown === 'Type: Cash' && currencyRows > 1 && listClosed && (await form.isVisible()) && (await form.locator('select').count()) === 0,
    { typeShown, currencyRows, listClosed },
  );
  await p.keyboard.press('Escape');
  await form.waitFor({ state: 'detached' }).catch(() => {});
  check('New wallet opens in the side panel and Esc closes it', !(await form.isVisible()) && !p.url().includes('new='), p.url());

  const first = p.locator('.wallet-line').first();
  const name = await first.locator('.row-title').textContent();
  await first.click();
  await p.waitForURL(/\/home\/wallets\/[0-9a-f-]+$/);
  await p.locator('[data-screen="wallet"]').waitFor({ timeout: 20_000 });
  const hero = await p.locator('.wallet-hero-name').textContent();
  const listed = await p.locator('.wallet-txns .txn-row').count();
  check('a wallet row opens its page with its name and transactions', hero === name && listed > 0, { hero, name, listed });
  await shot(p, 'wallet-1440-light');

  const before = Number(await p.locator('[data-balance-minor]').getAttribute('data-balance-minor'));
  await p.getByRole('button', { name: 'Edit amount' }).click();
  await p.locator('.wallet-amount input').fill(((before + 100) / 100).toFixed(2));
  await p.getByRole('button', { name: 'Save', exact: true }).click();
  await p.waitForFunction((value) => Number(document.querySelector('[data-balance-minor]')?.getAttribute('data-balance-minor')) === value, before + 100, { timeout: 5_000 }).catch(() => {});
  const fixed = Number(await p.locator('[data-balance-minor]').getAttribute('data-balance-minor'));
  const toast = await p.getByText(/^Correction \+.*1\.00 added$/).isVisible();
  const isCorrection = (row) => row?.description === 'Balance correction' && Math.round(Number(row.amount) * 100) === 100;
  const synced = await until('latest-transaction', isCorrection);
  check('Edit amount adds a correction for the difference, says so, and it syncs', fixed === before + 100 && toast && synced, { before, fixed, toast, synced });
  await p.getByText(/^Correction \+.*1\.00 added$/).hover().catch(() => {});
  await p.keyboard.press('Control+z');
  await p.waitForFunction((value) => Number(document.querySelector('[data-balance-minor]')?.getAttribute('data-balance-minor')) === value, before, { timeout: 5_000 }).catch(() => {});
  const undone = Number(await p.locator('[data-balance-minor]').getAttribute('data-balance-minor'));
  const gone = await until('latest-transaction', (row) => !isCorrection(row));
  check('Ctrl Z takes the correction back off, on the server too', undone === before && gone, { before, undone, gone });

  await p.getByRole('button', { name: 'Edit wallet' }).click();
  const edit = p.getByRole('form', { name: 'Edit wallet' });
  await edit.waitFor();
  const typed = await edit.getByRole('textbox').first().inputValue();
  await settle(p);
  await shot(p, 'wallet-1440-light-edit');
  await p.keyboard.press('Escape');
  await edit.waitFor({ state: 'detached' }).catch(() => {});
  check('Edit wallet opens filled in and Esc closes it unsaved', typed === name && !(await edit.isVisible()), { typed, name });

  const defaultId = query('preferences')?.default_wallet_id;
  await open(p, `/home/wallets/${defaultId}`);
  await p.locator('[data-screen="wallet"]').waitFor({ timeout: 20_000 });
  const defaultName = await p.locator('.wallet-hero-name').textContent();
  await p.getByRole('button', { name: 'Delete wallet', exact: true }).click();
  await p.getByRole('alertdialog', { name: `Delete ${defaultName}?` }).getByRole('button', { name: 'Delete', exact: true }).click();
  await p.waitForURL(/\/home\/wallets$/);
  const cleared = await until('preferences', (prefs) => prefs?.default_wallet_id === null);
  const walletGone = await until('wallets', (rows) => !rows.some((row) => row.name === defaultName));
  check('deleting the default wallet clears the default on the server', cleared && walletGone, { defaultId, defaultName, cleared, walletGone });
  await p.getByText(`${defaultName} deleted`).hover().catch(() => {});
  await p.keyboard.press('Control+z');
  const restored = await until('preferences', (prefs) => prefs?.default_wallet_id === defaultId);
  const walletBack = await until('wallets', (rows) => rows.some((row) => row.name === defaultName));
  check('Ctrl Z brings the wallet back as the default', restored && walletBack, { defaultId, restored, walletBack });
  await ctx.close();
}
