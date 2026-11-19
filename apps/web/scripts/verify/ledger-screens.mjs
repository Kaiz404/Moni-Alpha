// Home and Activity against the e2e seed: the numbers the screens show are checked against the rows the
// dev project holds, read here over REST with the e2e user's token, so the oracle shares no code with the app.
import { join } from 'node:path';

const MINUS = '−';

function money(minor) {
  const value = Math.abs(minor) / 100;
  return `${minor < 0 ? MINUS : ''}RM${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const minorOf = (amount) => Math.round(Number(amount) * 100);

/** The seed's rows for the e2e user, and the day the seed was written for (its newest transaction's day). */
export async function readSeed({ supabaseUrl, publishable, token }) {
  const get = async (path) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  };
  const [transactions, profiles, proposals, aliases] = await Promise.all([
    get('transactions?deleted=eq.false&select=id,type,amount,currency,merchant,description,transaction_date,analysis_excluded,debt_activity_id,category_id'),
    get('profiles?select=preferences'),
    get('proposed_transactions?deleted=eq.false&select=id,status,snoozed_until,amount,type'),
    get('merchant_aliases?deleted=eq.false&select=raw_key,display_name').catch(() => []),
  ]);
  const zone = profiles[0]?.preferences?.finance_timezone ?? 'Asia/Kuala_Lumpur';
  const currency = profiles[0]?.preferences?.currency ?? 'MYR';
  const dayOf = (at) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(at));
  const seedDay = transactions.map((row) => dayOf(row.transaction_date)).sort().at(-1);
  // 3 pm on the seed's day in the user's zone: the clock every pinned page reads.
  const guess = Date.parse(`${seedDay}T15:00:00Z`);
  const wall = Date.parse(`${new Date(guess).toLocaleString('en-US', { timeZone: zone, hour12: false })} UTC`);
  const pin = new Date(guess - (wall - guess));
  return { transactions, proposals, aliases, zone, currency, dayOf, seedDay, pin };
}

/** What the screens must show for that day, by the ledger's rules: spending is an expense that is neither a balance fix nor debt cash. */
export function expected(seed) {
  const { transactions, proposals, currency, dayOf, seedDay } = seed;
  const month = seedDay.slice(0, 7);
  const spentMinor = transactions
    .filter(
      (row) =>
        row.type === 'expense' &&
        !row.analysis_excluded &&
        !row.debt_activity_id &&
        row.currency === currency &&
        dayOf(row.transaction_date).startsWith(month) &&
        dayOf(row.transaction_date) <= seedDay,
    )
    .reduce((sum, row) => sum + minorOf(row.amount), 0);
  const newest = transactions
    .filter((row) => row.currency === currency)
    .sort((a, b) => Date.parse(b.transaction_date) - Date.parse(a.transaction_date))[0];
  const sign = newest.type === 'expense' ? MINUS : newest.type === 'income' ? '+' : '';
  const waiting = proposals.filter((row) => row.amount !== null && row.type !== null && (row.status === 'pending' || (row.status === 'later' && (!row.snoozed_until || Date.parse(row.snoozed_until) <= seed.pin.getTime())))).length;
  const names = [newest.merchant, newest.description, ...seed.aliases.map((alias) => alias.display_name)].filter(Boolean);
  return {
    spent: money(spentMinor),
    recentAmount: `${sign}${money(minorOf(newest.amount)).replace(MINUS, '')}`,
    recentNames: names,
    waiting,
    monthRows: transactions.filter((row) => row.currency === currency && dayOf(row.transaction_date).startsWith(month) && dayOf(row.transaction_date) <= seedDay).length,
  };
}

export async function driveLedgerScreens({ browser, storage, base, check, shot, settle, pair, boardBand, OUT, seed }) {
  const want = expected(seed);
  const pinned = async (options) => {
    const ctx = await browser.newContext({ storageState: storage, timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    return ctx;
  };
  const waitLoaded = (page, selector) => page.waitForSelector(`${selector}[data-loaded]`, { timeout: 30_000 }).catch(() => null);

  // ---------- Home: the numbers ----------
  const homeCtx = await pinned({ viewport: { width: 1440, height: 900 } });
  const h = await homeCtx.newPage();
  await h.goto(`${base}/home`);
  await waitLoaded(h, '.home');
  await h.waitForTimeout(800);
  const spentLabel = (await h.locator('.spent-card [role="img"]').getAttribute('aria-label').catch(() => '')) ?? '';
  check(`Home's spent chart says ${want.spent}, the seed's spend this month by ${seed.seedDay}`, spentLabel.includes(want.spent), { spentLabel, want: want.spent });
  const firstName = (await h.locator('.recent-card .txn-row .row-title').first().textContent().catch(() => '')) ?? '';
  const firstAmount = (await h.locator('.recent-card .txn-row .txn-amount').first().textContent().catch(() => '')) ?? '';
  check(
    "Recent's first row is the seed's newest transaction",
    firstAmount === want.recentAmount && want.recentNames.includes(firstName),
    { firstName, firstAmount, want: [want.recentNames.slice(0, 2), want.recentAmount] },
  );
  const reviewTitle = (await h.locator('.review-card .card-title').first().textContent().catch(() => '')) ?? '';
  check(
    `the review card counts the seed's ${want.waiting} waiting captures`,
    reviewTitle.startsWith(want.waiting === 1 ? '1 capture' : `${want.waiting} captures`),
    { reviewTitle, waiting: want.waiting },
  );
  const usual = h.getByRole('button', { name: /^Approve all \d+ usual$/ });
  check('"Approve all usual" sits at the foot of the review card', await usual.isVisible().catch(() => false));

  // Pace | Daily with P and D, and the tooltip only under the pointer.
  check('at rest the chart shows no tooltip', (await h.locator('.spent-card .chart-tip').count()) === 0);
  const plot = h.locator('.spent-card .chart-area');
  const box = await plot.boundingBox();
  await h.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  const tip = h.locator('.spent-card .chart-tip');
  await tip.waitFor({ timeout: 2000 }).catch(() => {});
  const tipText = (await tip.textContent().catch(() => '')) ?? '';
  check('pointing at the chart shows the day and the total by then', /^\w{3} \d{1,2} \w{3}RM[\d,]+\.\d\d$/.test(tipText), tipText);
  const tipBox = await tip.boundingBox().catch(() => null);
  await h.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await h.waitForTimeout(100);
  const tipBox2 = await tip.boundingBox().catch(() => null);
  check('the tooltip follows the pointer', tipBox && tipBox2 && tipBox2.x > tipBox.x, { tipBox, tipBox2 });
  await shot(h, 'home-1440-hover');
  await h.mouse.move(5, 5);
  await h.keyboard.press('d');
  check('D shows Daily', (await h.getByRole('radio', { name: 'Daily' }).getAttribute('aria-checked')) === 'true');
  await h.waitForTimeout(400);
  check('Daily draws one bar a day so far', (await h.locator('.spent-card .bar').count()) === Number(seed.seedDay.slice(8)));
  await shot(h, 'home-1440-daily');
  await h.keyboard.press('p');
  check('P goes back to Pace', (await h.getByRole('radio', { name: 'Pace' }).getAttribute('aria-checked')) === 'true');

  // Customise: hide a card, swap two, Esc ends it; Reset puts everything back.
  await h.getByRole('button', { name: 'Customise Home' }).click();
  check('Customise turns the title into "Customise Home"', (await h.locator('h1.page-title').textContent()) === 'Customise Home');
  await h.getByRole('switch', { name: 'Show Where you spend on Home' }).click();
  await h.waitForTimeout(500);
  check('a card hides with its switch', (await h.locator('[data-slot-card="map"]').getAttribute('data-hidden')) === 'true');
  await h.getByRole('button', { name: /^Move Recent/ }).focus();
  await h.keyboard.press('ArrowRight');
  await h.waitForTimeout(500);
  check('arrow keys on a grip swap the card into the next slot', (await h.locator('.slot-2').getAttribute('data-slot-card')) === 'recent');
  await settle(h);
  await shot(h, 'home-1440-customise');
  await pair('home-customise-1440', 'r2/edit/W2-Home.png', join(OUT, 'home-1440-customise.png'));
  await h.keyboard.press('Escape');
  check('Esc ends Customise', (await h.locator('h1.page-title').textContent()) !== 'Customise Home');
  await h.reload();
  await waitLoaded(h, '.home');
  check('the layout survives a reload', (await h.locator('.slot-2').getAttribute('data-slot-card')) === 'recent');
  await h.getByRole('button', { name: 'Customise Home' }).click();
  await h.getByRole('button', { name: 'Reset' }).click();
  await h.keyboard.press('Escape');
  await h.waitForTimeout(500);
  check('Reset puts every card back', (await h.locator('.slot-1').getAttribute('data-slot-card')) === 'recent' && (await h.locator('[data-slot-card="map"]').getAttribute('data-hidden')) === null);
  await homeCtx.close();

  // Each Home width, light and dark, at the seed's day, against W2-Home and W2-Responsive.
  const widths = [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
  ];
  for (const theme of ['light', 'dark']) {
    for (const size of widths) {
      const ctx = await pinned({ viewport: size, colorScheme: theme });
      await ctx.addInitScript((t) => localStorage.setItem('moni-theme', t), theme);
      const p = await ctx.newPage();
      for (const path of ['/home', '/activity']) {
        await p.goto(`${base}${path}`);
        await waitLoaded(p, path === '/home' ? '.home' : '.activity');
        await p.waitForTimeout(600);
        const wide = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
        check(`${path} at ${size.width} ${theme} with the seed: no sideways scroll`, wide);
        await shot(p, `${path.slice(1)}-seed-${size.width}-${theme}`);
      }
      await ctx.close();
    }
  }
  await pair('home-seed-1440', 'r2/W2-Home.png', join(OUT, 'home-seed-1440-light.png'));
  await pair('home-seed-1024', await boardBand('r3/W2-Responsive.png', 'responsive-home-desktop', 1450, 900), join(OUT, 'home-seed-1024-light.png'));
  await pair('home-seed-390', await boardBand('r3/W2-Responsive.png', 'responsive-home-phone', 1950, 900), join(OUT, 'home-seed-390-light.png'));
  await pair('activity-seed-1440', 'r2/W2-Activity.png', join(OUT, 'activity-seed-1440-light.png'));
  await pair('activity-seed-820-390', await boardBand('r3/W2-Responsive.png', 'responsive-activity', 3340, 720), join(OUT, 'activity-seed-390-light.png'));

  // ---------- Activity ----------
  const actCtx = await pinned({ viewport: { width: 1440, height: 900 } });
  const a = await actCtx.newPage();
  await a.goto(`${base}/activity`);
  await waitLoaded(a, '.activity');
  await a.waitForTimeout(600);
  const total = (await a.locator('.running-total').textContent().catch(() => '')) ?? '';
  check(`Activity's chart leads with ${want.spent} spent this month`, total === want.spent, { total, want: want.spent });
  const range = (await a.locator('.activity-foot .meta').textContent().catch(() => '')) ?? '';
  const rows = await a.locator('.activity-table [role="row"][data-row-id]').count();
  check(
    `the table pages the seed's ${want.monthRows} rows this month 25 at a time`,
    range === `${want.monthRows ? 1 : 0}–${Math.min(25, want.monthRows)} of ${want.monthRows}` && rows === Math.min(25, want.monthRows),
    { range, rows, want: want.monthRows },
  );
  await a.getByRole('button', { name: 'Amount', exact: true }).click();
  await a.waitForURL(/sort=amount/).catch(() => {});
  check('a column head sorts and the sort goes in the URL', a.url().includes('sort=amount'), a.url());
  await a.getByRole('button', { name: 'Amount', exact: true }).click();
  await a.waitForURL(/dir=asc/).catch(() => {});
  check('a second click flips the sort', a.url().includes('dir=asc'), a.url());
  await a.goto(`${base}/activity`);
  await waitLoaded(a, '.activity');

  await a.keyboard.press('j');
  await a.waitForURL(/\/activity\/[0-9a-f-]{36}/).catch(() => {});
  const firstOpen = a.url();
  check('J opens the first row in the docked pane, and the row is the path', /\/activity\/[0-9a-f-]{36}/.test(firstOpen) && (await a.getByRole('complementary', { name: 'Transaction' }).isVisible()), firstOpen);
  await a.keyboard.press('j');
  await a.waitForTimeout(300);
  check('J moves to the next row', a.url() !== firstOpen, a.url());
  await a.keyboard.press('k');
  await a.waitForTimeout(300);
  check('K moves back', a.url() === firstOpen, a.url());
  await settle(a);
  await shot(a, 'activity-1440-pane');
  await pair('activity-pane-1440', 'r2/W2-Activity.png', join(OUT, 'activity-1440-pane.png'));
  await a.keyboard.press('x');
  const bulk = a.getByRole('toolbar', { name: 'Selected rows' });
  check('X ticks the open row and the Ink bulk bar appears', (await bulk.isVisible()) && /^1 selected/.test((await bulk.locator('.bulk-count').textContent()) ?? ''));
  await a.locator('.activity-table [role="row"][data-row-id]').nth(2).getByRole('checkbox').click();
  check('a second tick counts 2', /^2 selected/.test((await bulk.locator('.bulk-count').textContent()) ?? ''));
  await settle(a);
  await shot(a, 'activity-1440-bulk');
  await a.keyboard.press('Escape');
  check('Esc clears the ticks first', !(await bulk.isVisible()));
  await a.keyboard.press('Escape');
  await a.waitForURL(`${base}/activity`).catch(() => {});
  check('then Esc closes the pane', a.url() === `${base}/activity`, a.url());

  const third = a.locator('.activity-table [role="row"][data-row-id]').nth(3);
  await third.click({ button: 'right' });
  const menu = a.getByRole('menu');
  check('right-click opens the row menu', await menu.isVisible());
  check('the menu offers Delete', await menu.getByRole('menuitem', { name: /Delete/ }).isVisible());
  await settle(a);
  await shot(a, 'activity-1440-menu');
  await a.keyboard.press('Escape');
  check('Esc closes the menu', !(await menu.isVisible().catch(() => false)));
  await third.hover();
  await a.waitForTimeout(250);
  check('pointing at a row shows its ⋯', (await third.locator('.more').evaluate((el) => getComputedStyle(el).opacity)) === '1');

  // One write, undone: a category changed in its cell, then Ctrl Z.
  const editRow = a.locator('.activity-table [role="row"][data-row-id]').filter({ has: a.locator('.cell') }).first();
  const rowId = await editRow.getAttribute('data-row-id');
  const before = (await editRow.locator('.cell-text').first().textContent()) ?? '';
  await editRow.locator('.cell').dblclick();
  const input = a.locator('#cell-edit-input');
  check('a double-click edits the category in its cell', await input.isVisible());
  const options = a.getByRole('listbox', { name: 'Categories' }).getByRole('option');
  const target = ((await options.allTextContents()).map((text) => text.replace(/RM.*$/, '').trim()).find((name) => name && name !== before)) ?? '';
  await input.fill(target);
  await settle(a);
  await shot(a, 'activity-1440-cell-edit');
  await input.press('Enter');
  await a.waitForTimeout(400);
  const after = (await a.locator(`[data-row-id="${rowId}"] .cell-text`).first().textContent()) ?? '';
  check(`Enter saves ${target} in place`, after === target, { before, after, target });
  await a.keyboard.press('Control+z');
  await a.waitForTimeout(400);
  const undone = (await a.locator(`[data-row-id="${rowId}"] .cell-text`).first().textContent()) ?? '';
  check('Ctrl Z puts the category back', undone === before, { before, undone });

  await a.getByRole('radio', { name: 'List' }).click();
  await a.waitForURL(/show=list/).catch(() => {});
  check('List shows the rows grouped by day, and the URL keeps it', a.url().includes('show=list') && (await a.locator('.activity-days').isVisible()));
  await a.reload();
  await waitLoaded(a, '.activity');
  check('a reload keeps the list', (await a.getByRole('radio', { name: 'List' }).getAttribute('aria-checked')) === 'true');
  await shot(a, 'activity-1440-list');
  await actCtx.close();

  // ---------- a half-typed cell edit crosses 700 and back ----------
  const crossCtx = await pinned({ viewport: { width: 1024, height: 768 } });
  const c = await crossCtx.newPage();
  await c.goto(`${base}/activity`);
  await waitLoaded(c, '.activity');
  await c.locator('.activity-table .cell').first().dblclick();
  const half = c.locator('#cell-edit-input');
  await half.fill('Gro');
  await half.evaluate((el) => {
    el.dataset.marker = 'kept';
  });
  await c.setViewportSize({ width: 390, height: 844 });
  await c.waitForFunction(() => document.documentElement.dataset.layout === 'phone');
  await c.setViewportSize({ width: 1024, height: 768 });
  await c.waitForFunction(() => document.documentElement.dataset.layout === 'rail');
  check(
    'a half-typed category survives crossing 700 and back, in the same element',
    (await half.inputValue().catch(() => '')) === 'Gro' && (await half.getAttribute('data-marker').catch(() => null)) === 'kept',
  );
  await half.press('Escape');
  await crossCtx.close();

  // ---------- the phone layout: the detail is a pushed page ----------
  const phoneCtx = await pinned({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const ph = await phoneCtx.newPage();
  await ph.goto(`${base}/activity`);
  await waitLoaded(ph, '.activity');
  check('the phone layout shows the search field and the type chips', (await ph.getByRole('radio', { name: 'Expenses' }).isVisible()) && (await ph.getByPlaceholder('Search merchant, note or amount').isVisible()));
  await ph.locator('.activity-days [data-row-id]').first().click();
  await ph.waitForURL(/\/activity\/[0-9a-f-]{36}/).catch(() => {});
  const pushed = ph.getByRole('complementary', { name: 'Transaction' });
  await pushed.waitFor().catch(() => {});
  await settle(ph);
  const pushedBox = await pushed.boundingBox().catch(() => null);
  check(
    'a row opens its detail full screen, with no tab bar',
    Math.round(pushedBox?.x ?? -1) === 0 && Math.round(pushedBox?.width ?? 0) === 390 && !(await ph.locator('nav.tabbar').isVisible()),
    pushedBox,
  );
  await shot(ph, 'activity-390-detail');
  await ph.getByRole('button', { name: 'Back' }).click();
  await ph.waitForURL(`${base}/activity`).catch(() => {});
  check('Back returns to the list', ph.url() === `${base}/activity`, ph.url());
  await phoneCtx.close();
}
