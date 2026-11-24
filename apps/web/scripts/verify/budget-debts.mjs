// Budget and Debts in web-verify (`--only ledger`): every layout in both themes, the keys, reduced
// motion, the 700 crossing with a half-typed budget and repayment, and the numbers against the e2e
// user's rows. Every write goes to the e2e user and is undone with Ctrl Z before the part ends.
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
  const { browser, base, storage, check, shot, pair, settle, open, widths, background, navFor, query, seed } = t;
  /** A context on the seed's day at 3 pm in the user's zone, like Home's, so the month is the seed's month. */
  const pinned = async (options) => {
    const ctx = await browser.newContext({ timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    return ctx;
  };
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
      const ctx = await pinned({ viewport: { width: size.width, height: size.height }, storageState: storage, colorScheme: theme });
      await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      const p = await ctx.newPage();
      for (const screen of ['budget', 'debts']) {
        await p.goto(`${base}/${screen}`);
        await ready(p);
        const where = `/${screen} at ${size.width} ${theme}`;
        const state = await p.evaluate(() => ({
          layout: document.documentElement.dataset.layout,
          bg: getComputedStyle(document.body).backgroundColor,
          paneShown: (() => {
            const pane = document.querySelector('aside.slide-over');
            return pane ? getComputedStyle(pane).display !== 'none' : null;
          })(),
        }));
        const nav = await p.locator(navFor[size.layout]).isVisible();
        const tableShown =
          screen === 'debts'
            ? await p.locator('.people-card').first().isVisible()
            : await p.locator(size.layout === 'phone' ? 'section.rings' : '.budgets-card').isVisible();
        check(
          `${where}: ${size.layout} with its nav, ${theme} ground, no pane until a row is picked, no sideways scroll`,
          state.layout === size.layout && nav && state.bg === background[theme] && state.paneShown === null && !(await scrolls(p)) && tableShown,
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
          const box = await p.locator('aside.slide-over').boundingBox();
          const tabbar = await p.locator('nav.tabbar').isVisible();
          const back = await p.locator('aside.slide-over .phone-back').isVisible();
          const fills =
            size.layout === 'phone'
              ? box?.x === 0 && box?.width === size.width && !tabbar && back
              : box !== null && Math.round(box.width) === Math.min(960, size.width - 240) && !back && (await p.locator('.slide-over-scrim[data-open]').isVisible()) && (await p.getByRole('button', { name: `Back to ${screen === 'budget' ? 'Budget' : 'Debts'} (Esc)` }).isVisible());
          check(
            `${where}: a picked row opens its pane ${size.layout === 'phone' ? 'as the full-screen page with Back and no tab bar' : 'in the slide-over over the dimmed page, with ‹ back, up and down'}`,
            fills,
            { box, tabbar, back },
          );
          if (size.layout === 'sidebar') {
            const keyOn = (name) => p.locator(`aside.slide-over button[aria-label$="(${name})"] .kbd`).first().textContent().catch(() => null);
            const keys = { K: await keyOn('K'), J: await keyOn('J'), [screen === 'budget' ? 'E' : 'R']: await (screen === 'budget' ? p.locator('aside.slide-over :is(.pill-field, .set-btn) .kbd').first().textContent().catch(() => null) : p.locator('aside.slide-over button', { hasText: 'Record a repayment' }).locator('.kbd').textContent().catch(() => null)) };
            check(
              `${where}: K and J sit on the pane's chevrons and ${screen === 'budget' ? 'E on its budget' : 'R on Record a repayment'}, with no hints off to one side`,
              Object.entries(keys).every(([key, text]) => key === text) && (await p.locator('.hint-keys').count()) === 0,
              keys,
            );
          }
          await shot(p, `${screen}-${size.width}-${theme}-pane`);
          await p.keyboard.press('Escape');
          await p.waitForURL((url) => !/category=|person=/.test(url.search)).catch(() => {});
          const gone = await p.locator('aside.slide-over').waitFor({ state: 'detached', timeout: 2000 }).then(() => true, () => false);
          check(`${where}: Esc slides the pane out`, !/category=|person=/.test(p.url()) && gone, p.url());
          if (size.layout === 'sidebar') {
            await firstRow.click();
            await p.waitForURL(screen === 'budget' ? /category=/ : /person=/);
            await settle(p);
            await p.locator('.slide-over-scrim[data-open]').click({ position: { x: 300, y: 400 } });
            await p.waitForURL((url) => !/category=|person=/.test(url.search)).catch(() => {});
            check(`${where}: a click on the dimmed page closes the slide-over`, !/category=|person=/.test(p.url()), p.url());
          }
        }
      }
      await ctx.close();
    }
  }
  await pair('budget-1440', 'r2/W2-Budget.png', join(t.out, 'budget-1440-light-pane.png'));
  await pair('debts-1440', 'r2/W2-Debts.png', join(t.out, 'debts-1440-light-pane.png'));

  // ---------- Budget: numbers against the rows, the keys, edits undone ----------
  const ctx = await pinned({ viewport: { width: 1440, height: 900 }, storageState: storage });
  const p = await ctx.newPage();
  const originalBudgets = budgetMap(query('budgets'));
  for (const monthStep of [0, -1]) {
    await open(p, '/budget');
    await ready(p);
    if (!monthStep) {
      check('Budget draws no native select', (await p.locator('select').count()) === 0);
      await p.locator('.month-nav .chip').filter({ visible: true }).first().locator('svg').last().click();
      const months = p.getByRole('listbox', { name: 'Month' });
      check("the month chip's chevron opens Moni's month grid with this month picked", (await months.isVisible()) && (await months.getByRole('option', { selected: true }).count()) === 1);
      const cells = await months.getByRole('option').evaluateAll((all) => all.map((cell) => ({ name: cell.ariaLabel, picked: cell.ariaSelected === 'true', off: cell.disabled })));
      const picked = cells.findIndex((cell) => cell.picked);
      check('the month grid shows a year, Jan to Dec, and no month after this one', cells.length === 12 && cells.slice(picked + 1).every((cell) => cell.off), cells);
      await p.keyboard.press('Escape');
      check('Esc closes the month grid and gives the chip the focus back', !(await months.isVisible()) && (await p.evaluate(() => document.activeElement?.matches('.month-nav .chip'))));
    }
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
    const ringOf = await p.locator('.ring-of').textContent();
    const over = (Math.round(ringgit(total.spent) * 100) - Math.round(ringgit(total.budget) * 100)) / 100;
    const ringLine = Number.isNaN(over) ? 'spent' : over > 0 ? `${whole(over)} over` : `of ${total.budget}`;
    check(
      `Budget ${month}: the total adds up the rows (plus spending with no category), the ring shows the same total and budget`,
      ringgit(total.spent) + 0.005 >= rowSpent &&
        ringgit(total.last) + 0.005 >= rowLast &&
        near(ringgit(ring), ringgit(total.spent)) &&
        ringOf === ringLine &&
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
  check('picking a row opens its category pane with its name', (await p.locator('aside.slide-over h2').textContent()) === firstName);
  const history = p.locator('aside.slide-over .history-plot');
  const restText = await history.evaluate((el) => [...el.querySelectorAll('span')].map((span) => span.textContent).join('|'));
  const historyBox = await history.boundingBox();
  await p.mouse.move(historyBox.x + historyBox.width - 12, historyBox.y + historyBox.height - 12);
  const tipValue = await history.locator('.chart-tip-value').textContent({ timeout: 2000 }).catch(() => null);
  const rowSpent = await first.locator('[data-col="spent"]').textContent();
  check(
    "the six-month chart prints no month's value at rest, and the pointer on this month shows what its row spent",
    !/\.\d\d/.test(restText) && tipValue !== null && near(ringgit(tipValue), ringgit(rowSpent)),
    { restText, tipValue, rowSpent },
  );
  await p.mouse.move(0, 0);
  const paneHrefs = await p.locator('aside.slide-over a[href]').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  const pager = p.locator('aside.slide-over nav[aria-label="Pages"]');
  let paged = { pages: 0 };
  if (await pager.isVisible()) {
    const before = await p.locator('aside.slide-over .pane-row').first().getAttribute('href');
    await pager.getByRole('button', { name: 'Next page' }).click();
    paged = { pages: (await pager.textContent()).trim(), before, after: await p.locator('aside.slide-over .pane-row').first().getAttribute('href'), path: new URL(p.url()).pathname };
  }
  check(
    "the category pane links nowhere in Activity's list and pages its payments in place",
    !paneHrefs.some((href) => href.startsWith('/activity?')) && (paged.pages === 0 || (paged.path === '/budget' && paged.before !== paged.after && /^2 of \d+$/.test(paged.pages))),
    { paneHrefs, paged },
  );
  await p.keyboard.press('j');
  await p.waitForURL(new RegExp(`category=${rowIds[rowIds.indexOf(firstId) + 1] ?? firstId}`)).catch(() => {});
  check('J moves to the next category', p.url().includes(`category=${rowIds[rowIds.indexOf(firstId) + 1] ?? firstId}`), p.url());
  await p.keyboard.press('k');
  await p.waitForURL(new RegExp(`category=${firstId}`)).catch(() => {});
  check('K moves back', p.url().includes(`category=${firstId}`), p.url());
  await p.keyboard.press('e');
  const paneCell = p.locator('aside.slide-over input[aria-label$="budget in ringgit, editing"]');
  await paneCell.waitFor({ timeout: 5000 }).catch(() => {});
  check('with the slide-over open, E edits its budget there', await paneCell.isVisible());
  await p.keyboard.press('Escape');
  await p.keyboard.press('Escape');
  await p.waitForURL((url) => !url.search.includes('category=')).catch(() => {});
  check('Esc cancels that edit, and a second Esc closes the slide-over', (await paneCell.count()) === 0 && !p.url().includes('category='), p.url());

  await p.keyboard.press('e');
  const cell = p.locator('.budget-cell input');
  await cell.waitFor({ timeout: 5000 }).catch(() => {});
  const old = Math.floor(originalBudgets[firstName]);
  check('with nothing open, E edits the first budget in its cell, starting from what is saved', (await cell.inputValue().catch(() => '')) === String(old));
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
  check('Esc in the cell cancels the edit, with no slide-over opened', (await cell.count()) === 0 && !p.url().includes('category=') && (await first.locator('[data-col="budget"]').textContent()) === whole(old));

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
  const dctx = await pinned({ viewport: { width: 1440, height: 900 }, storageState: storage });
  const d = await dctx.newPage();
  await open(d, '/debts');
  await ready(d);
  const debts = query('debts');
  const openNames = debts.filter((row) => row.status === 'open').map((row) => row.counterparty_name).sort();
  const shownNames = (await d.locator('.people-card').first().locator('.people-row[data-debt] .row-name .row-text b').allTextContents()).sort();
  check("the people table lists the e2e user's open debts", JSON.stringify(shownNames) === JSON.stringify(openNames), { shownNames, openNames });
  const people = await d.locator('.people-card').first().locator('.people-row[data-debt]').evaluateAll((els) =>
    els.map((el) => ({ id: el.dataset.debt, owesYou: el.querySelector('[data-col="owes-you"]')?.textContent ?? '', youOwe: el.querySelector('[data-col="you-owe"]')?.textContent ?? '' })),
  );
  const owed = people.reduce((sum, row) => sum + (row.owesYou ? ringgit(row.owesYou) : 0), 0);
  const owe = people.reduce((sum, row) => sum + (row.youOwe ? ringgit(row.youOwe) : 0), 0);
  const totals = await d.locator('[data-testid="people-total"]').evaluate((el) => [el.querySelector('[data-col="owes-you"]')?.textContent, el.querySelector('[data-col="you-owe"]')?.textContent]);
  const net = await d.locator('[data-testid="net-amount"]').textContent();
  const label = await d.locator('.net-label').textContent();
  check(
    "the totals add up the rows, the bar's ends and the net position follow them",
    totals[0] === cents(owed) &&
      totals[1] === cents(owe) &&
      (await d.locator('[data-testid="net-owed_to_me"]').textContent()) === whole(owed) &&
      (await d.locator('[data-testid="net-i_owe"]').textContent()) === whole(owe) &&
      net === whole(owed - owe) &&
      label === (owed > owe ? 'Overall, you are owed' : owed < owe ? 'Overall, you owe' : 'Everyone is square'),
    { totals, owed, owe, net, label },
  );
  const bar = await d.locator('.net-bar > span').evaluateAll((els) => els.map((el) => ({ side: el.dataset.side, grow: Number(getComputedStyle(el).flexGrow), height: el.getBoundingClientRect().height })));
  check(
    "the hero's bar sizes owed against owe, 10 high, and leaves out an empty side",
    bar.length === [owed, owe].filter((value) => value > 0).length && bar.every((part) => part.height === 10 && near(part.grow / 100, part.side === 'owed_to_me' ? owed : owe)),
    bar,
  );
  const pickFilter = async (trigger, option) => {
    await d.locator(`.people-filters [aria-label^="${trigger}"]`).click();
    await d.getByRole('option', { name: new RegExp(`^${option}`) }).click();
  };
  await pickFilter('Show: Everyone', 'Owed to you');
  await d.waitForURL(/side=owed_to_me/);
  const filtered = await d.locator('.people-card').first().locator('.people-row[data-debt] [data-col="you-owe"]').allTextContents();
  const coming = await d.locator('.coming-row .row-text b').allTextContents();
  check('Owed to you filters the table and Coming up to what others owe', filtered.every((text) => text === '') && coming.every((text) => !text.startsWith('Pay ')), { filtered, coming });
  await pickFilter('Show: Owed to you', 'Everyone');
  await pickFilter('Status: Open', 'Settled and written off');
  await d.waitForURL(/status=closed/);
  const closedCount = await d.locator('[aria-label="Settled debts"] .people-row[data-debt]').count();
  check('Settled and written off lists the closed ones', closedCount === debts.filter((row) => row.status !== 'open').length, closedCount);
  await pickFilter('Status: Settled', 'Open');
  await d.waitForURL((url) => !url.search.includes('status='));

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

    const writeOffButton = d.locator('.slide-over-head .pane-write-off');
    const asks = d.getByRole('alertdialog', { name: /^Write off RM[\d,.]+\?$/ });
    await writeOffButton.click();
    await asks.waitFor({ timeout: 5000 }).catch(() => {});
    check(
      'Write off asks first, says no money moves, and focuses Cancel',
      (await asks.isVisible()) &&
        (await asks.getByText('No money moves, and this history stays.').isVisible()) &&
        (await asks.getByRole('button', { name: /^Cancel/ }).evaluate((el) => el === document.activeElement)),
    );
    await shot(d, 'debts-1440-light-write-off');
    await d.keyboard.press('j');
    await d.keyboard.press('Escape');
    await d.waitForTimeout(300);
    check(
      'Esc closes the ask and nothing else: the pane stays on the same person, J did not move it, nothing written off',
      !(await asks.isVisible()) && new RegExp(`person=${target.id}`).test(d.url()) && !query('debt-activities').some((row) => row.debt_id === target.id && row.kind === 'write_off'),
      d.url(),
    );
    await writeOffButton.click();
    await asks.getByRole('button', { name: 'Write off' }).click();
    const wrote = d.getByRole('status').filter({ hasText: /^Wrote off/ });
    await wrote.waitFor({ timeout: 5000 }).catch(() => {});
    check('Write off in the ask writes it off with a toast that offers Undo', await wrote.getByRole('button', { name: 'Undo' }).isVisible().catch(() => false));
    await wrote.hover().catch(() => {});
    const off = await until('debt-activities', (rows) => rows.some((row) => row.debt_id === target.id && row.kind === 'write_off'));
    check('the dev project holds the write-off', off.ok);
    await d.keyboard.press('Control+z');
    const back = await until('debt-activities', (rows) => !rows.some((row) => row.debt_id === target.id && row.kind === 'write_off'));
    check('Ctrl Z takes the write-off back, on screen and in the dev project', back.ok && near(ringgit(await d.locator('[data-testid="person-balance"]').textContent()), before));
    await d.keyboard.press('Escape');
  }

  await d.keyboard.press('d');
  await d.waitForURL(/record=debt/);
  await d.getByRole('textbox', { name: 'Who' }).fill('E2E Verify');
  await d.getByLabel('Amount, in ringgit').fill('12.34');
  check('Record a debt names the person and the amount on its button', await d.getByRole('button', { name: /^Record: E2E Verify owes you RM12\.34/ }).isVisible());
  check(
    "Record a debt starts on Money didn't leave my wallet, shown as Wallet: Not used",
    (await d.locator(`.record-debt [aria-label="Wallet: Money didn't leave my wallet"]`).isVisible()) &&
      (await d.locator('.record-debt .field-row .label-text', { hasText: /^Wallet$/ }).isVisible()) &&
      (await d.locator('.record-debt .select-value', { hasText: /^Not used$/ }).isVisible()),
  );
  await shot(d, 'debts-1440-light-record');
  await d.keyboard.press('Enter');
  const made = d.getByRole('status').filter({ hasText: 'Recorded a debt with E2E Verify' });
  await made.waitFor({ timeout: 5000 }).catch(() => {});
  const opened = await d.locator('aside.slide-over h2', { hasText: /^E2E Verify$/ }).waitFor({ timeout: 5000 }).then(() => true, () => false);
  check('Enter records the debt and opens its person', (await made.isVisible()) && opened && /person=/.test(d.url()) && !d.url().includes('record='), d.url());
  check('its row says Noted, not Lent', await d.locator('.people-row[data-debt]', { hasText: 'E2E Verify' }).locator('.row-text span', { hasText: /^Noted / }).isVisible());
  await d.keyboard.press('r');
  await d.getByLabel('Amount paid back, in ringgit').waitFor({ timeout: 5000 }).catch(() => {});
  const choose = d.locator('.repay-form button.btn-ink');
  check('paying back a debt with no wallet starts unchosen and asks where it went', ((await choose.textContent()) ?? '').startsWith('Choose where it went') && (await choose.isDisabled()), await choose.textContent());
  await d.locator('.repay-form .select-trigger').first().click();
  const firstOption = await d.getByRole('option').first().textContent();
  check("its first choice is Money didn't reach my wallet", (firstOption ?? '').includes("Money didn't reach my wallet"), firstOption);
  await shot(d, 'debts-1440-light-repay-noted');
  await d.keyboard.press('Escape');
  await d.keyboard.press('Escape');
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
    const mctx = await pinned({ viewport: { width: 820, height: 1180 }, storageState: storage, reducedMotion });
    const m = await mctx.newPage();
    await open(m, '/debts');
    await ready(m);
    await m.locator('.people-row[data-debt]').first().click();
    await m.locator('aside.slide-over[data-open]').waitFor();
    const name = await m.locator('aside.slide-over').evaluate((el) => getComputedStyle(el).animationName);
    const expected = reducedMotion === 'reduce' ? 'fade-in' : 'slide-in-right';
    check(`the person pane opens with ${expected} when motion is ${reducedMotion}`, name === expected, name);
    await mctx.close();
  }

  // ---------- crossing 700 keeps the half-typed budget and repayment ----------
  const rctx = await pinned({ viewport: { width: 820, height: 1180 }, storageState: storage });
  const r = await rctx.newPage();
  await open(r, '/budget');
  await ready(r);
  const row = r.locator('.budget-row[data-budgeted="true"]').first();
  const rowId = await row.getAttribute('data-category');
  await row.locator('.bcell').click();
  check(
    'at 820 a budget cell edits in the table and opens no slide-over',
    (await r.locator('.budget-cell input').count()) === 1 && (await r.locator('aside.slide-over').count()) === 0 && !r.url().includes('category='),
  );
  await r.keyboard.press('Escape');
  await row.locator('.row-name').click();
  await r.waitForURL(new RegExp(`category=${rowId}`));
  await r.locator('aside.slide-over').getByRole('button', { name: /monthly budget, .*, edit \(E\)$/ }).click();
  const half = r.locator('aside.slide-over input[aria-label$="budget in ringgit, editing"]');
  check('the slide-over edits its own budget', await half.isVisible());
  await half.fill('12');
  await half.evaluate((el) => {
    el.dataset.marker = 'kept';
  });
  const at = r.url();
  await r.setViewportSize({ width: 390, height: 844 });
  await r.waitForFunction(() => document.documentElement.dataset.layout === 'phone');
  await settle(r);
  check(
    'crossing 700 with a half-typed budget keeps the route and the draft, in the same field on the category page',
    r.url() === at && r.url().includes(`category=${rowId}`) && (await half.inputValue().catch(() => '')) === '12' && (await half.getAttribute('data-marker')) === 'kept',
    { at, now: r.url() },
  );
  await shot(r, 'budget-390-after-resize');
  await r.setViewportSize({ width: 820, height: 1180 });
  await r.waitForFunction(() => document.documentElement.dataset.layout === 'rail-one-column');
  check('and back across 700 the same field still holds the draft', (await half.inputValue()) === '12' && (await half.getAttribute('data-marker')) === 'kept');
  await half.press('Escape');
  await r.keyboard.press('Escape');
  await r.waitForURL((url) => !url.search.includes('category='));
  const totalCell = r.getByTestId('budget-monthly-total');
  const shown = (await totalCell.innerText()).replace(/[^\d]/g, '');
  await totalCell.click();
  const totalInput = r.getByLabel('Monthly total in ringgit, editing');
  check('the Total row opens the monthly total in place, starting from the amount it shows', (await totalInput.inputValue()) === shown, {
    shown,
    typed: await totalInput.inputValue(),
  });
  await totalInput.press('Escape');
  check('Esc closes it without a write', (await totalInput.count()) === 0 && (await totalCell.isVisible()));
  await r.getByRole('button', { name: 'Ask Moni to suggest' }).click();
  const suggest = r.getByRole('dialog', { name: 'Ask Moni to suggest a budget' });
  await suggest.waitFor({ timeout: 5000 }).catch(() => {});
  const rows = await suggest.locator('.suggest-row b').allInnerTexts();
  const lines = await suggest.locator('.suggest-row .num').allInnerTexts();
  check(
    'Ask Moni to suggest opens on Monthly total and the categories, each with last month',
    rows[0] === 'Monthly total' && rows.length > 1 && lines.every((line) => / last month$/.test(line)),
    { rows, lines },
  );
  await shot(r, 'budget-820-suggest-pick');
  await r.keyboard.press('Escape');
  check('Esc closes it without asking Moni', (await suggest.count()) === 0);

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
  await verifyDebtFlows(t);
}

/** Debts, Record a debt and Record a repayment with their wallet pickers open, at 1440 and 390 in both themes (`--only debt-flows`); shots only, no writes. */
export async function verifyDebtFlows({ browser, base, storage, shot, open, seed, query }) {
  const pinned = async (options) => {
    const ctx = await browser.newContext({ timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    return ctx;
  };
  const ready = (p) => p.locator('[data-screen]').waitFor({ timeout: 20_000 });
  const anyOpen = query('debts').some((row) => row.status === 'open');
  for (const theme of ['light', 'dark']) {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const fctx = await pinned({ viewport: size, storageState: storage, colorScheme: theme });
      await fctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      const f = await fctx.newPage();
      const tag = `debts-flow-${size.width}-${theme}`;
      await open(f, '/debts');
      await ready(f);
      await shot(f, `${tag}-screen`);
      await f.goto(`${base}/debts?record=debt`);
      await f.getByRole('textbox', { name: 'Who' }).waitFor({ timeout: 10_000 });
      await f.getByRole('textbox', { name: 'Who' }).fill('Hana');
      await f.getByLabel('Amount, in ringgit').fill('50');
      await shot(f, `${tag}-record`);
      await f.locator('.record-debt .select-trigger').first().click();
      await f.getByRole('listbox').waitFor({ timeout: 5000 }).catch(() => {});
      await shot(f, `${tag}-record-wallet`);
      await f.keyboard.press('Escape');
      if (anyOpen) {
        await open(f, '/debts');
        await ready(f);
        await f.locator('.people-row[data-debt][data-state="open"] .row-name').first().click();
        const repayButton = f.getByRole('button', { name: /^Record a repayment/ }).first();
        await repayButton.waitFor({ timeout: 10_000 });
        await repayButton.click();
        await f.getByLabel('Amount paid back, in ringgit').waitFor({ timeout: 5000 });
        await shot(f, `${tag}-repay`);
        await f.locator('.repay-form .select-trigger').first().click();
        await f.getByRole('listbox').waitFor({ timeout: 5000 }).catch(() => {});
        await shot(f, `${tag}-repay-wallet`);
      }
      await fctx.close();
    }
  }
}
