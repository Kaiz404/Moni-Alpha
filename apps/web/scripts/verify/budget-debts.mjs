// Budget and Debts in web-verify (`--only ledger`): every layout in both themes, the keys, reduced
// motion, the 700 crossing with a half-typed budget and repayment, and the numbers against the e2e
// user's rows. Every write goes to the e2e user and is undone with Ctrl Z before the part ends.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/** "RM1,116.20", "−RM45.90" or "RM20 over" to a number of ringgit; NaN when there is none. */
function ringgit(text) {
  const match = /(−|-)?RM([\d,]+(?:\.\d+)?)/.exec(text ?? '');
  if (!match) return Number.NaN;
  const value = Number(match[2].replace(/,/g, ''));
  return match[1] ? -value : value;
}

const whole = (value) => `RM${Math.floor(Math.abs(value)).toLocaleString('en-US')}`;
const cents = (value) => `RM${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const near = (a, b) => Math.abs(a - b) < 0.005;

export async function verifyBudgetDebts(t) {
  const { browser, base, storage, check, shot, pair, settle, open, repo, widths, background, navFor } = t;
  const query = (name) =>
    JSON.parse(execFileSync('node', [join(repo, 'apps/mobile/scripts/e2e/seed.mjs'), '--query', name], { encoding: 'utf8' }));
  /** Polls the dev project until `test` holds for a query's rows, since sync sends writes a moment later. */
  async function until(name, test, ms = 20_000) {
    const end = Date.now() + ms;
    let rows = query(name);
    while (!test(rows) && Date.now() < end) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      rows = query(name);
    }
    return { ok: test(rows), rows };
  }
  const budgetMap = (rows) =>
    Object.fromEntries(rows.filter((row) => row.currency === 'MYR').map((row) => [row.categories?.name, Number(row.amount)]));
  const sameMap = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
  const ready = (p) => p.locator('[data-screen]').waitFor({ timeout: 20_000 });
  const scrolls = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);

  // ---------- every layout, light and dark ----------
  for (const theme of ['light', 'dark']) {
    for (const size of widths) {
      const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, storageState: storage, colorScheme: theme });
      await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      const p = await ctx.newPage();
      for (const screen of ['budget', 'debts']) {
        await p.goto(`${base}/${screen}`);
        await ready(p);
        const where = `/${screen} at ${size.width} ${theme}`;
        const state = await p.evaluate(() => ({
          layout: document.documentElement.dataset.layout,
          bg: getComputedStyle(document.body).backgroundColor,
          docked: (() => {
            const pane = document.querySelector('aside.detail');
            return pane ? getComputedStyle(pane).display !== 'none' : null;
          })(),
        }));
        const nav = await p.locator(navFor[size.layout]).isVisible();
        const tableShown =
          screen === 'debts'
            ? await p.locator('.people-card').first().isVisible()
            : await p.locator(size.layout === 'phone' ? 'section.rings' : '.budgets-card').isVisible();
        const docks = size.layout === 'sidebar';
        check(
          `${where}: ${size.layout} with its nav, ${theme} ground, ${docks ? 'the pane docked' : 'no pane until a row is picked'}, no sideways scroll`,
          state.layout === size.layout && nav && state.bg === background[theme] && state.docked === docks && !(await scrolls(p)) && tableShown,
          { ...state, nav, tableShown },
        );
        if (screen === 'budget') {
          const phoneParts = await p.locator('section.rings').isVisible();
          check(`${where}: the ${size.layout === 'phone' ? "phone's rings" : 'budget table'} show, not the other`, phoneParts === (size.layout === 'phone'));
        }
        await shot(p, `${screen}-${size.width}-${theme}`);
        const firstRow = screen === 'budget' ? (size.layout === 'phone' ? p.locator('.ring-tile').first() : p.locator('.budget-row[data-category] .row-name').first()) : p.locator('.people-row[data-debt]').first();
        if (await firstRow.count()) {
          await firstRow.click();
          await p.waitForURL(screen === 'budget' ? /category=/ : /person=/);
          await settle(p);
          const box = await p.locator('aside.detail').boundingBox();
          const tabbar = await p.locator('nav.tabbar').isVisible();
          const back = await p.locator('aside.detail .phone-back').isVisible();
          const fills =
            size.layout === 'phone'
              ? box?.x === 0 && box?.width === size.width && !tabbar && back
              : box !== null && box.width === 408 && !back;
          check(
            `${where}: a picked row opens its pane ${size.layout === 'phone' ? 'as the full-screen page with Back and no tab bar' : 'on the right, with its own up, down and close'}`,
            fills,
            { box, tabbar, back },
          );
          await shot(p, `${screen}-${size.width}-${theme}-pane`);
          await p.keyboard.press('Escape');
          await p.waitForURL((url) => !/category=|person=/.test(url.search)).catch(() => {});
          check(`${where}: Esc closes the pane`, !/category=|person=/.test(p.url()), p.url());
        }
      }
      await ctx.close();
    }
  }
  await pair('budget-1440', 'r2/W2-Budget.png', join(t.out, 'budget-1440-light-pane.png'));
  await pair('debts-1440', 'r2/W2-Debts.png', join(t.out, 'debts-1440-light-pane.png'));

  // ---------- Budget: numbers against the rows, the keys, edits undone ----------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: storage });
  const p = await ctx.newPage();
  const originalBudgets = budgetMap(query('budgets'));
  for (const monthStep of [0, -1]) {
    await open(p, '/budget');
    await ready(p);
    if (monthStep) {
      await p.locator('.page-head .month-nav .round-btn').first().click();
      await p.waitForURL(/month=/);
    }
    const month = new URL(p.url()).searchParams.get('month') ?? 'this month';
    const rows = await p.locator('.budget-row[data-category]').evaluateAll((els) =>
      els.map((el) => ({
        name: el.querySelector('.row-name b')?.textContent,
        budgeted: el.dataset.budgeted === 'true',
        spent: el.querySelector('[data-col="spent"]')?.textContent,
        budget: el.querySelector('[data-col="budget"]')?.textContent,
        left: el.querySelector('[data-col="left"]')?.textContent,
        last: el.querySelector('[data-col="last"]')?.textContent,
      })),
    );
    const budgeted = rows.filter((row) => row.budgeted);
    const shownBudgets = Object.fromEntries(budgeted.map((row) => [row.name, ringgit(row.budget)]));
    const expected = Object.fromEntries(Object.entries(originalBudgets).filter(([name]) => name in shownBudgets || !rows.some((row) => row.name === name)));
    check(
      `Budget ${month}: every budgeted row shows the e2e user's budget for that category`,
      budgeted.length > 0 && Object.entries(shownBudgets).every(([name, amount]) => near(amount, Math.floor(originalBudgets[name]))) && Object.keys(shownBudgets).length === Object.keys(expected).length,
      { shownBudgets, originalBudgets },
    );
    const leftOk = budgeted.every((row) => {
      const gap = Math.round(ringgit(row.budget) * 100) - Math.round(ringgit(row.spent) * 100);
      return row.left === (gap < 0 ? `${whole(Math.floor(-gap / 100))} over` : `${whole(Math.floor(gap / 100))} left`);
    });
    check(`Budget ${month}: each row's left is its budget less its spending, in whole ringgit`, leftOk, budgeted.map((row) => [row.name, row.spent, row.budget, row.left]));
    const total = await p.locator('[data-testid="budget-total"]').evaluate((el) => ({
      spent: el.querySelector('[data-col="spent"]')?.textContent,
      budget: el.querySelector('[data-col="budget"]')?.textContent,
      inCats: el.querySelector('.row-text span')?.textContent,
      last: el.querySelector('[data-col="last"]')?.textContent,
    }));
    const rowSpent = rows.reduce((sum, row) => sum + ringgit(row.spent), 0);
    const rowLast = rows.reduce((sum, row) => sum + ringgit(row.last), 0);
    const ring = await p.locator('.ring-total').textContent();
    const ringOf = await p.locator('.ring-of').textContent().catch(() => null);
    check(
      `Budget ${month}: the total adds up the rows (plus spending with no category), the ring shows the same total and budget`,
      ringgit(total.spent) + 0.005 >= rowSpent &&
        ringgit(total.last) + 0.005 >= rowLast &&
        near(ringgit(ring), ringgit(total.spent)) &&
        (ringOf === null || ringOf === `of ${total.budget}`) &&
        total.inCats === `${whole(Object.values(shownBudgets).reduce((a, b) => a + b, 0))} of it in categories`,
      { total, rowSpent, rowLast, ring, ringOf },
    );
  }

  await open(p, '/budget');
  await ready(p);
  const rowIds = await p.locator('.budget-row[data-category]').evaluateAll((els) => els.map((el) => el.dataset.category));
  const first = p.locator('.budget-row[data-budgeted="true"]').first();
  const firstId = await first.getAttribute('data-category');
  const firstName = await first.locator('.row-name b').textContent();
  await first.locator('.row-name').click();
  await p.waitForURL(new RegExp(`category=${firstId}`));
  check('picking a row opens its category pane with its name', (await p.locator('aside.detail h2').textContent()) === firstName);
  await p.keyboard.press('j');
  await p.waitForURL(new RegExp(`category=${rowIds[rowIds.indexOf(firstId) + 1] ?? firstId}`)).catch(() => {});
  check('J moves to the next category', p.url().includes(`category=${rowIds[rowIds.indexOf(firstId) + 1] ?? firstId}`), p.url());
  await p.keyboard.press('k');
  await p.waitForURL(new RegExp(`category=${firstId}`)).catch(() => {});
  check('K moves back', p.url().includes(`category=${firstId}`), p.url());

  await p.keyboard.press('e');
  const cell = p.locator('.budget-cell input');
  await cell.waitFor({ timeout: 5000 }).catch(() => {});
  const old = Math.floor(originalBudgets[firstName]);
  check('E edits the selected budget in its cell, starting from what is saved', (await cell.inputValue().catch(() => '')) === String(old));
  await shot(p, 'budget-1440-light-editing');
  await cell.fill(String(old + 7));
  await p.keyboard.press('Enter');
  const saved = p.getByRole('status').filter({ hasText: `${firstName} budget saved: RM${(old + 7).toLocaleString('en-US')}` });
  await saved.waitFor({ timeout: 5000 }).catch(() => {});
  check('Enter saves it with a toast that offers Undo', await saved.getByRole('button', { name: 'Undo' }).isVisible().catch(() => false));
  check('the cell shows the new budget', (await first.locator('[data-col="budget"]').textContent()) === whole(old + 7));
  await saved.hover().catch(() => {});
  const wrote = await until('budgets', (rows) => budgetMap(rows)[firstName] === old + 7);
  check(`the dev project holds ${firstName}'s new budget`, wrote.ok, budgetMap(wrote.rows));
  await p.keyboard.press('Control+z');
  const undone = await until('budgets', (rows) => budgetMap(rows)[firstName] === originalBudgets[firstName]);
  check('Ctrl Z puts the budget back, on screen and in the dev project', undone.ok && (await first.locator('[data-col="budget"]').textContent()) === whole(old), budgetMap(undone.rows));

  await p.keyboard.press('e');
  await cell.waitFor({ timeout: 5000 }).catch(() => {});
  await cell.fill('');
  await p.keyboard.press('Enter');
  await p.getByRole('status').hover().catch(() => {});
  const cleared = await until('budgets', (rows) => !(firstName in budgetMap(rows)));
  check('clearing a budget soft-deletes its row', cleared.ok, budgetMap(cleared.rows));
  await p.getByRole('status').getByRole('button', { name: 'Undo' }).click().catch(() => {});
  const revived = await until('budgets', (rows) => budgetMap(rows)[firstName] === originalBudgets[firstName]);
  check('Undo revives the same budget row', revived.ok, budgetMap(revived.rows));

  await p.keyboard.press('e');
  await cell.waitFor({ timeout: 5000 }).catch(() => {});
  await cell.fill('99');
  await p.keyboard.press('Escape');
  check('Esc in the cell cancels the edit and keeps the pane open', (await cell.count()) === 0 && p.url().includes(`category=${firstId}`) && (await first.locator('[data-col="budget"]').textContent()) === whole(old));
  await p.keyboard.press('Escape');
  await p.waitForURL((url) => !url.search.includes('category=')).catch(() => {});
  check('a second Esc closes the pane', !p.url().includes('category='), p.url());

  const copy = p.getByRole('button', { name: /^Copy [A-Z][a-z]+'s spending$/ });
  if (await copy.isVisible()) {
    await copy.click();
    const copied = p.getByRole('status').filter({ hasText: /Budgets set from|Nothing was spent/ });
    await copied.waitFor({ timeout: 5000 }).catch(() => {});
    const text = await copied.textContent().catch(() => '');
    check('Copy last month sets budgets from its spending, with Undo', /Budgets set from [A-Z][a-z]+'s spending|Nothing was spent/.test(text ?? ''), text);
    if (/Budgets set/.test(text ?? '')) {
      await shot(p, 'budget-1440-light-copied');
      await copied.hover().catch(() => {});
      await p.keyboard.press('Control+z');
      const back = await until('budgets', (rows) => sameMap(budgetMap(rows), originalBudgets));
      check('Ctrl Z puts every budget back as it was', back.ok, budgetMap(back.rows));
    }
  }

  await p.getByRole('radio', { name: 'Calendar' }).click();
  await p.waitForURL(/view=calendar/);
  const days = await p.locator('.calendar-day').count();
  check('Calendar shows every day of the month', days >= 28 && days <= 31, days);
  await shot(p, 'budget-1440-light-calendar');
  await ctx.close();

  // ---------- Debts: numbers against the rows, repay and record, undone ----------
  const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: storage });
  const d = await dctx.newPage();
  await open(d, '/debts');
  await ready(d);
  const debts = query('debts');
  const openNames = debts.filter((row) => row.status === 'open').map((row) => row.counterparty_name).sort();
  const shownNames = (await d.locator('.people-card').first().locator('.people-row[data-debt] .row-name .row-text b').allTextContents()).sort();
  check("the people table lists the e2e user's open debts", JSON.stringify(shownNames) === JSON.stringify(openNames), { shownNames, openNames });
  const closedCount = await d.locator('[aria-label="Settled debts"] .people-row[data-debt]').count();
  check('Settled and written off holds the closed ones', closedCount === debts.filter((row) => row.status !== 'open').length, closedCount);
  const people = await d.locator('.people-card').first().locator('.people-row[data-debt]').evaluateAll((els) =>
    els.map((el) => ({ id: el.dataset.debt, owesYou: el.querySelector('[data-col="owes-you"]')?.textContent ?? '', youOwe: el.querySelector('[data-col="you-owe"]')?.textContent ?? '' })),
  );
  const owed = people.reduce((sum, row) => sum + (row.owesYou ? ringgit(row.owesYou) : 0), 0);
  const owe = people.reduce((sum, row) => sum + (row.youOwe ? ringgit(row.youOwe) : 0), 0);
  const totals = await d.locator('[data-testid="people-total"]').evaluate((el) => [el.querySelector('[data-col="owes-you"]')?.textContent, el.querySelector('[data-col="you-owe"]')?.textContent]);
  const net = await d.locator('[data-testid="net-amount"]').textContent();
  const label = await d.locator('.net-label').textContent();
  check(
    'the totals add up the rows, the tiles and the net position follow them',
    totals[0] === cents(owed) &&
      totals[1] === cents(owe) &&
      (await d.locator('[data-testid="net-owed_to_me"]').textContent()) === whole(owed) &&
      (await d.locator('[data-testid="net-i_owe"]').textContent()) === whole(owe) &&
      net === whole(owed - owe) &&
      label === (owed > owe ? 'Overall, you are owed' : owed < owe ? 'Overall, you owe' : 'Everyone is square'),
    { totals, owed, owe, net, label },
  );
  await d.locator('.net-tile').first().click();
  await d.waitForURL(/side=owed_to_me/);
  const filtered = await d.locator('.people-card').first().locator('.people-row[data-debt] [data-col="you-owe"]').allTextContents();
  check('Owed to you filters the table to what others owe', filtered.every((text) => text === ''), filtered);
  await d.locator('.net-tile').first().click();

  const target = people.find((row) => row.owesYou) ?? people[0];
  if (target) {
    const before = ringgit(target.owesYou || target.youOwe);
    await d.locator(`.people-row[data-debt="${target.id}"]`).click();
    await d.waitForURL(new RegExp(`person=${target.id}`));
    check('picking a person shows what is still owed in the pane', near(ringgit(await d.locator('[data-testid="person-balance"]').textContent()), before));
    const activities = query('debt-activities').length;
    await d.keyboard.press('r');
    const amount = d.getByLabel('Amount paid back, in ringgit');
    await amount.waitFor({ timeout: 5000 }).catch(() => {});
    check('R opens Record a repayment with all of it filled in', near(Number(await amount.inputValue()), before));
    await amount.fill('1');
    await shot(d, 'debts-1440-light-repay');
    await d.keyboard.press('Enter');
    const recorded = d.getByRole('status').filter({ hasText: 'Recorded RM1.00' });
    await recorded.waitFor({ timeout: 5000 }).catch(() => {});
    check('Enter records it with a toast that offers Undo', await recorded.getByRole('button', { name: 'Undo' }).isVisible().catch(() => false));
    check('the pane shows RM1.00 less and the repayment in its history', near(ringgit(await d.locator('[data-testid="person-balance"]').textContent()), before - 1) && (await d.locator('[data-activity="repayment"]').count()) >= 1);
    await recorded.hover().catch(() => {});
    const added = await until('debt-activities', (rows) => rows.length === activities + 1 && rows.some((row) => row.debt_id === target.id && row.kind === 'repayment' && Number(row.amount) === 1));
    check('the dev project holds the repayment', added.ok, added.rows.length);
    await d.keyboard.press('Control+z');
    const gone = await until('debt-activities', (rows) => rows.length === activities);
    check('Ctrl Z removes the repayment, on screen and in the dev project', gone.ok && near(ringgit(await d.locator('[data-testid="person-balance"]').textContent()), before), gone.rows.length);
    await d.keyboard.press('Escape');
  }

  await d.keyboard.press('d');
  await d.waitForURL(/record=debt/);
  await d.getByRole('textbox', { name: 'Who' }).fill('E2E Verify');
  await d.getByLabel('Amount, in ringgit').fill('12.34');
  check('Record a debt names the person and the amount on its button', await d.getByRole('button', { name: /^Record: E2E Verify owes you RM12\.34/ }).isVisible());
  await shot(d, 'debts-1440-light-record');
  await d.keyboard.press('Enter');
  const made = d.getByRole('status').filter({ hasText: 'Recorded a debt with E2E Verify' });
  await made.waitFor({ timeout: 5000 }).catch(() => {});
  const opened = await d.locator('aside.detail h2', { hasText: /^E2E Verify$/ }).waitFor({ timeout: 5000 }).then(() => true, () => false);
  check('Enter records the debt and opens its person', (await made.isVisible()) && opened && /person=/.test(d.url()) && !d.url().includes('record='), d.url());
  await made.hover().catch(() => {});
  const inDb = await until('debts', (rows) => rows.some((row) => row.counterparty_name === 'E2E Verify'));
  check('the dev project holds the new debt', inDb.ok);
  await d.keyboard.press('Control+z');
  const outDb = await until('debts', (rows) => !rows.some((row) => row.counterparty_name === 'E2E Verify'));
  check('Ctrl Z removes the debt, its principal and its cash', outDb.ok && (await d.locator('.people-row .row-name b', { hasText: 'E2E Verify' }).count()) === 0);
  await d.keyboard.press('g');
  await d.keyboard.press('d');
  await d.waitForTimeout(300);
  check('G then D stays a Go to key and does not open Record a debt', !d.url().includes('record=debt'), d.url());
  await dctx.close();

  // ---------- reduced motion ----------
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const mctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, storageState: storage, reducedMotion });
    const m = await mctx.newPage();
    await open(m, '/debts');
    await ready(m);
    await m.locator('.people-row[data-debt]').first().click();
    await m.locator('aside.detail[data-open]').waitFor();
    const name = await m.locator('aside.detail').evaluate((el) => getComputedStyle(el).animationName);
    const expected = reducedMotion === 'reduce' ? 'fade-in' : 'slide-in-right';
    check(`the person pane opens with ${expected} when motion is ${reducedMotion}`, name === expected, name);
    await mctx.close();
  }

  // ---------- crossing 700 keeps the half-typed budget and repayment ----------
  const rctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, storageState: storage });
  const r = await rctx.newPage();
  await open(r, '/budget');
  await ready(r);
  const row = r.locator('.budget-row[data-budgeted="true"]').first();
  const rowId = await row.getAttribute('data-category');
  await row.locator('.row-name').click();
  await r.waitForURL(/category=/);
  await r.keyboard.press('Escape');
  await r.waitForURL((url) => !url.search.includes('category='));
  await row.locator('.bcell').click();
  await r.waitForURL(new RegExp(`category=${rowId}`));
  const half = r.locator('.budget-cell input');
  await half.fill('12');
  await half.evaluate((el) => {
    el.dataset.marker = 'kept';
  });
  const at = r.url();
  await r.setViewportSize({ width: 390, height: 844 });
  await r.waitForFunction(() => document.documentElement.dataset.layout === 'phone');
  await settle(r);
  const paneInput = r.locator('aside.detail input[aria-label$="budget in ringgit, editing"]');
  check(
    'crossing 700 with a half-typed budget keeps the route and shows the draft on the category page',
    r.url() === at && r.url().includes(`category=${rowId}`) && (await paneInput.inputValue().catch(() => '')) === '12',
    { at, now: r.url() },
  );
  await shot(r, 'budget-390-after-resize');
  await r.setViewportSize({ width: 820, height: 1180 });
  await r.waitForFunction(() => document.documentElement.dataset.layout === 'rail-one-column');
  check('and back across 700 the same cell still holds the draft', (await half.inputValue()) === '12' && (await half.getAttribute('data-marker')) === 'kept');
  await half.press('Escape');

  await open(r, '/debts');
  await ready(r);
  await r.locator('.people-row[data-debt][data-state="open"] .row-name').first().click();
  await r.waitForURL(/person=/);
  await r.keyboard.press('r');
  const repay = r.getByLabel('Amount paid back, in ringgit');
  await repay.fill('2');
  await repay.evaluate((el) => {
    el.dataset.marker = 'kept';
  });
  await r.setViewportSize({ width: 390, height: 844 });
  await r.waitForFunction(() => document.documentElement.dataset.layout === 'phone');
  check('crossing 700 with a half-typed repayment keeps it, in the same field', (await repay.inputValue()) === '2' && (await repay.getAttribute('data-marker')) === 'kept' && (await repay.isVisible()));
  await shot(r, 'debts-390-after-resize');
  await r.setViewportSize({ width: 820, height: 1180 });
  await r.waitForFunction(() => document.documentElement.dataset.layout === 'rail-one-column');
  check('and back across 700 it is still there', (await repay.inputValue()) === '2');
  await rctx.close();
}
