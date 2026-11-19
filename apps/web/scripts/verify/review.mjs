// Review in web-verify (`--only review`): every layout in both themes, the numbers and the order against
// the web e2e user's captures, J, K, Space, A, X and Ctrl Z, bulk Approve, the source beside the
// proposal (the bank alert, the chat line, the receipt photo from storage), the rule preview for
// "Don't ask about similar", All caught up, Recently reviewed with Move back, the 700 crossing with a
// half-typed name, and reduced motion. Every decision is undone before the part ends.

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
      await p.goto(`${base}/review`);
      await ready(p);
      const where = `Review at ${size.width} ${theme}`;
      const layout = await p.evaluate(() => document.documentElement.dataset.layout);
      const title = await p.locator('h1:visible').first().textContent();
      const ground = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const nav = await p.evaluate(() => ['nav.sidebar', 'nav.rail', 'nav.tabbar'].filter((s) => { const el = document.querySelector(s); return el && getComputedStyle(el).display !== 'none'; }));
      check(
        `${where}: ${size.layout}, its nav, the title, the ground, no sideways scroll`,
        layout === size.layout && title === 'Review' && ground === background[theme] && !(await scrolls(p)) && nav.join() === (size.layout === 'phone' ? '' : navFor[size.layout]),
        { layout, title, ground, nav },
      );
      const pane = p.locator('aside.review-pane[aria-label="Capture"]');
      if (size.layout === 'phone') {
        check(`${where}: the deck shows one capture, the oldest, and no inbox`, (await visible(pane)) && !(await visible(p.locator('.review-inbox'))) && (await pane.getAttribute('data-capture')) === first.id);
        check(`${where}: Not mine and Approve sit at the foot of the card`, (await visible(p.getByRole('button', { name: /^Not mine/ }))) && (await visible(p.getByRole('button', { name: /^Approve/ }))));
      } else {
        const names = await p.locator('.inbox-row .inbox-name').allTextContents();
        check(`${where}: the inbox lists the ${pending.length} waiting captures, oldest first`, names.join('|') === pending.map((row) => row.merchant).join('|'), names);
        const meta = await p.locator('.page-meta').first().textContent();
        check(`${where}: the header says ${cents(waitingMinor)} not counted yet`, meta === `${cents(waitingMinor)} not counted yet`, meta);
        if (size.layout === 'rail-one-column') {
          check(`${where}: the capture waits until one is opened`, !(await visible(pane)));
          await p.locator(`.inbox-row[data-capture="${first.id}"]`).click();
          await p.waitForURL(/capture=/);
          await pane.waitFor();
          await settle(p);
          check(`${where}: opening a capture slides it over the list`, await visible(pane));
        } else {
          check(`${where}: the oldest capture is open beside the inbox`, (await pane.getAttribute('data-capture')) === first.id);
          const box = await pane.boundingBox();
          check(`${where}: the capture docks right of the inbox, top to bottom`, box !== null && box.y <= 14 && box.x > 440 && box.x + box.width >= size.width - 14, box);
        }
      }
      await shot(p, `review-${size.width}-${theme}`);
      await ctx.close();
    }
  }

  // ---------- 1440: the board pair, the source, keys, the rule preview, decisions undone ----------
  const ctx = await pinned({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${base}/review`);
  await ready(p);
  await settle(p);
  const pane = p.locator('aside.review-pane[aria-label="Capture"]');
  const quote = await p.locator('.source-alert blockquote').textContent();
  check('the bank alert sits beside the proposal, quoted', /^“.*GRAB\*FOOD.*”$/.test(quote ?? ''), quote);
  const amount = await p.getByTestId('capture-amount').textContent();
  check(`the proposal reads ${MINUS}${cents(minorOf(first.amount))}`, amount === `${MINUS}${cents(minorOf(first.amount))}`, amount);

  await p.getByText("Don't ask about similar").click();
  const alerts = query('alerts').filter(
    (row) => merchantKey(row.merchant) === merchantKey(first.merchant) && row.metadata?.alert && seed.dayOf(row.transaction_date).slice(0, 7) === seed.seedDay.slice(0, 7) && row.wallet_id === first.wallet_id,
  );
  const preview = (await p.locator('[aria-label="Rule preview"] .rule-meta').textContent()) ?? '';
  const want = `${alerts.length} ${alerts.length === 1 ? 'alert' : 'alerts'} this month · ${cents(alerts.reduce((sum, row) => sum + minorOf(row.amount), 0))}`;
  check(`"Don't ask about similar" previews the ${alerts.length} alerts the rule would have matched`, preview === want && (await p.locator('.rule-matches li').count()) === alerts.length, { preview, want });
  check('the preview says what happens next time, and Approve says it saves the rule', (await visible(p.getByText('Added automatically'))) && (await p.locator('.capture-note').textContent()) === 'Saves the rule too');
  await settle(p);
  await shot(p, 'review-1440-rule');
  await pair('review-1440', 'r2/W2-Review.png', `${t.out}/review-1440-rule.png`);

  await p.keyboard.press('a');
  const added = p.getByRole('status').filter({ hasText: 'similar ones will be Auto' });
  check('A approves the open capture and the toast names its category and the rule', await added.waitFor({ timeout: 5000 }).then(() => true, () => false), await p.getByRole('status').allTextContents().catch(() => []));
  const approved = await until('proposals', (r) => r.some((row) => row.id === first.id && row.status === 'approved' && row.transaction_id));
  const rule = await until('auto-add-rules', (r) => r.some((row) => row.merchant_key === merchantKey(first.merchant) && row.wallet_id === first.wallet_id));
  check('the dev project has the capture approved with its ledger row, and the rule', approved.ok && rule.ok, { rules: rule.rows });
  check('the inbox moves on to the next capture', (await pane.getAttribute('data-capture')) === pending[1].id);
  await p.keyboard.press('Control+z');
  const back = await until('proposals', (r) => r.some((row) => row.id === first.id && row.status === 'pending' && !row.transaction_id));
  const ruleGone = await until('auto-add-rules', (r) => !r.some((row) => row.merchant_key === merchantKey(first.merchant)));
  check('Ctrl Z puts the capture back, removes the row and the rule it made', back.ok && ruleGone.ok, { rules: ruleGone.rows });
  await p.waitForFunction((id) => document.querySelector('aside.review-pane')?.getAttribute('data-capture') === id, first.id, { timeout: 5000 }).catch(() => {});
  check('and opens it again', (await pane.getAttribute('data-capture')) === first.id);

  await p.keyboard.press('j');
  await p.waitForURL(new RegExp(`capture=${pending[1].id}`)).catch(() => {});
  check('J opens the next capture and puts it in the URL', p.url().includes(`capture=${pending[1].id}`) && (await pane.getAttribute('data-capture')) === pending[1].id, p.url());
  await p.keyboard.press('k');
  await p.waitForURL(new RegExp(`capture=${first.id}`)).catch(() => {});
  check('K goes back', (await pane.getAttribute('data-capture')) === first.id);

  await p.evaluate(() => document.activeElement?.blur?.());
  await p.keyboard.press(' ');
  await p.keyboard.press('j');
  await p.keyboard.press(' ');
  const bar = p.getByRole('toolbar', { name: 'Selected captures' });
  check('Space ticks the open capture, twice for two, and the Ink bar counts them', (await visible(bar)) && (await bar.textContent())?.includes('2 selected'));
  check('the Approve button counts the ticked captures', await visible(p.getByRole('button', { name: /^Approve 2/ })));
  await shot(p, 'review-1440-bulk');
  await bar.getByRole('button', { name: /^Approve/ }).click();
  const both = await until('proposals', (r) => [first.id, pending[1].id].every((id) => r.some((row) => row.id === id && row.status === 'approved')));
  check('bulk Approve approves both', both.ok && (await visible(p.getByRole('status').filter({ hasText: '2 approved' }))));
  await p.keyboard.press('Control+z');
  const bothBack = await until('proposals', (r) => [first.id, pending[1].id].every((id) => r.some((row) => row.id === id && row.status === 'pending')));
  check('Ctrl Z puts both back', bothBack.ok);

  // The receipt photo comes from storage; the chat capture quotes the line and needs a wallet.
  await p.locator(`.inbox-row[data-capture="${receipt.id}"]`).click();
  const img = p.locator('.source-photo img');
  await img.waitFor({ timeout: 10_000 }).catch(() => {});
  const photo = await img.evaluate((el) => ({ src: el.currentSrc, width: el.naturalWidth })).catch(() => null);
  check(
    'a receipt capture shows its photo from storage through a signed link',
    Boolean(photo?.src.includes(`/storage/v1/object/sign/receipts/${receipt.source_image_uri}?token=`)) && photo.width > 0,
    photo,
  );
  await shot(p, 'review-1440-receipt');
  await p.locator(`.inbox-row[data-capture="${chat.id}"]`).click();
  const said = await p.locator('.source-chat blockquote').waitFor({ timeout: 5000 }).then(() => p.locator('.source-chat blockquote').textContent(), () => null);
  check('a chat capture quotes what was said', Boolean(said?.trim()), said);
  const approveChat = p.getByRole('button', { name: 'Pick a wallet', exact: false }).last();
  check('a capture with no wallet waits for one: Approve reads Pick a wallet and is off', await approveChat.isDisabled());
  await shot(p, 'review-1440-chat');

  // Not mine for everything: All caught up, then Recently reviewed with Move back, then undo.
  await p.getByRole('checkbox', { name: 'Select all' }).click();
  await p.keyboard.press('x');
  await p.locator('aside[aria-label="All caught up"]').waitFor({ timeout: 5000 }).catch(() => {});
  const allGone = await until('proposals', (r) => pending.every((one) => r.some((row) => row.id === one.id && row.status === 'rejected')));
  check('Select all then X marks every capture Not mine, and All caught up shows', allGone.ok && (await visible(p.getByRole('heading', { name: 'All caught up' }))));
  check('the inbox says nothing is waiting', await visible(p.getByText('Nothing waiting. New captures land here.')));
  await settle(p);
  await shot(p, 'review-1440-done');
  await p.keyboard.press('Control+z');
  const allBack = await until('proposals', (r) => pending.every((one) => r.some((row) => row.id === one.id && row.status === 'pending')));
  check('Ctrl Z brings all four back', allBack.ok);

  await p.keyboard.press('x');
  await until('proposals', (r) => r.some((row) => row.id === first.id && row.status === 'rejected'));
  await p.getByRole('button', { name: /Recently reviewed/ }).click();
  const recent = p.locator('aside[aria-label="Recently reviewed"]');
  await recent.waitFor({ timeout: 5000 }).catch(() => {});
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
  await ctx.close();

  // ---------- the 700 crossing keeps the open capture and a half-typed name ----------
  const rctx = await pinned({ viewport: { width: 1024, height: 768 } });
  const r = await rctx.newPage();
  await r.goto(`${base}/review?capture=${pending[1].id}`);
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

  // ---------- reduced motion: the capture slides over the one-column rail, or fades ----------
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const mctx = await pinned({ viewport: { width: 820, height: 1180 }, reducedMotion });
    const m = await mctx.newPage();
    await m.goto(`${base}/review?capture=${first.id}`);
    await ready(m);
    const name = await m.locator('aside.review-pane').evaluate((el) => getComputedStyle(el).animationName);
    const expected = reducedMotion === 'reduce' ? 'fade-in' : 'slide-in-right';
    check(`the capture opens over the list with ${expected} when motion is ${reducedMotion}`, name === expected, name);
    await mctx.close();
  }
}
