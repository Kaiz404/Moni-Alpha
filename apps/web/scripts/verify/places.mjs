// Where you spend in web-verify (`--only places`): every layout in both themes with a place open, the
// numbers against the e2e user's expenses, the keys, hover linking a row and its pin, zoom and Fit,
// Pins | Heat, the filters, Add a place undone with Ctrl Z, the 700 crossing keeping the place, and
// reduced motion on the pane. The one write is undone before the part ends.
import { join } from 'node:path';

function ringgit(text) {
  const match = /(−|-)?RM([\d,]+(?:\.\d+)?)/.exec(text ?? '');
  if (!match) return Number.NaN;
  const value = Number(match[2].replace(/,/g, ''));
  return match[1] ? -value : value;
}

const cents = (minor) => `RM${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The places screen's numbers from the raw rows, by the ledger's rules and nothing else: spending is an
 * expense that is neither a balance fix nor debt cash, in the main currency, on a day in the range.
 */
function oracle(rows, seed, days) {
  const from = days === null ? '' : new Date(Date.parse(`${seed.seedDay}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const counted = rows.filter(
    (row) =>
      !row.analysis_excluded &&
      !row.debt_activity_id &&
      row.currency === seed.currency &&
      seed.dayOf(row.transaction_date) >= from &&
      seed.dayOf(row.transaction_date) <= seed.seedDay,
  );
  const minor = (row) => Math.round(Number(row.amount) * 100);
  const placed = counted.filter((row) => row.location_latitude !== null);
  const loose = counted.filter((row) => row.location_latitude === null);
  const spots = new Map();
  for (const row of placed) {
    const key = `${row.location_latitude},${row.location_longitude}`;
    spots.set(key, (spots.get(key) ?? 0) + minor(row));
  }
  return {
    totalMinor: placed.reduce((sum, row) => sum + minor(row), 0),
    places: spots.size,
    topMinor: Math.max(0, ...spots.values()),
    loose: loose.length,
    looseMinor: loose.reduce((sum, row) => sum + minor(row), 0),
    looseIds: loose.map((row) => row.id),
  };
}

export async function verifyPlaces(t) {
  const { browser, storage, check, shot, pair, settle, open, widths, background, navFor, query, seed } = t;
  const pinned = async (options) => {
    const ctx = await browser.newContext({ timezoneId: seed.zone, ...options });
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
  const ready = async (p) => {
    await p.locator('[data-screen="places"]').waitFor({ timeout: 20_000 });
    await p.locator('.map-pin-big[data-shown]').first().waitFor({ timeout: 10_000 });
  };
  const scrolls = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const rows = query('expenses');
  const month = oracle(rows, seed, 30);
  const week = oracle(rows, seed, 7);
  const ever = oracle(rows, seed, null);

  // ---------- every layout, light and dark ----------
  for (const theme of ['light', 'dark']) {
    for (const size of widths) {
      const ctx = await pinned({ viewport: { width: size.width, height: size.height }, storageState: storage, colorScheme: theme });
      await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      const p = await ctx.newPage();
      await open(p, '/home/places');
      await ready(p);
      const where = `/home/places at ${size.width} ${theme}`;
      const phone = size.layout === 'phone';
      const state = await p.evaluate(() => ({
        layout: document.documentElement.dataset.layout,
        bg: getComputedStyle(document.body).backgroundColor,
        land: getComputedStyle(document.querySelector('.places-map')).backgroundColor,
      }));
      const nav = phone ? !(await p.locator('nav.tabbar').isVisible()) : await p.locator(navFor[size.layout]).isVisible();
      const back = phone ? await p.locator('.phone-head .back-button').isVisible() : await p.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' }).isVisible();
      const homeActive = phone || (await p.locator(`${navFor[size.layout]} [aria-current="page"]`).first().textContent())?.includes('Home');
      const lower = await p.locator('section[aria-label="Day by day"]').isVisible();
      check(
        `${where}: ${size.layout}, ${phone ? 'a pushed page with Back and no tab bar' : 'Home ›, Home lit in the nav'}, ${theme} ground, ${phone ? 'no Day by day' : 'Day by day below'}, no sideways scroll`,
        state.layout === size.layout && nav && back && homeActive && state.bg === background[theme] && lower === !phone && !(await scrolls(p)),
        { ...state, nav, back, homeActive, lower },
      );
      check(`${where}: the map's land is not the light paper in dark`, theme === 'light' || state.land !== 'rgb(242, 236, 224)', state.land);
      await shot(p, `places-${size.width}-${theme}`);
      const first = p.locator('.place-row').first();
      const name = await first.locator('.row-title').textContent();
      await first.click();
      await p.waitForURL(/place=/);
      await settle(p);
      const pane = await p.locator('.place-pane h2').textContent();
      check(`${where}: a picked row swaps the list for its place`, pane === name, { pane, name });
      await shot(p, `places-${size.width}-${theme}-pane`);
      if (!phone) {
        await p.locator('section[aria-label="Day by day"]').scrollIntoViewIfNeeded();
        await shot(p, `places-${size.width}-${theme}-below`);
      }
      await p.keyboard.press('Escape');
      await p.waitForURL((url) => !url.search.includes('place=')).catch(() => {});
      check(`${where}: Esc goes back to all places`, !p.url().includes('place='), p.url());
      await ctx.close();
    }
  }
  await pair('places-1440', 'r2/W2-Places.png', join(t.out, 'places-1440-light.png'));
  await pair('places-1440-pane', 'r2/W2-Places.png', join(t.out, 'places-1440-light-pane.png'));

  // ---------- numbers, keys, hover, zoom, filters ----------
  const ctx = await pinned({ viewport: { width: 1440, height: 900 }, storageState: storage });
  const p = await ctx.newPage();
  await open(p, '/home/places');
  await ready(p);
  const summary = async () => ({
    total: ringgit(await p.getByTestId('places-total').textContent()),
    of: await p.locator('.side-hero-of').textContent(),
    rows: await p.locator('.place-row').count(),
    first: ringgit(await p.locator('.place-row .place-amount .num').first().textContent()),
    rowSum: (await p.locator('.place-row .place-amount .num').allTextContents()).reduce((sum, text) => sum + Math.round(ringgit(text) * 100), 0),
  });
  const s30 = await summary();
  check(
    `Last 30 days: spent at places is the located expenses' total (${cents(month.totalMinor)}) at ${month.places} places, largest first, and the rows add up`,
    Math.round(s30.total * 100) === month.totalMinor && s30.of === `at ${month.places} places` && s30.rows === month.places && Math.round(s30.first * 100) === month.topMinor && s30.rowSum === month.totalMinor,
    { s30, month: { ...month, looseIds: undefined } },
  );
  const looseShown = await p.locator('.without-row').count();
  const looseTotal = ringgit(await p.locator('.without-total').textContent());
  check(
    `Without a place lists the ${month.loose} expenses in range with no location, ${cents(month.looseMinor)}`,
    looseShown === month.loose && Math.round(looseTotal * 100) === month.looseMinor,
    { looseShown, looseTotal },
  );
  const footer = await p.locator('.no-place-foot .row-title').textContent();
  check('the list ends with a link down to them', footer === `${month.loose} expenses without a place`, footer);
  const dayCols = await p.locator('.day-axis .day-col').count();
  const weekends = await p.locator('.day-axis .day-col[data-weekend]').count();
  check('Day by day has a column a day for 30 days, weekends shaded, and a row a place', dayCols === 30 && weekends >= 8 && weekends <= 10 && (await p.locator('.day-row').count()) === month.places, { dayCols, weekends });

  await p.locator('.pseg[aria-label="Range"] button', { hasText: 'Last 7 days' }).click();
  await p.waitForURL(/range=7d/);
  const s7 = await summary();
  check(`Last 7 days counts only that week: ${cents(week.totalMinor)} at ${week.places}`, Math.round(s7.total * 100) === week.totalMinor && s7.rows === week.places && (await p.locator('.day-axis .day-col').count()) === 7, s7);
  await p.locator('.pseg[aria-label="Range"] button', { hasText: 'All time' }).click();
  await p.waitForURL(/range=all/);
  const sAll = await summary();
  check(`All time counts every located expense: ${cents(ever.totalMinor)}`, Math.round(sAll.total * 100) === ever.totalMinor && sAll.rows === ever.places, sAll);
  await p.locator('.pseg[aria-label="Range"] button', { hasText: 'Last 30 days' }).click();
  await p.waitForURL((url) => !url.search.includes('range='));

  const firstId = await p.locator('.place-row').first().getAttribute('data-place');
  await p.locator('.place-row').first().hover();
  const hot = await p.locator(`.map-pin-big[data-shown][data-place="${firstId}"]`).getAttribute('data-hot').catch(() => null);
  const lit = await p.locator(`.day-row[data-place="${firstId}"]`).getAttribute('aria-current');
  check('pointing at a row lights its pin and its Day by day row', hot !== null && lit === 'true', { hot, lit });
  const secondId = await p.locator('.place-row').nth(1).getAttribute('data-place');
  await p.locator('.day-row').nth(1).hover();
  const rowLit = await p.locator(`.place-row[data-place="${secondId}"]`).getAttribute('aria-current');
  check('pointing at a Day by day row lights its row in the list', rowLit === 'true', rowLit);
  await p.mouse.move(5, 5);

  const order = await p.locator('.place-row').evaluateAll((els) => els.map((el) => el.dataset.place));
  await p.keyboard.press('j');
  await p.waitForURL(new RegExp(`place=${encodeURIComponent(order[0])}`)).catch(() => {});
  check('J opens the first place', new URL(p.url()).searchParams.get('place') === order[0], p.url());
  await p.keyboard.press('j');
  await p.waitForURL((url) => url.searchParams.get('place') === order[1]).catch(() => {});
  check('J moves to the next place', new URL(p.url()).searchParams.get('place') === order[1], p.url());
  check('the pane counts where it is', (await p.locator('.pane-index').textContent()) === `2 of ${order.length}`);
  const onPin = await p.locator(`.map-pin-big[data-on]`).getAttribute('data-place');
  check("the open place's pin turns Ink", onPin === order[1], onPin);
  await settle(p);
  const visits = await p.locator('.visit-col').count();
  const bars = await p.locator('.visit-bar').evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height > 0).length);
  check('its visits by day draw a bar on each day it was paid', visits === 30 && bars > 0, { visits, bars });
  await p.keyboard.press('k');
  await p.waitForURL((url) => url.searchParams.get('place') === order[0]).catch(() => {});
  check('K moves back', new URL(p.url()).searchParams.get('place') === order[0], p.url());
  const maps = await p.getByRole('link', { name: 'Open in Google Maps' }).getAttribute('href');
  check('Open in Google Maps points at the place', /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=-?\d/.test(maps ?? ''), maps);
  await p.keyboard.press('Escape');
  await p.waitForURL((url) => !url.search.includes('place='));

  await p.keyboard.press('h');
  await p.waitForURL(/view=heat/);
  await settle(p);
  const blobs = await p.locator('.heat-blob[data-on]').count();
  const pinsInHeat = await p.locator('.map-pin-big[data-shown]').count();
  check('H shows the heat, a blob a place, and hides the pins', blobs === month.places && pinsInHeat === 0, { blobs, pinsInHeat });
  await shot(p, 'places-1440-light-heat');
  await p.keyboard.press('h');
  await p.waitForURL((url) => !url.search.includes('view='));

  const shownAt = () => p.locator('.map-pin-big[data-shown]').count();
  const scale = () => p.locator('.map-art-pan').evaluate((el) => el.style.transform);
  const fitPins = await shownAt();
  const fitCount = await p.locator('.map-pin-big[data-shown] .pin-count').count();
  await p.getByRole('button', { name: 'Zoom in' }).click();
  await p.getByRole('button', { name: 'Zoom in' }).click();
  await p.getByRole('button', { name: 'Zoom in' }).click();
  await settle(p);
  const zoomed = await scale();
  const zoomPins = await shownAt();
  check('+ zooms the art with a transform, and merged pins come apart', /scale\(3\.375\)/.test(zoomed) && zoomPins >= fitPins && (fitCount === 0 || zoomPins > fitPins), { zoomed, fitPins, fitCount, zoomPins });
  await shot(p, 'places-1440-light-zoomed');
  await p.keyboard.press('f');
  await settle(p);
  check('F fits every place again', /scale\(1\)/.test(await scale()) && (await shownAt()) === fitPins, await scale());

  await p.getByRole('radio', { name: 'Visits' }).click();
  await p.waitForURL(/sort=visits/);
  const visitCounts = await p.locator('.place-row .row-meta').evaluateAll((els) => els.map((el) => Number(/(\d+) visits?$/.exec(el.textContent)?.[1])));
  check('Visits sorts by visits', visitCounts.every((count, index) => index === 0 || visitCounts[index - 1] >= count), visitCounts);
  await p.getByRole('radio', { name: 'Spent' }).click();

  await p.getByRole('button', { name: /^Category/ }).click();
  const option = p.locator('.map-popover [role="option"]').nth(1);
  const optionAmount = ringgit(await option.locator('.num').textContent());
  await option.click();
  await p.waitForURL(/category=/);
  const filtered = await summary();
  check('a category keeps only its spending, and the total is what its option said', Math.abs(filtered.total - optionAmount) < 0.005 && filtered.total < s30.total, { optionAmount, filtered });
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: /^Category/ }).click();
  await p.locator('.map-popover [role="option"]').first().click();
  await p.waitForURL((url) => !url.search.includes('category='));

  // ---------- Add a place, undone ----------
  const looseRow = p.locator('.without-row').first();
  const looseId = await looseRow.getAttribute('data-transaction');
  await looseRow.scrollIntoViewIfNeeded();
  await looseRow.getByRole('checkbox').click();
  check('ticking an expense shows the bulk bar with Add a place', await p.getByRole('toolbar', { name: 'Selected expenses' }).isVisible());
  await p.keyboard.press('p');
  const dialog = p.getByRole('dialog', { name: 'Choose a place' });
  await dialog.waitFor({ timeout: 5000 }).catch(() => {});
  check('P opens Choose a place', await dialog.isVisible());
  const target = await dialog.locator('[role="option"] .choose-name').first().textContent();
  await dialog.locator('[role="option"]').first().click();
  await shot(p, 'places-1440-light-choose');
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  const toast = p.getByRole('status').filter({ hasText: `1 expense now at ${target}` });
  await toast.waitFor({ timeout: 5000 }).catch(() => {});
  check('Confirm pins it, with a toast that offers Undo', await toast.getByRole('button', { name: 'Undo' }).isVisible().catch(() => false));
  await toast.hover().catch(() => {});
  check('it leaves Without a place', (await p.locator(`.without-row[data-transaction="${looseId}"]`).count()) === 0);
  const wrote = await until('expenses', (list) => list.find((row) => row.id === looseId)?.location_latitude !== null);
  check(`the dev project holds its new place (${target})`, wrote.ok, wrote.rows.find((row) => row.id === looseId));
  await p.keyboard.press('Control+z');
  const undone = await until('expenses', (list) => list.find((row) => row.id === looseId)?.location_latitude === null);
  check('Ctrl Z takes the place off again, on screen and in the dev project', undone.ok && (await p.locator(`.without-row[data-transaction="${looseId}"]`).count()) === 1, undone.rows.find((row) => row.id === looseId));
  await ctx.close();

  // ---------- the 700 crossing keeps the place ----------
  const cross = await pinned({ viewport: { width: 1024, height: 768 }, storageState: storage });
  const c = await cross.newPage();
  await open(c, '/home/places');
  await ready(c);
  await c.locator('.place-row').nth(1).click();
  await c.waitForURL(/place=/);
  const kept = new URL(c.url()).searchParams.get('place');
  const keptName = await c.locator('.place-pane h2').textContent();
  await c.setViewportSize({ width: 390, height: 844 });
  await c.waitForFunction(() => document.documentElement.dataset.layout === 'phone');
  await settle(c);
  check('crossing 700 keeps the open place, in the URL and on screen', new URL(c.url()).searchParams.get('place') === kept && (await c.locator('.place-pane h2').textContent()) === keptName, c.url());
  await shot(c, 'places-390-after-resize');
  await c.setViewportSize({ width: 1024, height: 768 });
  await c.waitForFunction(() => document.documentElement.dataset.layout === 'rail');
  check('and back across 700 it is still open', (await c.locator('.place-pane h2').textContent()) === keptName);
  await cross.close();

  // ---------- Home links here ----------
  const home = await pinned({ viewport: { width: 1440, height: 900 }, storageState: storage });
  const h = await home.newPage();
  await open(h, '/home');
  await h.getByRole('link', { name: 'Open map' }).click();
  await h.waitForURL(/\/home\/places/);
  check("Home's Where you spend card opens the map", new URL(h.url()).pathname === '/home/places', h.url());
  await home.close();

  // ---------- reduced motion ----------
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const mctx = await pinned({ viewport: { width: 1440, height: 900 }, storageState: storage, reducedMotion });
    const m = await mctx.newPage();
    await open(m, '/home/places');
    await ready(m);
    await m.locator('.place-row').first().click();
    const names = await m.locator('.place-pane').evaluate((el) => getComputedStyle(el).animationName);
    const expected = reducedMotion === 'reduce' ? 'fade-in' : 'slide-in-right';
    check(`the place pane ${reducedMotion === 'reduce' ? 'fades under reduced motion' : 'slides in'}`, names.split(',')[0].trim() === expected, names);
    await mctx.close();
  }
}
