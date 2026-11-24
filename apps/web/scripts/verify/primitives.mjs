// The shared controls on Activity and in the shell, each opened and shot in landscape and portrait in both
// themes: a filter popover, a select, the date picker, the row menu, the confirm, the shortcuts dialog,
// the account menu and a toast. A category it picks is undone with Ctrl Z. Each also proves Esc closes it and hands the focus back.
const SIZES = [
  { name: 'landscape', width: 1440, height: 900 },
  { name: 'portrait', width: 820, height: 1180 },
];

const focused = (page) => page.evaluate(() => document.activeElement?.outerHTML.slice(0, 160));

const onScreen = (locator) =>
  locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
  });

export async function verifyPrimitives({ browser, base, storage, check, shot, seed }) {
  for (const theme of ['light', 'dark']) {
    for (const size of SIZES) {
      const where = `${size.name} ${theme}`;
      const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, storageState: storage, colorScheme: theme });
      await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      await ctx.clock.setFixedTime(seed.pin);
      const p = await ctx.newPage();
      const name = (part) => `primitive-${part}-${size.name}-${theme}`;
      await p.goto(`${base}/activity`);
      await p.waitForFunction(() => document.documentElement.dataset.shellReady === 'true');
      await p.locator('.activity[data-loaded]').waitFor({ timeout: 20_000 }).catch(() => {});

      const chip = p.getByRole('group', { name: 'Filters' }).locator('.filter-chip').nth(1);
      await chip.click();
      const filter = p.getByRole('dialog').last();
      check(`${where}: a filter chip opens its popover on screen`, (await filter.isVisible()) && (await onScreen(filter)));
      await shot(p, name('filter'));
      await p.keyboard.press('Escape');
      await p.waitForTimeout(500);
      check(`${where}: Esc closes the filter popover and focus returns to its chip`, await chip.evaluate((el) => el === document.activeElement));

      const row = p.locator('[role="row"][data-row-id]:visible').nth(2);
      if (size.width >= 1024) {
        await row.click({ button: 'right' });
        const menu = p.getByRole('menu');
        await menu.waitFor({ timeout: 3000 }).catch(() => {});
        check(`${where}: right-click opens the row menu on screen`, (await menu.isVisible()) && (await onScreen(menu)));
        await p.keyboard.press('ArrowDown');
        check(`${where}: ArrowDown moves through the row menu`, await p.evaluate(() => document.activeElement?.getAttribute('role') === 'menuitem'));
        await shot(p, name('row-menu'));
        await menu.getByRole('menuitem', { name: /Delete/ }).click();
        const confirm = p.getByRole('alertdialog');
        await confirm.waitFor({ timeout: 3000 }).catch(() => {});
        check(`${where}: Delete asks in the confirm with Cancel focused`, (await confirm.isVisible()) && (await p.evaluate(() => document.activeElement?.textContent?.startsWith('Cancel'))));
        await p.keyboard.press('Tab');
        await p.keyboard.press('Tab');
        check(`${where}: Tab stays inside the confirm`, await confirm.evaluate((el) => el.contains(document.activeElement)));
        await shot(p, name('confirm'));
        await p.keyboard.press('Escape');
        await p.waitForTimeout(500);
        const confirmGone = !(await confirm.isVisible().catch(() => false));
        check(`${where}: Esc closes the confirm`, confirmGone);
        if (!confirmGone) await confirm.getByRole('button', { name: /^Cancel/ }).click();
        const all = p.getByRole('checkbox', { name: 'Select all on this page' });
        const took = await all.click({ timeout: 3000 }).then(() => true, () => false);
        check(`${where}: after the confirm the page takes a press again`, took && (await all.isChecked()), await p.evaluate(() => [...document.querySelectorAll('[inert]')].map((el) => el.className).join()));
        if (took) await p.keyboard.press('Escape');
        await p.waitForTimeout(300);
      }

      await row.click();
      const pane = p.getByRole('complementary', { name: 'Transaction' });
      await pane.waitFor({ timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(500);
      const category = pane.locator('.pane-field').filter({ hasText: 'Category' }).locator('.field-chip');
      await category.click();
      const list = p.getByRole('listbox', { name: 'category' });
      await list.waitFor({ timeout: 3000 }).catch(() => {});
      await p.waitForFunction(() => document.activeElement?.getAttribute('role') === 'option', null, { timeout: 2000 }).catch(() => {});
      check(`${where}: the pane's category opens its list on screen with the chosen row focused`, (await list.isVisible()) && (await onScreen(list)) && (await p.evaluate(() => document.activeElement?.getAttribute('aria-selected') === 'true')), await focused(p));
      await shot(p, name('select'));
      await p.keyboard.press('Escape');
      await p.waitForTimeout(500);
      check(`${where}: Esc closes the list, keeps the pane and focuses the category`, (await pane.isVisible()) && (await category.evaluate((el) => el === document.activeElement)));

      const date = pane.locator('.pane-field').filter({ hasText: 'Date' }).locator('.field-chip');
      await date.click();
      const picker = p.getByRole('dialog', { name: 'date' });
      await picker.waitFor({ timeout: 3000 }).catch(() => {});
      check(`${where}: the pane's date opens the calendar on screen`, (await picker.isVisible()) && (await onScreen(picker)));
      await shot(p, name('date'));
      await p.keyboard.press('Escape');
      await p.waitForTimeout(500);
      check(`${where}: Esc closes the calendar and keeps the pane`, (await pane.isVisible()) && !(await picker.isVisible().catch(() => false)));
      await p.keyboard.press('Escape');
      await p.waitForURL((url) => url.pathname === '/activity' && !url.search.includes('open')).catch(() => {});

      await p.keyboard.press('Shift+?');
      const shortcuts = p.getByRole('dialog', { name: 'Keyboard shortcuts' });
      await shortcuts.waitFor({ timeout: 3000 }).catch(() => {});
      check(`${where}: ? opens the shortcuts dialog with the focus inside`, (await shortcuts.isVisible()) && (await shortcuts.evaluate((el) => el.contains(document.activeElement))));
      await shot(p, name('shortcuts'));
      await p.keyboard.press('Escape');
      await p.waitForTimeout(500);
      check(`${where}: Esc closes the shortcuts dialog`, !(await shortcuts.isVisible().catch(() => false)));

      const account = p.locator('nav button[aria-haspopup="menu"]:visible').first();
      await account.focus();
      await p.keyboard.press('Enter');
      const menu = p.getByRole('menu', { name: 'Account' });
      await menu.waitFor({ timeout: 3000 }).catch(() => {});
      await p.waitForFunction(() => document.activeElement?.getAttribute('role') === 'menuitem', null, { timeout: 2000 }).catch(() => {});
      check(`${where}: the account menu opens on screen with Settings focused`, (await menu.isVisible()) && (await onScreen(menu)) && (await p.evaluate(() => document.activeElement?.textContent?.trim() === 'Settings')), await focused(p));
      await p.keyboard.press('ArrowDown');
      check(`${where}: ArrowDown moves down the account menu`, await p.evaluate(() => document.activeElement?.textContent?.trim() !== 'Settings'));
      await shot(p, name('account-menu'));
      await p.keyboard.press('Escape');
      await p.waitForTimeout(500);
      check(`${where}: Esc closes the account menu and focus returns to the name`, !(await menu.isVisible().catch(() => false)) && (await account.evaluate((el) => el === document.activeElement)));
      if (await menu.isVisible().catch(() => false)) await account.click({ force: true });

      await row.click();
      await pane.waitFor({ timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(500);
      await category.click();
      await list.getByRole('option', { selected: false }).first().click();
      const toast = p.getByRole('status').filter({ hasText: /^Moved to / });
      await toast.waitFor({ timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(400);
      check(`${where}: a category picked shows the toast with Undo`, await toast.getByRole('button', { name: 'Undo' }).isVisible());
      await shot(p, name('toast'));
      await p.keyboard.press('Control+z');
      await p.waitForTimeout(500);
      await ctx.close();
    }
  }
}
