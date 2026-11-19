// First run, empty screens and the states (W2-Onboarding, W2-Empty, W2-States). The first-run part reseeds the
// web e2e user with the empty profile, walks set-up through to Home, and puts the full seed back before it ends;
// what set-up wrote is read back over REST, so the oracle shares no code with the app.

const SEED_DAY = '2026-10-14';
const ONBOARDING = 'r3/W2-Onboarding.png';
const STATES = 'r3/W2-States.png';
const EMPTY = 'r3/W2-Empty.png';
/** Where each W2-Onboarding frame starts: a 64 band, then 900 of frame, five times. */
const frameY = (n) => n * 64 + (n - 1) * 900;

/** Runs one block of checks; one that throws fails its own check and the rest still run. */
async function block(check, name, run) {
  try {
    await run();
  } catch (error) {
    check(`${name} ran to the end`, false, String(error?.message ?? error).split('\n')[0]);
  }
}

const wide = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const ground = (p) => p.evaluate(() => getComputedStyle(document.body).backgroundColor);

export async function verifyFirstRun({ browser, base, storage, check, shot, settle, pair, boardBand, out, widths, background, seed, webSeed, rest, email, password }) {
  console.log('reseeding the web e2e user with the empty profile for the first run');
  webSeed('--reset', '--profile', 'empty', '--today', SEED_DAY);
  const pinned = async (options) => {
    const ctx = await browser.newContext({ storageState: storage, timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
    return ctx;
  };
  try {
    // ---------- every empty screen, at each width in both themes ----------
    const screens = [
      { path: '/activity', name: 'activity', text: 'No spending yet' },
      { path: '/review', name: 'review', text: 'Nothing to review' },
      { path: '/budget', name: 'budget', text: 'No budgets yet' },
      { path: '/debts', name: 'debts', text: 'No debts yet' },
      { path: '/home/places', name: 'places', text: 'No places yet' },
      { path: '/settings/merchants', name: 'merchants', text: 'No codes to name yet' },
      { path: '/activity?pane=chat', name: 'chat', text: 'What did you spend?' },
    ];
    for (const theme of ['light', 'dark']) {
      for (const size of widths) {
        const ctx = await pinned({ viewport: { width: size.width, height: size.height }, colorScheme: theme });
        const p = await ctx.newPage();
        for (const screen of screens) {
          await p.goto(`${base}${screen.path}`);
          const shown = await p.getByText(screen.text, { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 20_000 }).then(() => true, () => false);
          const state = { layout: await p.evaluate(() => document.documentElement.dataset.layout), bg: await ground(p), wide: await wide(p) };
          check(
            `empty ${screen.path} at ${size.width} ${theme}: "${screen.text}", ${size.layout}, the ${theme} ground, no sideways scroll`,
            shown && state.layout === size.layout && state.bg === background[theme] && state.wide,
            { shown, ...state },
          );
          await shot(p, `empty-${screen.name}-${size.width}-${theme}`);
        }
        await ctx.close();
      }
    }

    const e = await pinned({ viewport: { width: 1440, height: 900 } });
    const ep = await e.newPage();
    await ep.goto(`${base}/activity`);
    await ep.getByText('No spending yet').waitFor({ timeout: 20_000 });
    check(
      "Activity with no transactions: the flat chart says what will draw there, and Add a transaction is the one action",
      (await ep.getByText('Your spending draws a line here, day by day, against an even pace.').isVisible()) &&
        (await ep.locator('.chart-label').allTextContents()).join('|') === 'RM–|RM0' &&
        (await ep.getByRole('button', { name: /^Add a transaction/ }).count()) === 1,
      await ep.locator('.chart-label').allTextContents(),
    );
    await ep.getByRole('button', { name: /^Add a transaction/ }).click();
    await ep.locator('aside[data-pane="add"]').waitFor({ timeout: 5000 }).catch(() => {});
    check("Activity's Add a transaction opens Add", await ep.locator('aside[data-pane="add"]').isVisible());
    await ep.keyboard.press('Escape');
    await ep.goto(`${base}/activity?categories=00000000-0000-4000-8000-000000000000`);
    await ep.getByText('Nothing matches these filters').waitFor({ timeout: 10_000 }).catch(() => {});
    check('filters that match nothing say so and offer Clear filters', await ep.getByRole('button', { name: 'Clear filters' }).isVisible());
    await ep.goto(`${base}/debts`);
    await ep.getByText('No debts yet').waitFor({ timeout: 10_000 });
    check('Debts with nobody: one Record a debt, and no empty pane beside it', (await ep.getByRole('button', { name: /Record a debt/ }).count()) === 1 && (await ep.locator('aside.side-pane').count()) === 0);
    await ep.goto(`${base}/review`);
    await ep.getByText('Nothing to review').waitFor({ timeout: 10_000 });
    check(
      'Review opened empty: no celebration, the neutral words, and where captures come from',
      !(await ep.getByText('All caught up').isVisible()) && (await ep.getByText('Captures come from bank alerts, receipts and Moni chat on your phone.').isVisible()),
    );
    await ep.keyboard.press('Control+k');
    await ep.keyboard.type('starbuks');
    const miss = await ep.getByText('No matches for “starbuks”').isVisible();
    const first = await ep.getByRole('option').first().getAttribute('aria-selected');
    check('Ctrl K with no match: Ask Moni stays first and selected, then the thinking empty with Search Activity', miss && first === 'true' && (await ep.getByRole('button', { name: 'Search Activity for “starbuks”' }).isVisible()));
    await shot(ep, 'empty-search-1440');
    await ep.getByRole('button', { name: 'Search Activity for “starbuks”' }).click();
    await ep.waitForURL(/\/activity\?q=starbuks/).catch(() => {});
    check('Search Activity carries the words into Activity', ep.url().endsWith('/activity?q=starbuks'), ep.url());
    await e.close();
    await pair('empty-activity', await boardBand(EMPTY, 'empty-activity', 1760, 440), `${out}/empty-activity-1024-light.png`);

    // ---------- set-up: a brand-new account lands in it ----------
    for (const theme of ['light', 'dark']) {
      for (const size of [...widths, { width: 800, height: 450, layout: 'phone' }]) {
        const ctx = await pinned({ viewport: { width: size.width, height: size.height }, colorScheme: theme, locale: 'en-MY' });
        const p = await ctx.newPage();
        await p.goto(`${base}/home`);
        await p.waitForURL(`${base}/welcome`, { timeout: 20_000 }).catch(() => {});
        await p.getByRole('heading', { name: 'Your main currency' }).waitFor({ timeout: 20_000 }).catch(() => {});
        const where = `set-up at ${size.width}x${size.height} ${theme}`;
        const picked = await p.getByRole('option', { selected: true }).textContent().catch(() => '');
        check(
          `${where}: a brand-new account lands on step 1 with MYR suggested by the browser, no sideways scroll`,
          p.url() === `${base}/welcome` && /MYR\s*Malaysian ringgit/.test(picked ?? '') && (await wide(p)) && (await ground(p)) === background[theme],
          { url: p.url(), picked },
        );
        await shot(p, `setup-1-${size.width}x${size.height}-${theme}`);
        await p.keyboard.press('Enter');
        await p.getByRole('heading', { name: /Moni's AI, your choice/ }).waitFor({ timeout: 5000 }).catch(() => {});
        check(`${where}: Enter moves to Moni's AI`, await p.getByRole('button', { name: "Turn on Moni's AI" }).isVisible());
        await shot(p, `setup-2-${size.width}x${size.height}-${theme}`);
        await ctx.close();
      }
    }

    // ---------- set-up, all four steps, at 1440 ----------
    await block(check, 'set-up at 1440', async () => {
      // Its own sign-in: Moni's AI refreshes the session, and a refresh token the shared storage also holds
      // can be spent only once, so a refresh here must not race the drive's other contexts.
      const s = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-MY', timezoneId: seed.zone });
      await s.clock.setFixedTime(seed.pin);
      const sp = await s.newPage();
      sp.on('console', (message) => message.type() === 'error' && console.log(`  set-up console: ${message.text().slice(0, 400)}`));
      await sp.goto(`${base}/login`);
      await sp.getByLabel('Email').fill(email);
      await sp.getByLabel('Password', { exact: true }).fill(password);
      await sp.locator('form button[type="submit"]').click();
      await sp.waitForURL(`${base}/welcome`, { timeout: 30_000 }).catch(() => {});
      check('signing in to a brand-new account lands on set-up', sp.url() === `${base}/welcome`, sp.url());
      await sp.getByRole('heading', { name: 'Your main currency' }).waitFor({ timeout: 20_000 });
      await sp.keyboard.press('/');
      await sp.keyboard.type('singapore');
      check('/ searches the currencies, by country too', (await sp.getByRole('option').allTextContents()).join('|').includes('Singapore dollar'));
      await sp.getByLabel('Search currencies').fill('ringgit');
      await sp.getByRole('option', { name: /Malaysian ringgit/ }).click();
      await pair('setup-1', await boardBand(ONBOARDING, 'setup-1', frameY(1), 900), await shot(sp, 'setup-1-1440-picked'));
      await sp.getByRole('button', { name: /^Continue/ }).click();
      await sp.getByRole('heading', { name: /Moni's AI, your choice/ }).waitFor();
      await pair('setup-2', await boardBand(ONBOARDING, 'setup-2', frameY(2), 900), await shot(sp, 'setup-2-1440'));
      await sp.getByRole('button', { name: 'Not now' }).click();
      await sp.getByRole('heading', { name: 'Add your wallets' }).waitFor({ timeout: 15_000 }).catch(() => {});
      const consent = await rest('ai_consent_current?select=use,granted');
      check("Not now records Moni's AI as off through @repo/data, and moves to wallets", consent.some((row) => row.use === 'all' && row.granted === false), consent);
      check('Continue stays off until a wallet has a name', await sp.getByRole('button', { name: /^Continue/ }).isDisabled());
      await sp.getByLabel('Wallet 1 name').fill('Maybank Savings');
      await sp.getByLabel('Wallet 1 starting balance').fill('2,281.80');
      await sp.getByLabel('Wallet 2 name').fill('Cash');
      await sp.getByLabel('Wallet 2 starting balance').fill('63.60');
      await sp.getByRole('button', { name: 'Add another wallet' }).click();
      await sp.getByLabel('Wallet 3 name').fill('Wise USD');
      await sp.getByLabel('Wallet 3 type').selectOption('bank');
      await sp.getByLabel('Wallet 3 starting balance').fill('120');
      await sp.getByLabel('Wallet 3 currency').selectOption('USD');
      const preview = (await sp.locator('.setup-preview').textContent()) ?? '';
      check('the preview adds up only the MYR wallets and says the USD one keeps its own currency', preview.includes('RM2,345.40') && preview.includes('Wise USD keeps its own currency'), preview);
      await pair('setup-3', await boardBand(ONBOARDING, 'setup-3', frameY(3), 900), await shot(sp, 'setup-3-1440'));
      await sp.keyboard.press('Enter');
      await sp.getByRole('heading', { name: 'Get Moni on your phone' }).waitFor();
      const mail = await sp.getByRole('link', { name: 'Email me the link' }).getAttribute('href');
      check('step 4 shows the QR, Google Play, and mails the link to the signed-in address', (await sp.locator('[data-qr-value]').count()) === 1 && /^mailto:e2e/.test(mail ?? ''), mail);
      check('no App Store, only Android', !(await sp.getByText(/App Store/).count()));
      await pair('setup-4', await boardBand(ONBOARDING, 'setup-4', frameY(4), 900), await shot(sp, 'setup-4-1440'));
      await sp.getByRole('button', { name: /^Finish set-up/ }).click();
      await sp.waitForURL(`${base}/home`, { timeout: 30_000 }).catch(() => {});
      const card = sp.getByRole('region', { name: 'Get set up' });
      await card.waitFor({ timeout: 20_000 }).catch(() => {});
      check('Finish lands on Home with Get set up, 3 of 5 done', sp.url() === `${base}/home` && (await card.getByText('3 of 5 done').isVisible()), sp.url());
      check('Home welcomes the new account', (await sp.locator('h1:visible').first().textContent()) === 'Welcome to Moni, Kai');
      await settle(sp);
      await pair('setup-home', await boardBand(ONBOARDING, 'setup-home', frameY(5), 900), await shot(sp, 'setup-home-1440'));
      const wallets = await rest('wallets?deleted=eq.false&select=name,type,currency,initial_balance,display_order&order=display_order');
      check(
        'set-up wrote the three wallets in order, each in its own currency, with its starting balance',
        JSON.stringify(wallets.map((w) => [w.name, w.type, w.currency, Number(w.initial_balance)])) ===
          JSON.stringify([['Maybank Savings', 'bank', 'MYR', 2281.8], ['Cash', 'cash', 'MYR', 63.6], ['Wise USD', 'bank', 'USD', 120]]),
        wallets,
      );
      const [profile] = await rest('profiles?select=preferences');
      check('set-up saved MYR as the main currency and when it finished', profile?.preferences?.currency === 'MYR' && Boolean(profile?.preferences?.setup_finished_at), profile?.preferences);
      await sp.goto(`${base}/welcome`);
      check('an account that finished set-up never sees it again', sp.url() === `${base}/home`, sp.url());
      await sp.getByRole('region', { name: 'Get set up' }).waitFor({ timeout: 20_000 }).catch(() => {});
      await sp.getByRole('button', { name: 'Hide Get set up' }).click();
      check('× hides Get set up, with Undo', (await sp.getByRole('region', { name: 'Get set up' }).count()) === 0 && (await sp.getByRole('status').getByRole('button', { name: 'Undo' }).isVisible()));
      await sp.waitForTimeout(1500);
      const [hidden] = await rest('profiles?select=preferences');
      check('hiding it is kept in the profile', hidden?.preferences?.setup_checklist_hidden === true, hidden?.preferences);
      await sp.keyboard.press('Control+z');
      await sp.getByRole('region', { name: 'Get set up' }).waitFor({ timeout: 10_000 }).catch(() => {});
      check('Ctrl Z brings Get set up back, and says Undone', (await sp.getByRole('region', { name: 'Get set up' }).isVisible()) && (await sp.getByRole('status').getByText('Undone.').isVisible()));
      for (const size of widths) {
        await sp.setViewportSize({ width: size.width, height: size.height });
        await sp.waitForTimeout(300);
        check(`Home's first run at ${size.width}: no sideways scroll`, await wide(sp));
        await shot(sp, `setup-home-${size.width}`);
      }
      await pair('empty-home', await boardBand(EMPTY, 'empty-home', 570, 900), `${out}/setup-home-1440.png`);
      await s.close();
    });

    const r = await pinned({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const rp = await r.newPage();
    await rp.goto(`${base}/home/places`);
    await rp.getByText('No places yet').waitFor({ timeout: 20_000 }).catch(() => {});
    check('reduced motion: the page fades in rather than rising', (await rp.locator('.page-enter').evaluate((el) => getComputedStyle(el).animationName).catch(() => '')) !== 'rise-in');
    await r.close();
  } finally {
    console.log('reseeding the web e2e user with the full profile');
    webSeed('--reset', '--profile', 'full', '--today', SEED_DAY);
  }
}

export async function verifyStates({ browser, base, storage, check, shot, pair, boardBand, out, widths, background, seed, rest, password }) {
  const pinned = async (options) => {
    const ctx = await browser.newContext({ storageState: storage, timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
    return ctx;
  };

  // ---------- first load: still blocks, only after 300 ms, and never on navigation ----------
  await block(check, 'first load', async () => {
    const slow = await pinned({ viewport: { width: 1440, height: 900 } });
    await slow.route('**/rest/v1/transactions*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    const sl = await slow.newPage();
    await sl.goto(`${base}/home`);
    // Playwright's fixed clock formats new Date(0), the screens' clock before hydration, as the pinned day, so
    // the server's HTML never matches and React renders the page again on the client; sample the blocks it keeps.
    await sl.waitForFunction(() => document.documentElement.dataset.shellReady === 'true', null, { timeout: 10_000 }).catch(() => {});
    await sl.locator('.card-loading').first().waitFor({ timeout: 10_000 }).catch(() => {});
    const block = sl.locator('.card-loading .block').first();
    const early = await block.evaluate((el) => ({ opacity: getComputedStyle(el).opacity, iterations: getComputedStyle(el).animationIterationCount })).catch(() => null);
    await sl.waitForTimeout(700);
    const later = await block.evaluate((el) => getComputedStyle(el).opacity).catch(() => null);
    check('first load: each Home card keeps its title, and its blocks wait 300 ms, then stay still', early?.opacity === '0' && later === '1' && early?.iterations === '1', { early, later });
    await shot(sl, 'states-first-load-1440');
    await sl.locator('.home[data-loaded]').waitFor({ timeout: 30_000 });
    check('the blocks give way to the cards once the pull lands', (await sl.locator('.card-loading').count()) === 0);
    await sl.keyboard.press('g');
    await sl.keyboard.press('a');
    await sl.waitForURL(`${base}/activity`).catch(() => {});
    check('moving to Activity in the same session shows no blocks', (await sl.locator('.activity-loading').count()) === 0 && (await sl.locator('.activity[data-loaded]').count()) === 1);
    await slow.close();
    await pair('states-loading', await boardBand(STATES, 'states-loading', 640, 700), `${out}/states-first-load-1440.png`);
  });

  // ---------- one card couldn't load; the rest of Home stays ----------
  await block(check, "one card couldn't load; the rest of Home stays", async () => {
    const broken = await pinned({ viewport: { width: 1440, height: 900 } });
    let failing = true;
    await broken.route('**/rest/v1/wallets*', (route) => (failing ? route.fulfill({ status: 500, json: { message: 'down' } }) : route.continue()));
    const b = await broken.newPage();
    await b.goto(`${base}/home`);
    const alert = b.getByRole('alert').filter({ hasText: "Couldn't load your wallets" });
    await alert.waitFor({ timeout: 30_000 }).catch(() => {});
    check("a wallets pull that fails: the Wallets card says Couldn't load, Recent still shows its rows", (await alert.isVisible()) && (await b.locator('.recent-card .txn-row').count()) > 0);
    await shot(b, 'states-card-error-1440');
    failing = false;
    await alert.getByRole('button', { name: 'Try again' }).click();
    await b.locator('.wallets-card .wallet-row').first().waitFor({ timeout: 20_000 }).catch(() => {});
    check('Try again loads the wallets in place', (await b.locator('.wallets-card .wallet-row').count()) > 0);
    await broken.close();
  });

  // ---------- full pages ----------
  await block(check, 'full pages', async () => {
    for (const theme of ['light', 'dark']) {
      for (const size of [...widths, { width: 800, height: 450, layout: 'phone' }]) {
        const ctx = await pinned({ viewport: { width: size.width, height: size.height }, colorScheme: theme });
        const p = await ctx.newPage();
        const where = `${size.width}x${size.height} ${theme}`;
        const res = await p.goto(`${base}/no-such-page`);
        check(
          `404 at ${where}: thinking, the title, Back to Home and Search Moni, no sideways scroll`,
          res?.status() === 404 &&
            (await p.getByRole('heading', { name: "This page isn't here" }).isVisible()) &&
            (await p.getByRole('link', { name: 'Back to Home' }).getAttribute('href')) === '/home' &&
            (await wide(p)) &&
            (await ground(p)) === background[theme],
          { status: res?.status() },
        );
        await shot(p, `states-404-${size.width}x${size.height}-${theme}`);
        await p.goto(`${base}/maintenance`);
        check(`maintenance at ${where}: sleepy, its title and Back soon`, (await p.getByRole('heading', { name: 'Moni is having an update' }).isVisible()) && (await p.getByText(/Back soon\./).isVisible()) && (await wide(p)));
        await shot(p, `states-maintenance-${size.width}x${size.height}-${theme}`);
        await ctx.close();
      }
    }
    const nf = await pinned({ viewport: { width: 1440, height: 900 } });
    const np = await nf.newPage();
    await np.goto(`${base}/no-such-page`);
    await np.getByRole('link', { name: /Search Moni/ }).click();
    await np.getByRole('dialog', { name: 'Search or ask Moni' }).waitFor({ timeout: 15_000 }).catch(() => {});
    check("404's Search Moni opens Ctrl K on Home", np.url() === `${base}/home` && (await np.getByRole('dialog', { name: 'Search or ask Moni' }).isVisible()), np.url());
    await nf.close();
    const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ap = await anon.newPage();
    await ap.goto(`${base}/no-such-page`);
    check('signed out, a path outside the public site asks to sign in first, as any private path does', ap.url() === `${base}/login?next=%2Fno-such-page`, ap.url());
    await anon.close();
    await pair('states-404', await boardBand(STATES, 'states-full-pages', 4300, 360), `${out}/states-404-1440x900-light.png`);
  });

  // ---------- offline: the store keeps working from memory and syncs on reconnect ----------
  await block(check, 'offline', async () => {
    const off = await pinned({ viewport: { width: 1440, height: 900 } });
    const o = await off.newPage();
    await o.goto(`${base}/activity`);
    await o.locator('.activity[data-loaded]').waitFor({ timeout: 30_000 });
    await off.setOffline(true);
    const banner = o.getByRole('status').filter({ hasText: "You're offline." });
    await banner.waitFor({ timeout: 5000 }).catch(() => {});
    check('offline: the Sand banner says what still works and when the numbers last updated, and Ask Moni dims', (await banner.isVisible()) && (await banner.getByText(/Updated \d/).isVisible()) && (await o.locator('nav.sidebar .navi[data-offline]').count()) === 1);
    const row = o.locator('.activity-table [role="row"][data-row-id]').filter({ has: o.locator('.cell') }).first();
    const rowId = await row.getAttribute('data-row-id');
    const before = (await row.locator('.cell-text').first().textContent()) ?? '';
    const [server] = await rest(`transactions?id=eq.${rowId}&select=category_id`);
    await row.locator('.cell').dblclick();
    const options = o.getByRole('listbox', { name: 'Categories' }).getByRole('option');
    const target = ((await options.allTextContents()).map((text) => text.replace(/RM.*$/, '').trim()).find((name) => name && name !== before)) ?? '';
    await o.locator('#cell-edit-input').fill(target);
    await o.locator('#cell-edit-input').press('Enter');
    const saved = o.getByRole('status').filter({ hasText: "Saved in this tab. Syncs when you're back online." });
    await saved.waitFor({ timeout: 5000 }).catch(() => {});
    const shown = (await o.locator(`[data-row-id="${rowId}"] .cell-text`).first().textContent()) ?? '';
    const [stillServer] = await rest(`transactions?id=eq.${rowId}&select=category_id`);
    check(
      'offline, an edit shows at once from memory with "Saved in this tab", and the server has not seen it yet',
      (await saved.isVisible()) && shown === target && stillServer?.category_id === server?.category_id,
      { shown, target, server, stillServer },
    );
    await shot(o, 'states-offline-1440');
    await off.setOffline(false);
    const back = o.getByRole('status').filter({ hasText: /^Back online/ });
    await back.waitFor({ timeout: 20_000 }).catch(() => {});
    const backText = (await back.textContent().catch(() => '')) ?? '';
    let synced = null;
    for (let tries = 0; tries < 10; tries++) {
      [synced] = await rest(`transactions?id=eq.${rowId}&select=category_id`);
      if (synced?.category_id !== server?.category_id) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    check('back online: the banner goes, an info toast says what synced, and the server now has the edit', !(await banner.isVisible()) && /Back online/.test(backText) && synced?.category_id !== server?.category_id, { backText, synced });
    await shot(o, 'states-back-online-1440');
    await o.keyboard.press('Control+z');
    await o.getByRole('status').getByText('Undone.').waitFor({ timeout: 5000 }).catch(() => {});
    const undone = (await o.locator(`[data-row-id="${rowId}"] .cell-text`).first().textContent()) ?? '';
    check('Ctrl Z still undoes the edit after its toast has gone, and says Undone with no button', undone === before && (await o.getByRole('status').getByRole('button').count()) === 0, { before, undone });
    await shot(o, 'states-toast-undone-1440');
    await off.close();
    await pair('states-offline', await boardBand(STATES, 'states-offline', 4680, 620), `${out}/states-offline-1440.png`);
  });

  // ---------- Sign in again, over the page ----------
  await block(check, 'Sign in again', async () => {
    const two = await pinned({ viewport: { width: 1440, height: 900 } });
    await two.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));
    const a = await two.newPage();
    await a.goto(`${base}/activity`);
    await a.locator('.activity[data-loaded]').waitFor({ timeout: 30_000 });
    await a.keyboard.press('n');
    await a.locator('#add-draft').fill('12.50 lunch at Mamak');
    const other = await two.newPage();
    await other.goto(`${base}/home`);
    await other.locator('.home[data-loaded]').waitFor({ timeout: 30_000 }).catch(() => {});
    await other.getByRole('button', { name: /Settings$/ }).first().click();
    await other.getByRole('menuitem', { name: 'Sign out' }).click();
    await other.waitForURL(/\/login/).catch(() => {});
    const dialog = a.getByRole('dialog', { name: 'Sign in again' });
    await dialog.waitFor({ timeout: 15_000 }).catch(() => {});
    check('signed out from another tab: Sign in again opens over the page, which stays where it was', (await dialog.isVisible()) && a.url().startsWith(`${base}/activity`));
    await shot(a, 'states-session-1440');
    await a.keyboard.press('Escape');
    check('Esc does not close Sign in again', await dialog.isVisible());
    await dialog.getByLabel('Password').fill(password);
    await dialog.getByLabel('Password').press('Enter');
    await dialog.waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
    check(
      'signing in again closes it on the same page, the half-typed Add still there',
      !(await dialog.isVisible()) && a.url().startsWith(`${base}/activity`) && (await a.locator('#add-draft').inputValue()) === '12.50 lunch at Mamak',
    );
    await two.close();
    await pair('states-session', await boardBand(STATES, 'states-errors', 3700, 600), `${out}/states-session-1440.png`);
  });

  // ---------- a delete asks first ----------
  await block(check, 'delete confirm', async () => {
    const ctx = await pinned({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${base}/activity`);
    await p.locator('.activity[data-loaded]').waitFor({ timeout: 30_000 });
    await p.keyboard.press('j');
    const pane = p.getByRole('complementary', { name: 'Transaction' });
    await pane.waitFor({ timeout: 10_000 });
    await pane.getByRole('button', { name: /^Delete transaction/ }).click();
    const one = p.getByRole('alertdialog', { name: 'Delete this transaction?' });
    await one.waitFor({ timeout: 5000 }).catch(() => {});
    check(
      'Delete transaction asks first, says what it takes off the month, and focuses Cancel',
      (await one.isVisible()) &&
        /goes down by RM[\d,.]+\. You can undo it from the toast\./.test((await one.textContent()) ?? '') &&
        (await p.evaluate(() => document.activeElement?.textContent?.startsWith('Cancel'))),
    );
    await shot(p, 'states-confirm-delete-1440');
    await p.keyboard.press('Escape');
    check('Esc cancels it, the row stays open and nothing is written', !(await one.isVisible()) && (await pane.isVisible()));
    await p.keyboard.press('Escape');
    await p.getByRole('checkbox', { name: 'Select all on this page' }).click();
    await p.keyboard.press('Delete');
    const many = p.getByRole('alertdialog', { name: /^Delete \d+ transactions\?$/ });
    await many.waitFor({ timeout: 5000 }).catch(() => {});
    check("Del with rows ticked asks for all of them at once", (await many.isVisible()) && (await many.getByRole('button', { name: /^Delete \d+$/ }).isVisible()));
    await many.getByRole('button', { name: /^Cancel/ }).click();
    check('Cancel closes it and writes nothing', !(await many.isVisible()));
    await ctx.close();
  });

  // ---------- Get the app on an Android phone ----------
  await block(check, 'Get the app', async () => {
    const android = 'Mozilla/5.0 (Linux; Android 14; Redmi Note 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
    const ctx = await pinned({ viewport: { width: 390, height: 844 }, userAgent: android });
    const p = await ctx.newPage();
    await p.goto(`${base}/home`);
    const banner = p.getByRole('region', { name: 'Get the Moni app' });
    await banner.waitFor({ timeout: 20_000 }).catch(() => {});
    check('an Android phone sees Get the app under the greeting on Home', await banner.isVisible());
    await shot(p, 'states-get-app-390');
    await banner.getByRole('button', { name: 'Not now' }).click();
    await p.reload();
    await p.locator('.home[data-loaded]').waitFor({ timeout: 30_000 }).catch(() => {});
    check('Not now keeps it closed after a reload', (await banner.count()) === 0);
    await ctx.close();
    const desk = await pinned({ viewport: { width: 390, height: 844 } });
    const d = await desk.newPage();
    await d.goto(`${base}/home`);
    await d.locator('.home[data-loaded]').waitFor({ timeout: 30_000 }).catch(() => {});
    check('a browser that is not Android never sees it', (await d.getByRole('region', { name: 'Get the Moni app' }).count()) === 0);
    await desk.close();
  });
}

