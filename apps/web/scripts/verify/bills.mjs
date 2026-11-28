// Make it a bill in web-verify (`--only bills`, #153): a payment from the Activity row menu and from the side
// panel opens New bill filled from it, Esc steps back to the transaction, Add bill writes a confirmed bill on the
// payment's wallet and category to the dev project, and Ctrl Z takes it away again. Read over REST, so the oracle
// shares no code with the app.

export async function verifyMakeBill({ browser, storage, check, shot, settle, open, seed, rest }) {
  const pinned = async (options) => {
    const ctx = await browser.newContext({ storageState: storage, timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    return ctx;
  };
  async function until(path, test, ms = 20_000) {
    const end = Date.now() + ms;
    let rows = await rest(path);
    while (!test(rows) && Date.now() < end) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      rows = await rest(path);
    }
    return { ok: test(rows), rows };
  }

  // A payment this month to a merchant paid once, with no name of its own and no bill verdict, so nothing yet makes it a bill.
  const [payments, overrides, aliases] = await Promise.all([
    rest('transactions?deleted=eq.false&type=eq.expense&debt_activity_id=is.null&select=id,amount,currency,merchant,transaction_date,wallet_id,category_id'),
    rest('recurring_overrides?deleted=eq.false&select=series_key'),
    rest('merchant_aliases?deleted=eq.false&select=raw_key').catch(() => []),
  ]);
  const key = (merchant) => merchant.trim().toLowerCase();
  const month = seed.seedDay.slice(0, 7);
  const payment = payments.find((row) => {
    const day = seed.dayOf(row.transaction_date);
    return (
      row.merchant &&
      /^[A-Za-z][A-Za-z '&.-]*$/.test(row.merchant.trim()) &&
      row.merchant.length <= 30 &&
      row.currency === seed.currency &&
      day.startsWith(month) &&
      day <= seed.seedDay &&
      Number(day.slice(8)) <= 28 &&
      payments.filter((other) => other.merchant && key(other.merchant) === key(row.merchant)).length === 1 &&
      !overrides.some((override) => override.series_key.endsWith(`|${key(row.merchant)}`)) &&
      !aliases.some((alias) => alias.raw_key === key(row.merchant))
    );
  });
  check('the seed has a payment this month that is not a bill yet', Boolean(payment), payments.length);
  if (!payment) return;
  const name = payment.merchant.trim();
  const amount = Number(payment.amount).toFixed(2);
  const live = `recurring_overrides?deleted=eq.false&kind=eq.bill&name=eq.${encodeURIComponent(name)}&select=status,expected_amount,expected_day,currency,wallet_id,category_id,due_once`;

  const ctx = await pinned({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await open(p, `/activity?q=${encodeURIComponent(name)}`);
  await p.locator('.activity[data-loaded]').waitFor({ timeout: 30_000 }).catch(() => {});
  const row = p.locator(`.activity-table [role="row"][data-row-id="${payment.id}"]`);
  await row.click({ button: 'right' });
  const offer = p.getByRole('menu').getByRole('menuitem', { name: 'Make it a bill' });
  check(`the row menu of ${name} offers Make it a bill`, await offer.isVisible().catch(() => false));
  await offer.click();
  const form = p.getByRole('form', { name: 'New bill' });
  await form.waitFor({ timeout: 5000 }).catch(() => {});
  const filled = {
    path: new URL(p.url()).pathname,
    pane: await p.getByRole('complementary', { name: 'New bill' }).isVisible().catch(() => false),
    name: await form.getByLabel('Name').inputValue().catch(() => null),
    amount: await form.getByLabel(`Amount in ${seed.currency}`).inputValue().catch(() => null),
    monthly: await form.getByRole('radio', { name: 'Every month' }).getAttribute('aria-checked').catch(() => null),
    button: ((await form.getByRole('button', { name: /^Add bill/ }).textContent().catch(() => '')) ?? '').replace('Enter', '').trim(),
  };
  check(
    'Make it a bill opens New bill in the side panel on the payment, filled with its merchant and amount, every month',
    filled.path === `/activity/${payment.id}` && filled.pane && filled.name === name && filled.amount === amount && filled.monthly === 'true' && filled.button === 'Add bill',
    filled,
  );
  await settle(p);
  await shot(p, 'activity-1440-light-new-bill');
  await p.keyboard.press('Escape');
  const pane = p.getByRole('complementary', { name: 'Transaction' });
  const again = pane.getByRole('button', { name: 'Make it a bill' });
  check('Esc steps back from New bill to the transaction, which offers it as a row', (await again.isVisible().catch(() => false)) && new URL(p.url()).pathname === `/activity/${payment.id}`, p.url());
  await settle(p);
  await shot(p, 'activity-1440-light-make-bill');

  await again.click();
  await form.getByRole('button', { name: /^Add bill/ }).click();
  const toast = p.getByRole('status').filter({ hasText: `${name} added to bills` });
  await toast.waitFor({ timeout: 5000 }).catch(() => {});
  check('Add bill says so in a toast with Undo, and the transaction reads Monthly bill', (await toast.getByRole('button', { name: 'Undo' }).isVisible().catch(() => false)) && (await pane.getByRole('link', { name: 'Monthly bill' }).isVisible().catch(() => false)));
  const wrote = await until(live, (rows) => rows.length === 1);
  const bill = wrote.rows[0] ?? {};
  check(
    `the dev project holds ${name} as a confirmed monthly bill for ${amount} on the payment's wallet and category, due on its day`,
    wrote.ok &&
      bill.status === 'confirmed' &&
      Number(bill.expected_amount).toFixed(2) === amount &&
      bill.expected_day === Number(seed.dayOf(payment.transaction_date).slice(8)) &&
      bill.currency === payment.currency &&
      bill.wallet_id === payment.wallet_id &&
      bill.category_id === payment.category_id &&
      bill.due_once === null,
    wrote.rows,
  );
  await p.keyboard.press('Control+z');
  await pane.getByRole('button', { name: 'Make it a bill' }).waitFor({ timeout: 5000 }).catch(() => {});
  const gone = await until(live, (rows) => rows.length === 0);
  check('Ctrl Z takes the bill away, here and in the dev project', gone.ok && (await pane.getByRole('button', { name: 'Make it a bill' }).isVisible().catch(() => false)), gone.rows);
  await ctx.close();

  for (const theme of ['light', 'dark']) {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      if (theme === 'light' && viewport.width === 1440) continue;
      const each = await pinned({ viewport, colorScheme: theme, hasTouch: viewport.width < 700 });
      await each.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      const q = await each.newPage();
      await open(q, `/activity/${payment.id}`);
      await q.getByRole('button', { name: 'Make it a bill' }).click();
      const shown = q.getByRole('form', { name: 'New bill' });
      await shown.waitFor({ timeout: 5000 }).catch(() => {});
      const wide = await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      check(`New bill at ${viewport.width} ${theme} shows whole, with no sideways scroll`, (await shown.getByRole('button', { name: /^Add bill/ }).isVisible().catch(() => false)) && wide, { wide });
      await settle(q);
      await shot(q, `activity-${viewport.width}-${theme}-new-bill`);
      if (viewport.width < 700) {
        await shown.getByRole('button', { name: 'Back' }).click();
        check(`Back on the phone layout at ${theme} returns to the transaction`, await q.getByRole('button', { name: 'Make it a bill' }).isVisible().catch(() => false));
      }
      await each.close();
    }
  }
}
