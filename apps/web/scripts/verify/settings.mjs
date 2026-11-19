// Settings in web-verify (`--only settings`): every section at the four widths in both themes, the
// keys, the 700 crossing with a half-typed merchant name, and the numbers against the e2e user's rows
// read over REST. Every write is put back: the import is undone, the rename is undone, the tone and
// the AI consent end as they began.
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SECTIONS = [
  { path: '/settings', name: 'index', phoneTitle: 'Settings' },
  { path: '/settings/profile', name: 'profile', phoneTitle: 'Profile' },
  { path: '/settings/ai', name: 'ai', phoneTitle: "Moni's AI" },
  { path: '/settings/merchants', name: 'merchants', phoneTitle: 'Merchant names' },
  { path: '/settings/import', name: 'import', phoneTitle: 'Import and export' },
];

/** The merchant key the app groups codes by, written again here so the oracle shares no code with the app. */
function merchantKey(merchant) {
  const text = (merchant ?? '').toLowerCase();
  const star = text.indexOf('*');
  const afterStar = star < 0 ? '' : (text.slice(star + 1).trim().split(/\s+/)[0] ?? '');
  const name = star > 0 && /\d/.test(afterStar) ? text.slice(0, star) : text.replace(/\*/g, ' ');
  const key = name
    .split(/\s+/)
    .filter((token) => !/\d/.test(token))
    .join(' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return key || null;
}

/** The rows of one titled section of a Moni export, read with quotes honoured. */
function exportSection(text, title) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted && ch === '"' && text[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (quoted) {
      cell += ch;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r' && ch !== '﻿') {
      cell += ch;
    }
  }
  const start = rows.findIndex((each) => each.length === 1 && each[0] === title);
  if (start < 0) return null;
  const body = [];
  for (const each of rows.slice(start + 2)) {
    if (each.length === 1 && each[0] === '') break;
    body.push(each);
  }
  return body;
}

const csvCell = (text) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

export async function verifySettings(t) {
  const { browser, base, storage, check, shot, pair, settle, widths, background, out, rest, seed } = t;
  const pinned = async (options) => {
    const ctx = await browser.newContext({ storageState: storage, timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
    return ctx;
  };
  const ready = (p) => p.locator('.settings').waitFor({ timeout: 20_000 }).catch(() => {});
  const loaded = (p) => p.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30_000 }).catch(() => {});
  /** Polls REST until `test` holds, since sync sends writes a moment later. */
  async function until(path, test, ms = 20_000) {
    const end = Date.now() + ms;
    let rows = await rest(path);
    while (!test(rows) && Date.now() < end) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      rows = await rest(path);
    }
    return { ok: test(rows), rows };
  }

  // ---------- every section, every layout, light and dark ----------
  for (const theme of ['light', 'dark']) {
    for (const size of widths) {
      const ctx = await pinned({ viewport: { width: size.width, height: size.height }, colorScheme: theme });
      const p = await ctx.newPage();
      for (const section of SECTIONS) {
        await p.goto(`${base}${section.path}`);
        await ready(p);
        await loaded(p);
        const where = `${section.path} at ${size.width} ${theme}`;
        const state = await p.evaluate(() => {
          const shown = (selector) => {
            const el = document.querySelector(selector);
            return Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
          };
          return {
            layout: document.documentElement.dataset.layout,
            bg: getComputedStyle(document.body).backgroundColor,
            wide: document.documentElement.scrollWidth <= innerWidth,
            nav: shown('.settings-nav'),
            panel: shown('.settings-panel .set-card'),
            tabbar: shown('nav.tabbar'),
            title: [...document.querySelectorAll('h1')].find((h) => h.getClientRects().length)?.textContent ?? null,
          };
        });
        const phone = size.layout === 'phone';
        const index = section.name === 'index';
        const ok =
          state.layout === size.layout &&
          state.bg === background[theme] &&
          state.wide &&
          !state.tabbar &&
          (phone ? state.nav === index && state.panel === !index && state.title === section.phoneTitle : state.nav && state.panel && state.title === 'Settings');
        check(
          `${where}: ${phone ? (index ? 'the Profile rows alone' : `${section.phoneTitle} pushed with Back, no nav`) : 'the section nav beside the section'}, ${theme} ground, no sideways scroll`,
          ok,
          state,
        );
        await shot(p, `settings-${section.name}-${size.width}-${theme}`);
      }
      await ctx.close();
    }
  }

  const ctx = await pinned({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();

  // ---------- Tab order through the nav, then into the section ----------
  await p.goto(`${base}/settings/profile`);
  await ready(p);
  await p.locator('.settings-link').first().focus();
  const order = [];
  for (let i = 0; i < 5; i++) {
    order.push(await p.evaluate(() => `${document.activeElement?.closest('.settings-panel') ? 'panel:' : ''}${document.activeElement?.textContent?.replace(/\d+/g, '').trim() ?? ''}`));
    await p.keyboard.press('Tab');
  }
  check('Tab walks the section nav in order, then into the section', order.slice(0, 4).join('|') === "Profile|Moni's AI|Merchant names|Import and export" && order[4].startsWith('panel:'), order);

  // ---------- Profile: Moni's tone changed, then put back ----------
  const [profileBefore] = await rest('profiles?select=id,preferences');
  const toneBefore = profileBefore.preferences.moni_tone ?? 'friendly';
  const toneTo = toneBefore === 'playful' ? 'direct' : 'playful';
  const toneLabel = { friendly: 'Friendly', direct: 'Straight to the point', playful: 'Playful' };
  await p.getByRole('radio', { name: toneLabel[toneTo] }).click();
  const toast = p.getByRole('status').filter({ hasText: `Moni's tone: ${toneLabel[toneTo]}` });
  await toast.waitFor({ timeout: 10_000 }).catch(() => {});
  await toast.hover().catch(() => {});
  const toned = await until('profiles?select=preferences', (rows) => rows[0]?.preferences?.moni_tone === toneTo);
  check(`picking ${toneLabel[toneTo]} writes preferences.moni_tone and says so with Undo`, toned.ok && (await toast.getByRole('button', { name: 'Undo' }).isVisible().catch(() => false)), toned.rows[0]?.preferences);
  await p.keyboard.press('Control+z');
  const untoned = await until('profiles?select=preferences', (rows) => (rows[0]?.preferences?.moni_tone ?? 'friendly') === toneBefore);
  check("Ctrl Z puts Moni's tone back", untoned.ok && (await p.getByRole('radio', { name: toneLabel[toneBefore] }).getAttribute('aria-checked')) === 'true', untoned.rows[0]?.preferences);
  if (JSON.stringify(untoned.rows[0]?.preferences) !== JSON.stringify(profileBefore.preferences)) {
    await rest(`profiles?id=eq.${profileBefore.id}`, { method: 'PATCH', body: { preferences: profileBefore.preferences } });
  }
  const [profileAfter] = await rest('profiles?select=preferences');
  check('the profile preferences end exactly as they began', JSON.stringify(profileAfter.preferences) === JSON.stringify(profileBefore.preferences), profileAfter.preferences);

  // ---------- Moni's AI: flipped and put back ----------
  const consentBefore = await rest('ai_consent_current?select=use,granted');
  const asked = consentBefore.some((row) => row.use === 'all');
  const aiCtx = await pinned({ viewport: { width: 1440, height: 900 } });
  // With no answer on record a real write could never be taken back, so this browser's consent rows
  // go to a stand-in that keeps them in memory, and the server's stay untouched.
  const sent = [];
  let refuse = false;
  const sentUntil = async (test) => {
    const end = Date.now() + 10_000;
    while (!test() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 200));
  };
  if (!asked) {
    await aiCtx.route('**/rest/v1/ai_consents**', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      if (refuse) return route.fulfill({ status: 500, json: { message: 'refused' } });
      const now = new Date().toISOString();
      for (const row of route.request().postDataJSON()) sent.push({ use: row.use, granted: row.granted, created_at: now });
      return route.fulfill({ status: 201, body: '' });
    });
    await aiCtx.route('**/rest/v1/ai_consent_current**', (route) => {
      const latest = new Map();
      for (const row of sent) latest.set(row.use, row);
      return route.fulfill({ json: [...latest.values()] });
    });
  }
  const a = await aiCtx.newPage();
  await a.goto(`${base}/settings/ai`);
  await ready(a);
  const master = a.getByRole('switch', { name: 'Let Moni use AI' });
  const receipts = a.getByRole('switch', { name: 'Receipt photos you scan' });
  await master.waitFor();
  await a.locator('section[aria-labelledby="ai-title"]:not([aria-busy])').waitFor({ timeout: 20_000 }).catch(() => {});
  const masterOn = (await master.getAttribute('aria-checked')) === 'true';
  check('Moni\'s AI: the four uses are disabled while the master is off', masterOn || (await a.getByRole('switch').evaluateAll((els) => els.slice(1).every((el) => el.disabled))));
  await shot(a, 'settings-ai-1440-before');
  if (!asked) {
    check('unasked, the master reads "Off. Nothing goes to AI."', (await a.getByTestId('ai-master-meta').textContent()) === 'Off. Nothing goes to AI.');
    await master.click();
    await a.waitForFunction(() => document.querySelector('[data-testid="ai-master-meta"]')?.textContent?.startsWith('Turned on by you on'), null, { timeout: 10_000 }).catch(() => {});
    await sentUntil(() => sent.length >= 5);
    check(
      'turning the master on records it with every use, as the phone does, and the uses come on',
      sent.map((row) => `${row.use}:${row.granted}`).sort().join() === 'add:true,alerts:true,all:true,chat:true,receipts:true' &&
        (await receipts.getAttribute('aria-checked')) === 'true' &&
        (await receipts.isEnabled()),
      { sent, meta: await a.getByTestId('ai-master-meta').textContent() },
    );
    await shot(a, 'settings-ai-1440-on');
    refuse = true;
    await receipts.click();
    const refused = a.getByRole('status').filter({ hasText: "Couldn't save the change" });
    await refused.waitFor({ timeout: 10_000 }).catch(() => {});
    check('a refused change says so and the switch moves back', (await refused.isVisible().catch(() => false)) && (await receipts.getAttribute('aria-checked')) === 'true');
    refuse = false;
    await master.click();
    await a.waitForFunction(() => document.querySelector('[data-testid="ai-master-meta"]')?.textContent?.startsWith('Turned off'), null, { timeout: 10_000 }).catch(() => {});
    await sentUntil(() => sent.length >= 6);
    check('turning the master off disables every use again', (await receipts.isDisabled()) && sent.length === 6 && sent[5].use === 'all' && sent[5].granted === false, sent);
  } else {
    const target = masterOn ? receipts : master;
    const name = masterOn ? 'receipts' : 'all';
    const was = (await target.getAttribute('aria-checked')) === 'true';
    await target.click();
    const flipped = await until('ai_consent_current?select=use,granted', (rows) => rows.find((row) => row.use === name)?.granted === !was);
    check(`flipping ${name} records it`, flipped.ok, flipped.rows);
    await target.click();
    const back = await until('ai_consent_current?select=use,granted', (rows) => rows.find((row) => row.use === name)?.granted === was);
    check(`and flipping it back records the choice as it was`, back.ok, back.rows);
  }
  const consentAfter = await rest('ai_consent_current?select=use,granted');
  check(
    "the server's AI consent ends exactly as it began",
    JSON.stringify(consentAfter.map((row) => `${row.use}:${row.granted}`).sort()) === JSON.stringify(consentBefore.map((row) => `${row.use}:${row.granted}`).sort()),
    { consentBefore, consentAfter },
  );
  await aiCtx.close();

  // ---------- Merchant names: counts against REST, rename undone, keys ----------
  const live = await rest('transactions?deleted=eq.false&select=merchant');
  const counts = new Map();
  for (const row of live) {
    const key = merchantKey(row.merchant);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  await p.goto(`${base}/settings/merchants`);
  await p.locator('.set-card[data-loaded]').waitFor({ timeout: 30_000 }).catch(() => {});
  const shown = await p.locator('.mn-row[data-key]').evaluateAll((els) => els.map((el) => [el.dataset.key, Number(el.querySelector('.mn-count')?.textContent)]));
  check(
    "every code's payments match the e2e user's live transactions with that merchant key",
    shown.length > 0 && shown.every(([key, count]) => count === (counts.get(key) ?? 0)),
    shown.map(([key, count]) => [key, count, counts.get(key) ?? 0]),
  );
  const aliasMap = (rows) => Object.fromEntries(rows.map((row) => [row.raw_key, row.display_name]).sort());
  const aliasesBefore = aliasMap(await rest('merchant_aliases?deleted=eq.false&select=raw_key,display_name'));
  const firstTwo = shown.slice(0, 2).map(([key]) => key);
  for (const key of firstTwo) await p.locator(`.mn-row[data-key="${key}"] .cbx`).click();
  const bulk = p.getByRole('toolbar', { name: 'Selected codes' });
  check('two ticks bring the Ink bulk bar', (await bulk.isVisible()) && (await bulk.textContent())?.includes('2 selected'));
  await bulk.getByRole('button', { name: 'Rename' }).click();
  const pop = p.getByRole('dialog', { name: 'Name 2 codes' });
  check('Rename opens "Name 2 codes" with Apply to the payments they reach', (await pop.isVisible()) && (await pop.textContent())?.includes(`Apply to ${shown[0][1] + shown[1][1]} payments`));
  await settle(p);
  await p.waitForTimeout(400);
  await shot(p, 'settings-merchants-1440-rename');
  await pair('settings-merchants-1440', 'r2/W2-Data-merchants/W2-Data.png', join(out, 'settings-merchants-1440-rename.png'));
  await p.keyboard.press('Escape');
  check('Esc closes the popover first and keeps the ticks', !(await pop.isVisible()) && (await bulk.isVisible()));
  await p.keyboard.press('Escape');
  check('a second Esc clears the ticks', !(await bulk.isVisible()));
  for (const key of firstTwo) await p.locator(`.mn-row[data-key="${key}"] .cbx`).click();
  await bulk.getByRole('button', { name: 'Rename' }).click();
  const newName = `Verify ${Date.now().toString(36)}`;
  await p.getByRole('dialog', { name: 'Name 2 codes' }).locator('input').fill(newName);
  await p.keyboard.press('Enter');
  const renamed = p.getByRole('status').filter({ hasText: `2 codes are now ${newName}` });
  await renamed.waitFor({ timeout: 10_000 }).catch(() => {});
  await renamed.hover().catch(() => {});
  const wrote = await until('merchant_aliases?deleted=eq.false&select=raw_key,display_name', (rows) => firstTwo.every((key) => aliasMap(rows)[key] === newName));
  check('Enter applies the name to both codes, in the dev project, with a toast offering Undo', wrote.ok, aliasMap(wrote.rows));
  await p.keyboard.press('Control+z');
  const restored = await until('merchant_aliases?deleted=eq.false&select=raw_key,display_name', (rows) => JSON.stringify(aliasMap(rows)) === JSON.stringify(aliasesBefore));
  check('Ctrl Z puts every name back as it was', restored.ok, { before: aliasesBefore, after: aliasMap(restored.rows) });
  const [cellKey] = shown.find(([key]) => aliasesBefore[key]) ?? shown[0];
  const cellInput = p.locator(`.mn-row[data-key="${cellKey}"] input`);
  await cellInput.fill(`${newName} cell`);
  await cellInput.press('Enter');
  const celled = p.getByRole('status').filter({ hasText: `is now ${newName} cell` });
  await celled.waitFor({ timeout: 10_000 }).catch(() => {});
  await celled.hover().catch(() => {});
  const cellWrote = await until('merchant_aliases?deleted=eq.false&select=raw_key,display_name', (rows) => aliasMap(rows)[cellKey] === `${newName} cell`);
  check('a name typed in its cell saves on Enter, once, with Undo', cellWrote.ok && (await p.getByRole('status').count()) === 1, aliasMap(cellWrote.rows));
  await celled.getByRole('button', { name: 'Undo' }).click().catch(() => {});
  const cellBack = await until('merchant_aliases?deleted=eq.false&select=raw_key,display_name', (rows) => JSON.stringify(aliasMap(rows)) === JSON.stringify(aliasesBefore));
  check('Undo puts that name back', cellBack.ok, aliasMap(cellBack.rows));

  // ---------- Import: a CSV of the user's own rows and two new ones, added then undone ----------
  const wallets = await rest('wallets?deleted=eq.false&select=id,name,currency');
  const txns = await rest('transactions?deleted=eq.false&select=wallet_id,type,amount,currency,merchant,description,transaction_date&order=transaction_date.desc');
  const usable = txns.filter((row) => (row.type === 'expense' || row.type === 'income') && row.currency === seed.currency && Number(row.amount) > 0);
  const walletId = Object.entries(Object.groupBy(usable, (row) => row.wallet_id)).sort((x, y) => y[1].length - x[1].length)[0][0];
  const wallet = wallets.find((each) => each.id === walletId);
  const known = usable.filter((row) => row.wallet_id === walletId).slice(0, 20);
  const dmy = (at) => {
    const [y, m, d] = seed.dayOf(at).split('-');
    return `${d}/${m}/${y}`;
  };
  const run = Date.now().toString(36).toUpperCase();
  const fresh = [
    { day: seed.pin.toISOString(), merchant: `VERIFY CAFE ${run}`, amount: '-12.34' },
    { day: seed.pin.toISOString(), merchant: `VERIFY BOOKS ${run}`, amount: '-56.78' },
  ];
  const lines = [
    'Date,Description,Amount',
    ...fresh.map((row) => [dmy(row.day), row.merchant, row.amount].map(csvCell).join(',')),
    ...known.map((row) => [dmy(row.transaction_date), row.merchant ?? row.description ?? '', `${row.type === 'expense' ? '-' : ''}${Number(row.amount).toFixed(2)}`].map(csvCell).join(',')),
  ];
  await p.goto(`${base}/settings/import`);
  await ready(p);
  await p.getByRole('button', { name: 'Choose a file' }).waitFor();
  await p.waitForFunction(() => !document.querySelector('.drop-zone .btn[disabled]'), null, { timeout: 30_000 }).catch(() => {});
  await shot(p, 'settings-import-1440-choose');
  await p.locator('input[type="file"]').setInputFiles({ name: `${wallet.name.toLowerCase().replace(/\W+/g, '-')}-statement.csv`, mimeType: 'text/csv', buffer: Buffer.from(lines.join('\n')) });
  await p.locator('[data-import-step="match"]').waitFor({ timeout: 10_000 }).catch(() => {});
  check('a CSV that is not a Moni export opens at Match columns', (await p.locator('[data-import-step="match"]').count()) === 1);
  check('Check the file waits for a wallet', await p.getByRole('button', { name: /^Check the file/ }).isDisabled());
  await p.getByRole('button', { name: /^Wallet to add to/ }).click();
  await p.getByRole('option', { name: wallet.name, exact: true }).click();
  const newCount = p.getByTestId('import-new');
  const hereCount = p.getByTestId('import-here');
  await newCount.waitFor({ timeout: 10_000 }).catch(() => {});
  const counted = { fresh: await newCount.textContent().catch(() => null), here: await hereCount.textContent().catch(() => null) };
  check(`the footer counts 2 new and ${known.length} already here, from the user's own rows`, counted.fresh === '2 new' && counted.here === `${known.length} already here`, counted);
  await p.getByLabel('Date column').focus();
  check('the focused picker lights its column', (await p.locator('.pth[data-lit]').getAttribute('data-column')) === '0');
  await p.getByLabel('Amount column').focus();
  check('and focusing another lights that one', (await p.locator('.pth[data-lit]').getAttribute('data-column')) === '2');
  await p.getByLabel('Date column').focus();
  const dates = p.getByRole('group', { name: 'How dates are written' });
  if (await dates.isVisible().catch(() => false)) {
    await dates.getByRole('button', { name: 'Month first' }).click();
    const swapped = await hereCount.textContent();
    check('Month first re-reads the dates and the counts follow', swapped !== `${known.length} already here`, swapped);
    await dates.getByRole('button', { name: 'Day first' }).click();
    check('Day first reads them back', (await hereCount.textContent()) === `${known.length} already here`);
  } else {
    check('Day first | Month first stays hidden when a date past the 12th settles it', known.some((row) => Number(seed.dayOf(row.transaction_date).slice(8)) > 12));
  }
  const preview = await p.locator('.ptr[data-line]').first().evaluate((el) => el.textContent);
  check('the preview shows the first row beside how Moni reads it', preview.includes(fresh[0].merchant) && preview.includes('New'), preview);
  await settle(p);
  await shot(p, 'settings-import-1440-match');
  await pair('settings-import-1440', 'r2/W2-Data.png', join(out, 'settings-import-1440-match.png'));
  await p.locator('#import-title').click();
  await p.keyboard.press('Enter');
  await p.locator('[data-import-step="check"]').waitFor({ timeout: 5000 }).catch(() => {});
  const lists = { fresh: await p.getByRole('region', { name: 'New' }).textContent().catch(() => ''), here: await p.getByRole('region', { name: 'Already here' }).textContent().catch(() => '') };
  check('Enter goes to Check the file, which lists the new and already-here rows', lists.fresh.includes(fresh[1].merchant) && lists.here.includes(`${known.length} already here`), lists);
  const nothingYet = await rest(`transactions?merchant=like.VERIFY*${run}&select=id`);
  check('nothing is written before Add', nothingYet.length === 0, nothingYet);
  await shot(p, 'settings-import-1440-check');
  await p.getByRole('button', { name: 'Add 2 transactions' }).click();
  const added = p.getByRole('status').filter({ hasText: 'Added 2 transactions' });
  await added.waitFor({ timeout: 30_000 }).catch(() => {});
  await added.hover().catch(() => {});
  const inserted = await until(`transactions?merchant=like.VERIFY*${run}&select=id,deleted`, (rows) => rows.length === 2 && rows.every((row) => !row.deleted));
  check('Add writes exactly the two new rows to the dev project', inserted.ok, inserted.rows);
  await added.getByRole('button', { name: 'Undo' }).click().catch(() => {});
  const undone = await until(`transactions?merchant=like.VERIFY*${run}&select=id,deleted`, (rows) => rows.length === 2 && rows.every((row) => row.deleted));
  check('Undo soft-deletes exactly the rows it added', undone.ok, undone.rows);
  const after = await rest('transactions?deleted=eq.false&select=id');
  check('the live transaction count is as it was', after.length === txns.length, { before: txns.length, after: after.length });

  // ---------- Export data: the file's transactions are the live ones ----------
  for (const [path, opens] of [['/settings/import', null], ['/settings/profile', 'Delete your account']]) {
    await p.goto(`${base}${path}`);
    await ready(p);
    if (opens) await p.getByRole('button', { name: opens }).click().catch(() => {});
    const button = p.getByRole('button', { name: 'Export data' });
    await button.waitFor({ timeout: 30_000 }).catch(() => {});
    const [download] = await Promise.all([p.waitForEvent('download', { timeout: 10_000 }).catch(() => null), button.click().catch(() => {})]);
    const file = download ? readFileSync(await download.path()).toString('utf8') : '';
    const rows = exportSection(file, 'Transactions');
    const liveNow = await rest('transactions?deleted=eq.false&select=id');
    check(
      `Export data on ${path} downloads ${download?.suggestedFilename() ?? 'nothing'} with every live transaction (${liveNow.length})`,
      Boolean(download) && /^moni-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename()) && file.startsWith('﻿Moni export,') && rows?.length === liveNow.length,
      { rows: rows?.length, live: liveNow.length },
    );
  }

  // ---------- reduced motion ----------
  const still = await pinned({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const r = await still.newPage();
  await r.goto(`${base}/settings/ai`);
  await ready(r);
  check('under reduce motion a section fades in instead of rising', (await r.locator('.set-card').evaluate((el) => getComputedStyle(el).animationName)) === 'fade-in');
  await still.close();

  // ---------- crossing 700 keeps a half-typed merchant name ----------
  const resize = await pinned({ viewport: { width: 1024, height: 768 } });
  const z = await resize.newPage();
  await z.goto(`${base}/settings/merchants`);
  await z.locator('.set-card[data-loaded]').waitFor({ timeout: 30_000 }).catch(() => {});
  const cell = z.locator('.mn-row[data-key] input').first();
  await cell.fill('Half typ');
  await cell.evaluate((el) => {
    el.dataset.marker = 'kept';
  });
  await z.setViewportSize({ width: 390, height: 844 });
  await z.waitForFunction(() => document.documentElement.dataset.layout === 'phone');
  check(
    'crossing 700 keeps the half-typed merchant name in the same field',
    (await cell.inputValue()) === 'Half typ' && (await cell.getAttribute('data-marker')) === 'kept' && z.url().endsWith('/settings/merchants'),
  );
  await shot(z, 'settings-merchants-390-half-typed');
  await z.setViewportSize({ width: 1024, height: 768 });
  await z.waitForFunction(() => document.documentElement.dataset.layout === 'rail');
  check('and back across 700 it is still there', (await cell.inputValue()) === 'Half typ');
  await cell.press('Escape');
  check('Esc drops the half-typed name without saving it', (await cell.inputValue()) !== 'Half typ');
  await resize.close();
  await ctx.close();
}
