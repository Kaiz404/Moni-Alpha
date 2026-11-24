// Review in web-verify (`--only review`): Home's Review drawer (#104) at every layout in both themes, the
// numbers and the order against the web e2e user's captures, J, K, Space, A, X and Ctrl Z, the list with
// bulk Approve, the source with the proposal (the bank alert, the chat line, the receipt photo from
// storage), the rule preview for "Don't ask about similar", All caught up, Recently reviewed with Move
// back, the 700 crossing with a half-typed name, and reduced motion. Every decision is undone before the
// part ends.

import { merchantKey } from '../../../mobile/scripts/e2e/fixtures.mjs';

const MINUS = '−';
const cents = (minor) => `RM${(Math.abs(minor) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const minorOf = (amount) => Math.round(Number(amount) * 100);

export async function verifyReview(t) {
  const { browser, storage, check, shot, pair, settle, widths, background, navFor, query, seed, base } = t;
  const pinned = async (options) => {
    const ctx = await browser.newContext({ storageState: storage, timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    return ctx;
  };
  async function until(name, test, ms = 20_000) {
    const end = Date.now() + ms;
    let rows = query(name);
    while (!test(rows) && Date.now() < end) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      rows = query(name);
    }
    return { ok: test(rows), rows };
  }
  const ready = (p) => p.locator('[data-screen="review"]').waitFor({ timeout: 30_000 });
  const drawer = (p) => p.getByRole('complementary', { name: 'Review' });
  const scrolls = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const visible = (locator) => locator.isVisible().catch(() => false);

  const rows = query('proposals');
  const pending = rows
    .filter((row) => row.status === 'pending')
    .sort((a, b) => Date.parse(a.transaction_date) - Date.parse(b.transaction_date));
  const waitingMinor = pending.filter((row) => row.currency === seed.currency).reduce((sum, row) => sum + minorOf(row.amount), 0);
  const first = pending[0];
  const receipt = pending.find((row) => row.source_type === 'image');
  const chat = pending.find((row) => row.source_type === 'text');
  check(`the web seed has ${pending.length} captures waiting, one from each source`, pending.length === 4 && Boolean(receipt?.source_image_uri) && Boolean(chat), {
    pending: pending.map((row) => [row.source_type, row.merchant]),
  });

  // ---------- every layout, light and dark ----------
  for (const theme of ['light', 'dark']) {
    for (const size of widths) {
      const ctx = await pinned({ viewport: { width: size.width, height: size.height }, colorScheme: theme });
      await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      const p = await ctx.newPage();
      await p.goto(`${base}/home`);
      await p.locator('.home[data-loaded]').waitFor({ timeout: 30_000 });
      const where = `Review at ${size.width} ${theme}`;
      check(`${where}: Home has no Review drawer until the card opens it`, (await p.locator('aside.slide-over').count()) === 0);
      if (size.layout !== 'phone') {
        const corner = await p.evaluate(() => {
          const list = document.querySelector('.review-list');
          const rows = list?.querySelectorAll('.review-row');
          if (!list || !rows?.length) return null;
          const box = list.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + 1, box.bottom - 1);
          return { rows: rows.length, inRow: Boolean(hit?.closest('.review-row')), metaDots: [...list.querySelectorAll('.row-meta')].some((meta) => meta.textContent.includes('\u00b7')) };
        });
        check(`${where}: Home's review rows stop at the list's rounded corner, and each says only when`, corner !== null && !corner.inRow && !corner.metaDots, corner);
      }
      await p.locator('.review-card').getByRole('link', { name: /^Review/ }).filter({ visible: true }).click();
      await p.waitForURL(/review=deck/);
      await ready(p);
      await settle(p);
      const layout = await p.evaluate(() => document.documentElement.dataset.layout);
      const title = await drawer(p).locator('.drawer-title').textContent();
      const ground = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const nav = await p.evaluate(() => ['nav.sidebar', 'nav.rail', 'nav.tabbar'].filter((s) => { const el = document.querySelector(s); return el && getComputedStyle(el).display !== 'none'; }));
      check(
        `${where}: ${size.layout}, the drawer titled Review, the ground, no sideways scroll`,
        layout === size.layout && title === 'Review' && ground === background[theme] && !(await scrolls(p)) && nav.join() === (size.layout === 'phone' ? '' : navFor[size.layout]),
        { layout, title, ground, nav },
      );
      const pane = p.locator('section.capture-card:visible');
      const box = await drawer(p).boundingBox();
      check(`${where}: the deck shows one capture, the oldest`, (await pane.count()) === 1 && (await pane.getAttribute('data-capture')) === first.id);
      check(`${where}: Not mine and Approve sit at the foot of the capture`, (await visible(pane.getByRole('button', { name: /^Not mine/ }))) && (await visible(pane.getByRole('button', { name: /^Approve/ }))));
      if (size.layout === 'phone') {
        check(`${where}: the drawer is the full-screen Review page`, box?.x === 0 && box?.width === size.width && !(await visible(p.locator('nav.tabbar'))), box);
      } else {
        const meta = await drawer(p).locator('.drawer-titles .meta').textContent();
        check(`${where}: the header says ${cents(waitingMinor)} not counted yet`, meta === `${cents(waitingMinor)} not counted yet`, meta);
        check(`${where}: the drawer slides over Home from the right, top to bottom, 960 wide or 240 short of the window`, box !== null && box.y <= 14 && Math.round(box.x + box.width) >= size.width - 14 && Math.round(box.width) === Math.min(960, size.width - 240), box);
        check(`${where}: the drawer lies over Home with a scrim`, await visible(p.locator('.slide-over-scrim[data-open]')));
        check(`${where}: its top left says ‹ Home`, await visible(drawer(p).getByRole('button', { name: 'Back to Home (Esc)' })));
        await drawer(p).getByRole('radio', { name: `All ${pending.length}` }).click();
        await p.waitForURL(/review=list/);
        const names = await p.locator('.inbox-row .inbox-name').allTextContents();
        check(`${where}: All ${pending.length} lists the waiting captures, oldest first`, names.join('|') === pending.map((row) => row.merchant).join('|'), names);
        await drawer(p).getByRole('button', { name: 'Oldest first' }).click();
        const flipped = await p.locator('.inbox-row .inbox-name').allTextContents();
        check(`${where}: Oldest first turns to Newest first and reverses the list`, (await visible(drawer(p).getByRole('button', { name: 'Newest first' }))) && flipped.join('|') === [...names].reverse().join('|'), flipped);
        await drawer(p).getByRole('button', { name: 'Newest first' }).click();
        const dotted = await drawer(p).evaluate((el) => el.textContent.includes('·'));
        check(`${where}: the drawer joins nothing with a middle dot`, !dotted);
      }
      await shot(p, `review-${size.width}-${theme}`);
      const behind = await p.evaluate(() => ({
        focus: document.activeElement?.closest('aside.slide-over') ? document.activeElement.tagName : (document.activeElement?.textContent ?? '').trim().slice(0, 20),
        home: Boolean(document.querySelector('.home')?.closest('[inert]')),
        nav: [...document.querySelectorAll('.shell > nav')].every((nav) => nav.inert),
      }));
      check(`${where}: the drawer covers Home, so Home and the nav are inert and focus is in the drawer`, behind.home && behind.nav, behind);
      if (size.layout === 'phone') check(`${where}: focus moves to the drawer's heading`, behind.focus === 'H2', behind);
      await p.keyboard.press('Escape');
      const gone = await p.locator('aside.slide-over').waitFor({ state: 'detached', timeout: 2000 }).then(() => true, () => false);
      check(`${where}: Esc slides the drawer out and Home stays`, gone && !p.url().includes('review='), p.url());
      const after = await p.evaluate(() => ({
        inert: document.querySelectorAll('[inert]').length,
        focus: document.activeElement?.closest('.review-card a') !== null,
      }));
      check(`${where}: after the drawer closes nothing is inert and focus is back on Review in the card`, after.inert === 0 && after.focus, after);
      await ctx.close();
    }
  }

  // ---------- 1440: the board pair, the source, keys, the rule preview, decisions undone ----------
  const ctx = await pinned({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${base}/home?review=deck`);
  await ready(p);
  await settle(p);
  const pane = p.locator('section.capture-card:visible');
  const quote = await p.locator('.source-quote').textContent();
  check('the bank alert sits beside the proposal, quoted', /^“.*GRAB\*FOOD.*”$/.test(quote ?? ''), quote);
  const amount = await p.getByTestId('capture-amount').textContent();
  check(`the proposal reads ${MINUS}${cents(minorOf(first.amount))}`, amount === `${MINUS}${cents(minorOf(first.amount))}`, amount);

  await p.getByText("Don't ask about similar").click();
  const alerts = query('alerts').filter(
    (row) => merchantKey(row.merchant) === merchantKey(first.merchant) && row.metadata?.alert && seed.dayOf(row.transaction_date).slice(0, 7) === seed.seedDay.slice(0, 7) && row.wallet_id === first.wallet_id,
  );
  const preview = (await p.locator('[aria-label="Rule preview"] .rule-meta').textContent()) ?? '';
  const want = `${alerts.length} ${alerts.length === 1 ? 'alert' : 'alerts'} this month, ${cents(alerts.reduce((sum, row) => sum + minorOf(row.amount), 0))} in total`;
  check(`"Don't ask about similar" previews the ${alerts.length} alerts the rule would have matched`, preview === want && (await p.locator('.rule-matches li').count()) === alerts.length, { preview, want });
  check('the preview says what happens next time, and Approve says it saves the rule', (await visible(p.getByText('Added automatically'))) && (await p.locator('.capture-note').textContent()) === 'Saves the rule too');
  await settle(p);
  await shot(p, 'review-1440-rule');
  await pair('review-1440', 'r2/W2-Home.png', `${t.out}/review-1440-rule.png`);

  await p.keyboard.press('a');
  const added = p.getByRole('status').filter({ hasText: 'similar ones will be Auto' });
  check('A approves the open capture and the toast names its category and the rule', await added.waitFor({ timeout: 5000 }).then(() => true, () => false), await p.getByRole('status').allTextContents().catch(() => []));
  const approved = await until('proposals', (r) => r.some((row) => row.id === first.id && row.status === 'approved' && row.transaction_id));
  const rule = await until('auto-add-rules', (r) => r.some((row) => row.merchant_key === merchantKey(first.merchant) && row.wallet_id === first.wallet_id));
  check('the dev project has the capture approved with its ledger row, and the rule', approved.ok && rule.ok, { rules: rule.rows });
  check('the deck moves on to the next capture', (await pane.getAttribute('data-capture')) === pending[1].id);
  await p.keyboard.press('Control+z');
  const back = await until('proposals', (r) => r.some((row) => row.id === first.id && row.status === 'pending' && !row.transaction_id));
  const ruleGone = await until('auto-add-rules', (r) => !r.some((row) => row.merchant_key === merchantKey(first.merchant)));
  check('Ctrl Z puts the capture back, removes the row and the rule it made', back.ok && ruleGone.ok, { rules: ruleGone.rows });
  await p.waitForFunction((id) => document.querySelector('section.capture-card')?.getAttribute('data-capture') === id, first.id, { timeout: 5000 }).catch(() => {});
  check('and opens it again', (await pane.getAttribute('data-capture')) === first.id);

  check(
    "K and J sit on the capture's chevrons, with no hints beside the list",
    (await drawer(p).getByRole('button', { name: 'Previous capture (K)' }).locator('.kbd').textContent()) === 'K' &&
      (await drawer(p).getByRole('button', { name: 'Next capture (J)' }).locator('.kbd').textContent()) === 'J' &&
      (await drawer(p).locator('.hint-keys').count()) === 0,
  );
  await p.keyboard.press('j');
  await p.waitForURL(new RegExp(`capture=${pending[1].id}`)).catch(() => {});
  check('J opens the next capture and puts it in the URL', p.url().includes(`capture=${pending[1].id}`) && (await pane.getAttribute('data-capture')) === pending[1].id, p.url());
  await p.keyboard.press('k');
  await p.waitForURL(new RegExp(`capture=${first.id}`)).catch(() => {});
  check('K goes back', (await pane.getAttribute('data-capture')) === first.id);

  await drawer(p).getByRole('radio', { name: `All ${pending.length}` }).click();
  await p.waitForURL(/review=list/);
  await p.evaluate(() => document.activeElement?.blur?.());
  await p.keyboard.press(' ');
  await p.keyboard.press('j');
  await p.keyboard.press(' ');
  const bar = p.getByRole('toolbar', { name: 'Selected captures' });
  check('Space ticks the open capture, twice for two, and the Ink bar counts them', (await visible(bar)) && (await bar.textContent())?.includes('2 selected'));
  await shot(p, 'review-1440-bulk');
  await bar.getByRole('button', { name: /^Approve/ }).click();
  // A toast lasts 4 s, less than the dev project can take to show both rows, so it is read first.
  await p.getByRole('status').filter({ hasText: '2 approved' }).waitFor({ timeout: 4000 }).catch(() => {});
  const bulkToast = await p.getByRole('status').allTextContents().catch(() => []);
  const both = await until('proposals', (r) => [first.id, pending[1].id].every((id) => r.some((row) => row.id === id && row.status === 'approved')));
  check('bulk Approve approves both', both.ok && bulkToast.some((text) => text.includes('2 approved')), {
    statuses: both.rows.filter((row) => [first.id, pending[1].id].includes(row.id)).map((row) => row.status),
    toast: bulkToast,
  });
  await p.keyboard.press('Control+z');
  const bothBack = await until('proposals', (r) => [first.id, pending[1].id].every((id) => r.some((row) => row.id === id && row.status === 'pending')));
  check('Ctrl Z puts both back', bothBack.ok);

  // The receipt photo comes from storage; the chat capture quotes the line and needs a wallet.
  await p.locator(`.inbox-row[data-capture="${receipt.id}"]`).click();
  await p.waitForURL(/review=deck/);
  const img = p.locator('.source-photo img');
  await img.waitFor({ timeout: 10_000 }).catch(() => {});
  const photo = await img.evaluate((el) => ({ src: el.currentSrc, width: el.naturalWidth })).catch(() => null);
  check(
    'a receipt capture shows its photo from storage through a signed link',
    Boolean(photo?.src.includes(`/storage/v1/object/sign/receipts/${receipt.source_image_uri}?token=`)) && photo.width > 0,
    photo,
  );
  await shot(p, 'review-1440-receipt');
  await p.goto(`${base}/home?review=list`);
  await ready(p);
  await p.locator(`.inbox-row[data-capture="${chat.id}"]`).click();
  const said = await p.locator('.source-chat blockquote').waitFor({ timeout: 5000 }).then(() => p.locator('.source-chat blockquote').textContent(), () => null);
  check('a chat capture quotes what was said', Boolean(said?.trim()), said);
  const approveChat = p.getByRole('button', { name: 'Pick a wallet', exact: false }).last();
  check('a capture with no wallet waits for one: Approve reads Pick a wallet and is off', await approveChat.isDisabled());
  await shot(p, 'review-1440-chat');

  // Esc shuts an open picker, not the drawer; a picked wallet outlives the drawer closing.
  const walletField = drawer(p).getByRole('combobox', { name: /^Wallet: / });
  await walletField.click();
  const walletList = drawer(p).getByRole('listbox', { name: 'Wallet' });
  await walletList.waitFor({ timeout: 3000 });
  await p.keyboard.press('Escape');
  check('Esc in the wallet picker shuts the picker and leaves the drawer open', !(await visible(walletList)) && (await visible(drawer(p))) && p.url().includes(`capture=${chat.id}`), p.url());
  await walletField.click();
  await walletList.getByRole('option').first().click();
  await p.keyboard.press('Escape');
  await p.locator('aside.slide-over').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
  await p.locator('.review-card').getByRole('link', { name: /^Review/ }).filter({ visible: true }).click();
  await ready(p);
  await drawer(p).getByRole('radio', { name: `All ${pending.length}` }).click();
  await p.locator(`.inbox-row[data-capture="${chat.id}"]`).click();
  await p.waitForURL(new RegExp(`capture=${chat.id}`));
  check('the wallet picked before the drawer closed is still picked when it opens again', await pane.getByRole('button', { name: /^Approve/ }).isEnabled());

  // Not mine for everything: All caught up, then Recently reviewed with Move back, then undo.
  await drawer(p).getByRole('radio', { name: `All ${pending.length}` }).click();
  await p.waitForURL(/review=list/);
  await p.getByRole('checkbox', { name: 'Select all' }).click();
  await p.keyboard.press('x');
  await p.getByRole('heading', { name: 'All caught up' }).waitFor({ timeout: 5000 }).catch(() => {});
  const allGone = await until('proposals', (r) => pending.every((one) => r.some((row) => row.id === one.id && row.status === 'rejected')));
  check('Select all then X marks every capture Not mine, and All caught up shows', allGone.ok && (await visible(p.getByRole('heading', { name: 'All caught up' }))));
  check('the header says nothing is waiting, once', (await drawer(p).locator('.drawer-titles .meta').textContent()) === 'Nothing waiting' && (await drawer(p).getByText(/Nothing waiting/).count()) === 1);
  await settle(p);
  await shot(p, 'review-1440-done');
  await p.keyboard.press('Control+z');
  const allBack = await until('proposals', (r) => pending.every((one) => r.some((row) => row.id === one.id && row.status === 'pending')));
  check('Ctrl Z brings all four back', allBack.ok);

  await p.goto(`${base}/home?review=deck&capture=${first.id}`);
  await ready(p);
  await p.keyboard.press('x');
  await until('proposals', (r) => r.some((row) => row.id === first.id && row.status === 'rejected'));
  await p.getByRole('button', { name: /Recently reviewed/ }).click();
  await p.waitForURL(/review=recent/);
  const recent = drawer(p);
  check('Recently reviewed lists the Not mine with Move back to Review', (await visible(recent.locator('.recent-row[data-status="rejected"]').first())) && (await visible(recent.getByRole('button', { name: 'Move back to Review' }).first())));
  const rules = recent.locator('.recent-row[data-rule]');
  const ruleLines = await rules.locator('.inbox-text > span').allInnerTexts();
  check(
    "each Don't ask about similar rule says what it does and has Ask again",
    ruleLines.every((line) => / without asking$/.test(line)) && (await rules.getByRole('button', { name: 'Ask again' }).count()) === ruleLines.length,
    ruleLines,
  );
  await shot(p, 'review-1440-recent');
  const [seeded] = query('auto-add-rules');
  if (seeded) {
    const row = recent.locator(`.recent-row[data-rule="${seeded.merchant_key}"]`);
    await row.getByRole('button', { name: 'Ask again' }).click();
    const asked = p.getByRole('status').filter({ hasText: 'Moni will ask about' });
    await asked.waitFor({ timeout: 5000 }).catch(() => {});
    await asked.hover().catch(() => {});
    const gone = await until('auto-add-rules', (r) => !r.some((each) => each.id === seeded.id));
    check('Ask again removes the rule, with a toast that offers Undo', gone.ok && !(await visible(row)) && (await visible(asked.getByRole('button', { name: 'Undo' }))));
    await asked.getByRole('button', { name: 'Undo' }).click();
    const back = await until('auto-add-rules', (r) => r.some((each) => each.id === seeded.id));
    check("Undo puts the Don't ask about similar rule back, on screen and in the dev project", back.ok && (await visible(row)));
  }
  await recent.getByRole('button', { name: 'Move back to Review' }).first().click();
  const moved = await until('proposals', (r) => r.some((row) => row.id === first.id && row.status === 'pending' && !row.reviewed_at));
  check('Move back to Review puts the capture back', moved.ok);
  await p.keyboard.press('Escape');
  await p.waitForURL(/review=deck/).catch(() => {});
  check('Esc in Recently reviewed steps back to the captures', p.url().includes('review=deck'), p.url());
  await p.keyboard.press('Escape');

  // Opened from Home, the drawer is a step in the history: Back closes it, and after Close, Back leaves Home.
  await p.goto(`${base}/activity`);
  await p.goto(`${base}/home`);
  await p.locator('.home[data-loaded]').waitFor({ timeout: 30_000 });
  const cardLink = p.locator('.review-card').getByRole('link', { name: /^Review/ }).filter({ visible: true });
  await cardLink.click();
  await ready(p);
  await p.goBack();
  const backShut = await p.locator('aside.slide-over').waitFor({ state: 'detached', timeout: 3000 }).then(() => true, () => false);
  check('browser Back closes the drawer opened from Home', backShut && p.url() === `${base}/home`, p.url());
  await cardLink.click();
  await ready(p);
  await drawer(p).getByRole('button', { name: 'Back to Home (Esc)' }).click();
  await p.locator('aside.slide-over').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
  const closedAt = p.url();
  await p.goBack();
  await p.waitForTimeout(500);
  check('after Close, Back leaves Home instead of landing on Home again', closedAt === `${base}/home` && p.url() === `${base}/activity`, { closedAt, back: p.url() });

  // Closing with the focus inside: the focus leaves first, and keys pressed while it slides out do nothing.
  await p.goto(`${base}/home?review=deck&capture=${first.id}`);
  await ready(p);
  await drawer(p).getByRole('button', { name: 'Next capture (J)' }).focus();
  await p.keyboard.press('Escape');
  const sliding = await p
    .waitForFunction(
      () => {
        const aside = document.querySelector('aside.slide-over[data-closing]');
        return aside && !aside.contains(document.activeElement) && { inert: aside.inert, hidden: aside.getAttribute('aria-hidden'), inside: false };
      },
      null,
      { polling: 'raf', timeout: 2000 },
    )
    .then(
      (handle) => handle.jsonValue(),
      () => p.evaluate(() => {
        const aside = document.querySelector('aside.slide-over');
        return { inert: aside?.inert ?? null, hidden: aside?.getAttribute('aria-hidden') ?? null, inside: Boolean(aside?.contains(document.activeElement)) };
      }),
    );
  await p.keyboard.press('x');
  await p.locator('aside.slide-over').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
  const untouched = query('proposals').some((row) => row.id === first.id && row.status === 'pending');
  check('closing moves the focus out, the sliding pane is inert, and X while it slides marks nothing', sliding.inert === true && sliding.hidden === null && !sliding.inside && untouched, sliding);

  // Old /review links open Home with the drawer, signed out through the sign-in page too.
  for (const [from, to] of [
    ['/review', '/home?review=deck'],
    [`/review?capture=${first.id}`, `/home?review=deck&capture=${first.id}`],
    ['/review?view=recent', '/home?review=recent'],
  ]) {
    await p.goto(`${base}${from}`);
    await ready(p);
    check(`${from} opens ${to}`, p.url() === `${base}${to}`, p.url());
  }
  const outCtx = await browser.newContext();
  const out = await outCtx.newPage();
  await out.goto(`${base}/review?view=recent`);
  check('signed out, /review asks to sign in and comes back to it', out.url() === `${base}/login?next=${encodeURIComponent('/review?view=recent')}`, out.url());
  await outCtx.close();
  await ctx.close();

  // ---------- the 700 crossing keeps the open capture and a half-typed name ----------
  const rctx = await pinned({ viewport: { width: 1024, height: 768 } });
  const r = await rctx.newPage();
  await r.goto(`${base}/home?review=deck&capture=${pending[1].id}`);
  await ready(r);
  await r.getByRole('button', { name: 'Edit merchant name' }).click();
  const field = r.getByLabel('Merchant name');
  await field.fill('Jaya Grocer Bangs');
  await field.evaluate((el) => {
    el.dataset.marker = 'kept';
  });
  await r.setViewportSize({ width: 390, height: 844 });
  await r.waitForFunction(() => document.documentElement.dataset.layout === 'phone');
  check('crossing 700 keeps the open capture in the URL', r.url().includes(`capture=${pending[1].id}`), r.url());
  check('and the half-typed name, in the same field', (await field.inputValue()) === 'Jaya Grocer Bangs' && (await field.getAttribute('data-marker')) === 'kept');
  await shot(r, 'review-390-after-resize');
  await r.setViewportSize({ width: 1024, height: 768 });
  await r.waitForFunction(() => document.documentElement.dataset.layout === 'rail');
  check('and back across 700 it is still there', (await field.inputValue()) === 'Jaya Grocer Bangs');
  await rctx.close();

  // ---------- reduced motion: the drawer slides in, or fades ----------
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const mctx = await pinned({ viewport: { width: 820, height: 1180 }, reducedMotion });
    const m = await mctx.newPage();
    await m.goto(`${base}/home?review=deck&capture=${first.id}`);
    await ready(m);
    const name = await m.locator('aside.slide-over').evaluate((el) => getComputedStyle(el).animationName);
    const expected = reducedMotion === 'reduce' ? 'fade-in' : 'slide-in-right';
    check(`the drawer opens over Home with ${expected} when motion is ${reducedMotion}`, name === expected, name);
    await mctx.close();
  }
}
