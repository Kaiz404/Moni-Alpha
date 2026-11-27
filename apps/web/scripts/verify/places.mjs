// Where you spend in web-verify (`--only places`): every layout in both themes with a place open in the
// side card, the numbers against the e2e user's expenses, the keys, hover linking a row and its pin, zoom
// and Fit, a mouse drag, the wheel, a double click and touch (one finger scrolls, two pinch), ‹ All places
// keeping the list's scroll and Back, Pins | Heat, the filters, Add a place undone with Ctrl Z, the 700
// crossing keeping the place, reduced motion on the swap, and Home's tile covered edge to edge at 1000,
// 1440 and 2400 wide. The one write is undone before the part ends.
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
  /** The open place's By day chart: bars drawn, bars under 2 px wide, the top amount inside the card, and labels that overlap. */
  function visitChart() {
    return p.locator('.side-detail .place-pane').evaluate((pane) => {
      const card = pane.getBoundingClientRect();
      const drawn = [...pane.querySelectorAll('.visit-bar')].map((el) => el.getBoundingClientRect()).filter((box) => box.height > 0);
      const top = pane.querySelector('.visit-top')?.getBoundingClientRect();
      const ticks = [...pane.querySelectorAll('.visit-tick')].filter((el) => el.textContent).map((el) => ({ text: el.textContent, box: el.getBoundingClientRect() }));
      const overlaps = ticks.slice(1).filter((tick, index) => tick.box.left < ticks[index].box.right + 2).map((tick, index) => `${ticks[index].text}|${tick.text}`);
      return {
        bars: drawn.length,
        thin: drawn.filter((box) => box.width < 2).length,
        topInside: !top || (top.left >= card.left && top.right <= card.right),
        overlaps,
      };
    });
  }

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
      const mapActive = phone || (await p.locator(`${navFor[size.layout]} [aria-current="page"]`).first().getAttribute('href'))?.startsWith('/home/places');
      const lower = await p.locator('section[aria-label="Day by day"]').isVisible();
      check(
        `${where}: ${size.layout}, ${phone ? 'a pushed page with Back and no tab bar' : 'Home ›, Map lit in the nav'}, ${theme} ground, ${phone ? 'no Day by day' : 'Day by day below'}, no sideways scroll`,
        state.layout === size.layout && nav && back && mapActive && state.bg === background[theme] && lower === !phone && !(await scrolls(p)),
        { ...state, nav, back, mapActive, lower },
      );
      check(`${where}: the map's land is not the light paper in dark`, theme === 'light' || state.land !== 'rgb(242, 236, 224)', state.land);
      const band = await p.evaluate(() => {
        const map = document.querySelector('.places-map').getBoundingClientRect();
        const below = document.querySelector('section[aria-label="Day by day"]')?.getBoundingClientRect();
        return { width: Math.round(map.width), height: Math.round(map.height), belowTop: below ? Math.round(below.top) : null, view: innerHeight };
      });
      if (size.layout === 'sidebar' || size.layout === 'rail') {
        check(`${where}: the map is a wide band (${band.width}x${band.height}), and Day by day starts on the first screen, so the page plainly goes on`, band.width > band.height * 1.2 && band.belowTop !== null && band.belowTop < band.view, band);
      }
      await shot(p, `places-${size.width}-${theme}`);
      const first = p.locator('.place-row').first();
      const name = await first.locator('.row-title').textContent();
      await first.click();
      await p.waitForURL(/place=/);
      await settle(p);
      await p.waitForTimeout(500);
      const pane = await p.locator('.places-side .side-detail .place-pane h2').textContent();
      const opened = {
        back: await p.getByRole('button', { name: 'Back to all places (Esc)' }).isVisible(),
        sidePanel: await p.locator('aside.side-panel').count(),
        mapShown: await p.locator('.places-map').isVisible(),
        list: await p.locator('.places-side .side-places').evaluate((el) => getComputedStyle(el).visibility),
      };
      check(`${where}: a picked row swaps the side card for its place with ‹ All places, no side panel, the map still showing`, pane === name && opened.back && opened.sidePanel === 0 && opened.mapShown && opened.list === 'hidden', { pane, name, ...opened });
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
  const art = await p.locator('.places-map svg.map-art-layer').count();
  const google = await p.locator('.map-ground[data-google]').count();
  const unavailable = await p.locator('.map-ground[data-unavailable]').getByText('Map unavailable').isVisible();
  check('the map is a Google map, or reads Map unavailable with no key; never drawn art', art === 0 && (google === 1 || unavailable), { art, google, unavailable });
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
  await p.locator('.place-row').first().click();
  await p.locator('.side-detail .place-pane h2').waitFor();
  await settle(p);
  const allTimeChart = await visitChart();
  check(
    'over All time a place\'s By day shows a bar you can see for each paid day or week, its top amount inside the card and no two labels touching',
    allTimeChart.bars > 0 && allTimeChart.thin === 0 && allTimeChart.topInside && allTimeChart.overlaps.length === 0,
    allTimeChart,
  );
  await p.keyboard.press('Escape');
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
  check('the side card counts where it is', (await p.locator('.side-steps .meta').textContent()) === `2 of ${order.length}`);
  check(
    'K sits on the up chevron and J on the down chevron, and the list has no loose J K',
    (await p.getByRole('button', { name: 'Previous place (K)' }).locator('.kbd').textContent()) === 'K' &&
      (await p.getByRole('button', { name: 'Next place (J)' }).locator('.kbd').textContent()) === 'J' &&
      (await p.locator('.side-list-head .kbd').count()) === 0,
  );
  const onPin = await p.locator(`.map-pin-big[data-on]`).getAttribute('data-place');
  check("the open place's pin turns Ink", onPin === order[1], onPin);
  await settle(p);
  const visits = await p.locator('.visit-col').count();
  const bars = await p.locator('.visit-bar').evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height > 0).length);
  check('its visits by day draw a bar on each day it was paid', visits === 30 && bars > 0, { visits, bars });
  const monthChart = await visitChart();
  check('its top amount sits inside the card and no two day labels touch', monthChart.topInside && monthChart.overlaps.length === 0, monthChart);
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
  const scale = () => p.locator('.places-map').getAttribute('data-zoom');
  // A picked place may have zoomed the map to part its pin; the map stays there after Esc, as Google's does.
  await p.keyboard.press('f');
  await p.waitForTimeout(700);
  const fitPins = await shownAt();
  const fitCount = await p.locator('.map-pin-big[data-shown] .pin-count').count();
  await p.getByRole('button', { name: 'Zoom in' }).click();
  await p.getByRole('button', { name: 'Zoom in' }).click();
  await p.getByRole('button', { name: 'Zoom in' }).click();
  await p.waitForTimeout(700);
  const zoomed = await scale();
  const zoomPins = await shownAt();
  check('+ zooms the map, and merged pins come apart', zoomed === '3.375' && zoomPins >= fitPins && (fitCount === 0 || zoomPins > fitPins), { zoomed, fitPins, fitCount, zoomPins });
  await shot(p, 'places-1440-light-zoomed');
  await p.keyboard.press('f');
  await p.waitForTimeout(700);
  await p.waitForFunction((count) => document.querySelectorAll('.map-pin-big[data-shown]').length === count, fitPins, { timeout: 3_000 }).catch(() => {});
  check('F fits every place again', (await scale()) === '1' && (await shownAt()) === fitPins, await scale());

  // ---------- the map moves like Google's: drag, wheel, double click, and the page still scrolls ----------
  const mapBox = await p.locator('.places-map').boundingBox();
  const blank = { x: mapBox.x + 40, y: mapBox.y + mapBox.height / 2 };
  const pinAt = async (id) => {
    const r = await p.locator(`.map-pin-big[data-place="${id}"]`).boundingBox();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  const leadId = await p.locator('.map-pin-big[data-shown]').first().getAttribute('data-place');
  const before = await pinAt(leadId);
  await p.mouse.move(blank.x, blank.y);
  await p.mouse.down();
  await p.mouse.move(blank.x + 60, blank.y + 30, { steps: 4 });
  await p.mouse.move(blank.x + 120, blank.y + 60, { steps: 4 });
  await p.waitForTimeout(150);
  await p.mouse.up();
  await p.waitForTimeout(100);
  const dragged = await pinAt(leadId);
  const moved = { x: Math.round(dragged.x - before.x), y: Math.round(dragged.y - before.y) };
  check('a mouse drag pans the map at Fit, pins and ground together, and opens nothing', Math.abs(moved.x - 120) <= 2 && Math.abs(moved.y - 60) <= 2 && (await scale()) === '1' && !p.url().includes('place='), moved);
  await shot(p, 'places-1440-light-dragged');

  const under = await pinAt(leadId);
  await p.mouse.move(under.x, under.y);
  await p.mouse.wheel(0, -100);
  await p.waitForTimeout(700);
  const wheeled = await scale();
  const stayed = await pinAt(leadId);
  check('a wheel notch over the map zooms half a level about the pointer, the pin under it staying put', Math.abs(Number(wheeled) - Math.SQRT2) < 0.001 && Math.abs(stayed.x - under.x) <= 3 && Math.abs(stayed.y - under.y) <= 3, { wheeled, under, stayed });
  // Three quick notches in, sampled as they glide: the zoom only ever grows towards where it is going.
  const glide = await p.evaluate(async () => {
    const el = document.querySelector('.places-map');
    const seen = [];
    const end = performance.now() + 600;
    const target = { x: el.getBoundingClientRect().left + 200, y: el.getBoundingClientRect().top + 200 };
    for (let n = 0; n < 3; n += 1) {
      el.dispatchEvent(new globalThis.WheelEvent('wheel', { deltaY: -100, clientX: target.x, clientY: target.y, bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 40));
    }
    while (performance.now() < end) {
      seen.push(Number(el.getAttribute('data-shown-zoom')));
      await new Promise((r) => requestAnimationFrame(r));
    }
    return { seen, goal: Number(el.getAttribute('data-zoom')) };
  });
  const steady = glide.seen.every((z, i) => i === 0 || z >= glide.seen[i - 1] - 1e-9) && glide.seen.every((z) => z <= glide.goal + 1e-9);
  check('quick wheel notches glide in one smooth climb that never overshoots or wobbles', steady, { goal: glide.goal, first: glide.seen.slice(0, 4), last: glide.seen.slice(-2) });
  for (let i = 0; i < 3; i += 1) await p.mouse.wheel(0, 100);
  await p.waitForTimeout(700);
  for (let i = 0; i < 10; i += 1) await p.mouse.wheel(0, 8);
  await p.waitForTimeout(100);
  const pinched = Number(await scale());
  check('a trackpad\'s small wheel deltas zoom smoothly back out', pinched < 2 && pinched > 1, pinched);
  // A fast spin both ways starts a glide on every notch; none may hand Google a camera that isn't a number.
  const spinErrors = [];
  p.on('pageerror', (error) => spinErrors.push(String(error.stack || error).slice(0, 600)));
  p.on('console', (m) => m.type() === 'error' && spinErrors.push(m.text().slice(0, 600)));
  for (let i = 0; i < 24; i += 1) await p.mouse.wheel(0, i % 6 < 3 ? -100 : 100);
  await p.waitForTimeout(900);
  const spun = Number(await scale());
  const crashed = await p.evaluate(() => /Something went wrong on our side/.test(document.body.innerText));
  check('a fast spin of the wheel both ways keeps the map up, at a real zoom', !crashed && Number.isFinite(spun) && spun > 0, { spun, crashed, spinErrors });
  await p.mouse.move(blank.x, blank.y);
  await p.mouse.dblclick(blank.x, blank.y);
  await p.waitForTimeout(700);
  check('a double click zooms in about where it was clicked', Math.abs(Number(await scale()) - pinched * 2) < 0.01, await scale());
  await shot(p, 'places-1440-light-wheel');
  await p.keyboard.press('f');
  await p.waitForTimeout(700);

  const day = p.locator('section[aria-label="Day by day"]');
  const dayBox = await day.boundingBox();
  const scrollBefore = await p.evaluate(() => document.documentElement.scrollTop);
  await p.mouse.move(dayBox.x + dayBox.width / 2, Math.min(dayBox.y + 40, 880));
  await p.mouse.wheel(0, 300);
  await p.waitForFunction((y) => document.documentElement.scrollTop > y, scrollBefore, { timeout: 2_000 }).catch(() => {});
  check('the wheel off the map scrolls the page, and the map keeps its zoom', (await p.evaluate(() => document.documentElement.scrollTop)) > scrollBefore && (await scale()) === '1', { scrollBefore, after: await p.evaluate(() => document.documentElement.scrollTop) });
  await p.evaluate(() => document.documentElement.scrollTo(0, 0));

  // ---------- a place opens in the side card, and back keeps the list where it was ----------
  await p.locator('.place-rows').evaluate((el) => (el.scrollTop = el.scrollHeight));
  const listScroll = await p.locator('.place-rows').evaluate((el) => el.scrollTop);
  const pinId = await p.locator('.map-pin-big[data-shown]').first().getAttribute('data-place');
  await p.locator(`.map-pin-big[data-place="${pinId}"]`).click();
  await p.waitForURL((url) => url.searchParams.has('place'));
  await p.waitForTimeout(600);
  const pinOn = await p.locator('.map-pin-big[data-on]').getAttribute('data-place');
  check('a pin opens its place in the side card and turns Ink', (await p.locator('.side-detail .place-pane h2').isVisible()) && pinOn === new URL(p.url()).searchParams.get('place'), { pinOn, url: p.url() });
  const stillPin = await pinAt(pinOn);
  await p.mouse.move(blank.x, blank.y);
  await p.mouse.down();
  await p.mouse.move(blank.x + 80, blank.y, { steps: 6 });
  await p.waitForTimeout(150);
  await p.mouse.up();
  await p.waitForTimeout(100);
  const afterPin = await pinAt(pinOn);
  check('with a place open the map still drags, and the place stays open', Math.abs(afterPin.x - stillPin.x - 80) <= 2 && (await p.locator('.side-detail .place-pane h2').isVisible()) && p.url().includes('place='), { stillPin, afterPin });
  await shot(p, 'places-1440-light-place-dragged');
  await p.getByRole('button', { name: 'Back to all places (Esc)' }).click();
  await p.waitForURL((url) => !url.searchParams.has('place'));
  await p.waitForTimeout(500);
  const keptScroll = await p.locator('.place-rows').evaluate((el) => el.scrollTop);
  check('‹ All places goes back to the list, scrolled where it was', (await p.locator('.place-row').first().isVisible()) && keptScroll === listScroll && listScroll > 0, { listScroll, keptScroll });
  await p.locator('.place-row').nth(2).click();
  await p.waitForURL((url) => url.searchParams.has('place'));
  await p.goBack();
  await p.waitForURL((url) => !url.searchParams.has('place')).catch(() => {});
  check("the browser's Back closes the place too, and stays on Where you spend", new URL(p.url()).pathname === '/home/places' && !p.url().includes('place='), p.url());
  await p.keyboard.press('f');

  await p.getByRole('radio', { name: 'Visits' }).click();
  await p.waitForURL(/sort=visits/);
  const visitCounts = await p.locator('.place-row .row-meta').evaluateAll((els) => els.map((el) => Number(/^(\d+) visits? for /.exec(el.textContent)?.[1])));
  check('Visits sorts by visits', visitCounts.length > 0 && visitCounts.every((count, index) => Number.isInteger(count) && (index === 0 || visitCounts[index - 1] >= count)), visitCounts);
  await p.getByRole('radio', { name: 'Spent' }).click();

  await p.getByRole('combobox', { name: /^Category/ }).click();
  const option = p.locator('.map-popover [role="option"]').nth(1);
  const optionAmount = ringgit(await option.locator('.num').textContent());
  await option.click();
  await p.waitForURL(/category=/);
  const filtered = await summary();
  check('a category keeps only its spending, and the total is what its option said', Math.abs(filtered.total - optionAmount) < 0.005 && filtered.total < s30.total, { optionAmount, filtered });
  await p.keyboard.press('Escape');
  await p.getByRole('combobox', { name: /^Category/ }).click();
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

  // ---------- touch: one finger scrolls the page, two move the map ----------
  const touch = await pinned({ viewport: { width: 390, height: 844 }, storageState: storage, hasTouch: true, isMobile: true });
  const tp = await touch.newPage();
  await open(tp, '/home/places');
  await ready(tp);
  const cdp = await touch.newCDPSession(tp);
  const tmap = await tp.locator('.places-map').boundingBox();
  const mid = { x: tmap.x + tmap.width / 2, y: tmap.y + tmap.height / 2 };
  const fingers = async (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  const zoomBefore = await tp.locator('.places-map').getAttribute('data-zoom');
  await fingers('touchStart', [[mid.x, mid.y + 60]]);
  for (let i = 1; i <= 6; i += 1) await fingers('touchMove', [[mid.x, mid.y + 60 - i * 20]]);
  const hintShown = await tp.locator('.map-hint[data-on]').count();
  await fingers('touchEnd', []);
  await tp.waitForTimeout(1200);
  const oneFinger = { scrollY: await tp.evaluate(() => document.documentElement.scrollTop), zoom: await tp.locator('.places-map').getAttribute('data-zoom'), hintShown };
  check('at 390 one finger on the map scrolls the page, says to use two fingers, and leaves the map', oneFinger.scrollY > 0 && oneFinger.zoom === zoomBefore && hintShown === 1, oneFinger);
  await tp.evaluate(() => document.documentElement.scrollTo(0, 0));
  await tp.waitForTimeout(300);
  const tmap2 = await tp.locator('.places-map').boundingBox();
  const spot = { x: tmap2.x + tmap2.width / 2, y: tmap2.y + tmap2.height / 2 };
  await fingers('touchStart', [[spot.x - 30, spot.y], [spot.x + 30, spot.y]]);
  for (let i = 1; i <= 6; i += 1) await fingers('touchMove', [[spot.x - 30 - i * 10, spot.y], [spot.x + 30 + i * 10, spot.y]]);
  await fingers('touchEnd', []);
  await tp.waitForTimeout(200);
  const twoFingers = { zoom: Number(await tp.locator('.places-map').getAttribute('data-zoom')), scrollY: await tp.evaluate(() => document.documentElement.scrollTop) };
  check('two fingers pinch the map open (60 px apart to 180) and the page stays still', Math.abs(twoFingers.zoom - 3) < 0.05 && twoFingers.scrollY === 0, twoFingers);
  await tp.locator('.place-row').nth(1).click();
  await tp.waitForURL(/place=/);
  await tp.waitForTimeout(600);
  const stacked = await tp.evaluate(() => {
    const map = document.querySelector('.places-map').getBoundingClientRect();
    const card = document.querySelector('.places-side').getBoundingClientRect();
    return { below: card.top >= map.bottom, cardTop: Math.round(card.top), view: innerHeight };
  });
  check('at 390 the place stacks below the map in the card, its top in view', stacked.below && stacked.cardTop >= 0 && stacked.cardTop < stacked.view && (await tp.getByRole('button', { name: 'Back to all places (Esc)' }).isVisible()), stacked);
  await shot(tp, 'places-390-touch-place');
  await touch.close();

  // ---------- Home links here ----------
  const home = await pinned({ viewport: { width: 1440, height: 900 }, storageState: storage });
  const h = await home.newPage();
  await open(h, '/home');
  const tile = h.locator('section[aria-label="Where you spend"] .mini-map');
  await tile.waitFor({ timeout: 20_000 });
  const tileState = {
    pins: await tile.locator('.map-pin').count(),
    image: await tile.locator('img.mini-map-image').count(),
    unavailable: await tile.getByText('Map unavailable').isVisible(),
    art: await h.locator('section[aria-label="Where you spend"] .map-art').count(),
  };
  check("Home's Where you spend tile is a Google static map, or Map unavailable with no key, with the month's top places pinned", tileState.pins > 0 && tileState.pins <= 3 && tileState.art === 0 && (tileState.image === 1 || tileState.unavailable), tileState);
  for (const width of [1000, 1440, 2400]) {
    await h.setViewportSize({ width, height: 900 });
    await h.waitForFunction(() => {
      const box = document.querySelector('section[aria-label="Where you spend"] .mini-map')?.getBoundingClientRect();
      const img = document.querySelector('.mini-map-image')?.getBoundingClientRect();
      return !img || (box && img.width >= box.width - 0.5);
    }, null, { timeout: 5_000 }).catch(() => {});
    const cover = await tile.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const img = el.querySelector('.mini-map-image')?.getBoundingClientRect();
      const pins = [...el.querySelectorAll('.map-pin')].map((pin) => pin.getBoundingClientRect());
      return {
        tile: Math.round(box.width),
        covered: !img || (img.left <= box.left + 0.5 && img.right >= box.right - 0.5 && img.top <= box.top + 0.5 && img.bottom >= box.bottom - 0.5),
        pinsInside: pins.every((pin) => pin.left + pin.width / 2 >= box.left && pin.left + pin.width / 2 <= box.right && pin.top + pin.height / 2 >= box.top && pin.top + pin.height / 2 <= box.bottom),
      };
    });
    check(`at ${width} wide the ${cover.tile} px Where you spend map covers its tile edge to edge with every pin inside`, cover.covered && cover.pinsInside, cover);
  }
  await h.setViewportSize({ width: 1440, height: 900 });
  await h.getByRole('link', { name: 'Open map', exact: true }).click();
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
    await m.waitForURL(/place=/);
    await m.waitForTimeout(600);
    const motion = await m.locator('.places-side .side-places').evaluate((el) => ({ transform: getComputedStyle(el).transform, opacity: getComputedStyle(el).opacity }));
    const slid = motion.transform !== 'none';
    check(`the place ${reducedMotion === 'reduce' ? 'only fades over the list under reduced motion' : 'slides over the list in the card'}`, motion.opacity === '0' && slid === (reducedMotion !== 'reduce'), motion);
    await mctx.close();
  }
}
