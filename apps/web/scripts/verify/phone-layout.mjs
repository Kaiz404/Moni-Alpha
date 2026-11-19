// The phone layout (under 700 wide or under 500 tall) on every signed-in screen, upright and held
// sideways, in both themes. Read only: it opens rows and panes through the URL and never writes.
//   verifyPhoneLayout({ browser, base, storage, check, shot, settle, background, seed })
// `background` maps 'light' and 'dark' to the ground's computed colour; `shot(page, name)` saves a screenshot;
// `seed` is readSeed's result, whose clock (3 pm on the seed's day) every page is pinned to.

export const PHONE_SIZES = [
  { width: 390, height: 844 },
  { width: 800, height: 450 },
  { width: 667, height: 375 },
];

const GREETING = /^(Morning|Afternoon|Evening|Welcome to Moni), /;
const LAYER = '.side-pane[data-open], .pane';

/**
 * Each screen: where it is (`path`, or `open` resolving it from the rows on screen), whether it is a
 * tab root (the tab bar shows) and where its title is. A pushed page or pane names its title's selector.
 */
const SCREENS = [
  { name: 'home', path: '/home', root: true, title: GREETING, loaded: '.home[data-loaded]' },
  { name: 'activity', path: '/activity', root: true, title: /^Activity$/, loaded: '.activity[data-loaded]' },
  {
    name: 'activity-detail',
    from: { path: '/activity', loaded: '.activity[data-loaded]', id: '.activity-days [data-row-id]', attr: 'data-row-id' },
    to: (id) => `/activity/${id}`,
    title: /^Transaction$/,
    titleAt: '.side-pane[data-open] .pane-top-title',
  },
  { name: 'budget', path: '/budget', root: true, title: /^Budget$/ },
  {
    name: 'budget-category',
    from: { path: '/budget', id: '[data-category]', attr: 'data-category' },
    to: (id) => `/budget?category=${id}`,
    title: /\S/,
    titleAt: '.side-pane[data-open] .detail-name',
  },
  { name: 'debts', path: '/debts', root: true, title: /^Debts$/ },
  {
    name: 'debts-person',
    from: { path: '/debts', id: '[data-debt]', attr: 'data-debt' },
    to: (id) => `/debts?person=${id}`,
    title: /\S/,
    titleAt: '.side-pane[data-open] .detail-name',
  },
  { name: 'places', path: '/home/places', title: /^Where you spend$/ },
  { name: 'review', path: '/review', title: /^Review$/ },
  { name: 'settings', path: '/settings', title: /^Settings$/ },
  { name: 'settings-profile', path: '/settings/profile', title: /^Profile$/ },
  { name: 'settings-ai', path: '/settings/ai', title: /^Moni's AI$/, loaded: 'section[aria-labelledby="ai-title"]:not([aria-busy])' },
  { name: 'settings-merchants', path: '/settings/merchants', title: /^Merchant names$/, loaded: '.set-card[data-loaded]' },
  { name: 'settings-import', path: '/settings/import', title: /^Import and export$/ },
  { name: 'chat', path: '/home?pane=chat', title: /^Moni chat/, titleAt: '.pane-chat .pane-title' },
  { name: 'add', path: '/home?pane=add', title: /^Add a transaction$/, titleAt: '.pane-add .pane-title' },
];

/** What a user sees of the screen, measured in the page: the layer on top, its title and its last content. */
function measure({ titleAt, layerSelector }) {
  const visible = (el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
  };
  const tabbar = document.querySelector('nav.tabbar');
  const tabTop = tabbar && visible(tabbar) ? tabbar.getBoundingClientRect().top : null;
  const layer = [...document.querySelectorAll(layerSelector)].find(visible) ?? null;
  const root = layer ?? document.querySelector('.shell-main');

  const title = titleAt
    ? [...document.querySelectorAll(titleAt)].find(visible)
    : [...document.querySelectorAll('h1')].find(visible);
  let titleSeen = false;
  if (title) {
    const box = title.getBoundingClientRect();
    const x = box.left + Math.min(box.width / 2, 12);
    const y = box.top + box.height / 2;
    const hit = document.elementFromPoint(x, y);
    titleSeen = box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && Boolean(hit && (title === hit || title.contains(hit)));
  }

  const scrollers = [document.scrollingElement, ...root.querySelectorAll('*'), root].filter((el) => {
    if (!el || (el !== document.scrollingElement && !visible(el))) return false;
    const style = getComputedStyle(el);
    return el === document.scrollingElement || (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1);
  });
  const sideways = [document.scrollingElement, ...scrollers]
    .filter((el) => el.scrollWidth > el.clientWidth + 1 && (el === document.scrollingElement || /(auto|scroll)/.test(getComputedStyle(el).overflowX)))
    .map((el) => el.className || el.tagName);

  return {
    layout: document.documentElement.dataset.layout,
    ground: getComputedStyle(document.body).backgroundColor,
    tabbar: tabTop !== null,
    tabTop,
    title: title?.textContent?.trim() ?? null,
    titleSeen,
    sideways,
    scrollers: scrollers.length,
  };
}

/** Scrolls every scroller on the screen to its end, then finds the lowest content a user could reach. */
function lastContent({ layerSelector }) {
  const visible = (el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
  };
  const tabbar = document.querySelector('nav.tabbar');
  const floor = tabbar && visible(tabbar) ? tabbar.getBoundingClientRect().top : innerHeight;
  const layer = [...document.querySelectorAll(layerSelector)].find(visible) ?? null;
  const root = layer ?? document.querySelector('.shell-main');
  const clipBottom = (el) => {
    let bottom = el.getBoundingClientRect().bottom;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (getComputedStyle(a).overflowY !== 'visible') bottom = Math.min(bottom, a.getBoundingClientRect().bottom);
    }
    return bottom;
  };
  let lowest = null;
  let lowestBottom = -Infinity;
  for (const el of root.querySelectorAll('*')) {
    if (el.children.length || !visible(el) || el.closest('nav.tabbar, .toast-slot, [aria-hidden="true"]')) continue;
    const bottom = clipBottom(el);
    if (bottom > lowestBottom) {
      lowestBottom = bottom;
      lowest = el;
    }
  }
  if (!lowest) return { floor, bottom: null, what: null, covered: false };
  const box = lowest.getBoundingClientRect();
  const y = Math.min(lowestBottom, box.bottom) - Math.min(4, box.height / 2);
  const hit = document.elementFromPoint(box.left + Math.min(box.width / 2, 8), y);
  return {
    floor,
    bottom: Math.round(lowestBottom),
    what: (lowest.textContent?.trim().slice(0, 40) || lowest.getAttribute('aria-label') || lowest.tagName).replace(/\s+/g, ' '),
    covered: !(hit && (hit === lowest || lowest.contains(hit) || hit.contains(lowest))),
  };
}

/**
 * Controls on top that a finger can't hit across 44 px: each is scrolled into view and probed 21 px either side
 * of its centre, so a hit area drawn wider than the control (a ::before) counts. A field inside a label is
 * hit through its label. A link inside a sentence is sized by its text (WCAG 2.5.8's inline exception).
 * `skip` names parts this check leaves out.
 */
function smallTargets({ skip }) {
  const pick =
    'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=tab], [role=switch], [role=checkbox], [role=option]';
  const found = [];
  for (const el of document.querySelectorAll(pick)) {
    if (el.closest(skip) || el.disabled) continue;
    const target = (el.matches('input, select, textarea') && el.closest('label')) || el;
    const style = getComputedStyle(target);
    let box = target.getBoundingClientRect();
    if (style.visibility === 'hidden' || box.width === 0 || box.height === 0 || (target.matches('a') && style.display === 'inline')) continue;
    if (box.width >= 44 && box.height >= 44) continue;
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    box = target.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const hits = (x, y) => {
      const hit = document.elementFromPoint(x, y);
      return Boolean(hit && (hit === target || target.contains(hit)));
    };
    if (!hits(cx, cy)) continue;
    const tall = box.height >= 44 || (hits(cx, cy - 21) && hits(cx, cy + 21));
    const wide = box.width >= 44 || (hits(cx - 21, cy) && hits(cx + 21, cy));
    if (tall && wide) continue;
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30);
    found.push(`${name} ${Math.round(box.width)}x${Math.round(box.height)}`);
  }
  for (const el of [document.scrollingElement, ...document.querySelectorAll('*')]) if (el.scrollTop) el.scrollTop = 0;
  return [...new Set(found)];
}

/** Left out of the target check: the shell's tab bar and the dev server's indicator. */
const TARGET_SKIP = 'nav.tabbar, nextjs-portal';

async function scrollToEnd(page) {
  await page.evaluate(async () => {
    for (let round = 0; round < 3; round++) {
      for (const el of [document.scrollingElement, ...document.querySelectorAll('*')]) {
        if (el && el.scrollHeight > el.clientHeight + 1) el.scrollTop = el.scrollHeight;
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
  });
}

/** Ids of the first transaction, budget category and debt, read from the rows on screen at 390. */
async function resolveIds(base, screens, ctx) {
  const page = await ctx.newPage();
  const ids = {};
  for (const screen of screens.filter((s) => s.from)) {
    await page.goto(`${base}${screen.from.path}`);
    if (screen.from.loaded) await page.waitForSelector(screen.from.loaded, { timeout: 20_000 }).catch(() => {});
    await page.waitForSelector(screen.from.id, { state: 'attached', timeout: 20_000 }).catch(() => {});
    ids[screen.name] = await page.locator(screen.from.id).first().getAttribute(screen.from.attr).catch(() => null);
  }
  await ctx.close();
  return ids;
}

/** `only`, `sizes` ('390x844') and `themes` narrow the run; each defaults to all of them. */
export async function verifyPhoneLayout({ browser, base, storage, check, shot, settle, background, seed, only, sizes, themes }) {
  const screens = SCREENS.filter((s) => !only || only.includes(s.name));
  const context = async (options) => {
    const ctx = await browser.newContext({ storageState: storage, timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
    return ctx;
  };
  const ids = await resolveIds(base, screens, await context({ viewport: PHONE_SIZES[0] }));
  for (const screen of screens.filter((s) => s.from)) check(`phone layout: ${screen.name} has a row to open`, Boolean(ids[screen.name]));

  for (const theme of ['light', 'dark'].filter((t) => !themes || themes.includes(t))) {
    for (const size of PHONE_SIZES.filter((z) => !sizes || sizes.includes(`${z.width}x${z.height}`))) {
      const ctx = await context({ viewport: size, colorScheme: theme, hasTouch: true });
      const page = await ctx.newPage();
      for (const screen of screens) {
        const path = screen.path ?? (ids[screen.name] ? screen.to(ids[screen.name]) : null);
        if (!path) continue;
        const where = `${screen.name} at ${size.width}x${size.height} ${theme}`;
        await page.goto(`${base}${path}`);
        await page.waitForFunction(() => document.documentElement.dataset.shellReady === 'true', null, { timeout: 20_000 }).catch(() => {});
        if (screen.loaded) await page.waitForSelector(screen.loaded, { timeout: 20_000 }).catch(() => {});
        await page.waitForFunction(() => !document.querySelector('.skeleton'), null, { timeout: 20_000 }).catch(() => {});
        if (screen.titleAt) await page.waitForSelector(screen.titleAt, { timeout: 20_000 }).catch(() => {});
        await settle(page);
        const seen = await page.evaluate(measure, { titleAt: screen.titleAt ?? null, layerSelector: LAYER });
        const tabbar = Boolean(screen.root);
        check(
          `${where}: phone layout, ${theme} ground, ${tabbar ? 'the tab bar' : 'no tab bar'}, the title in view, no sideways scroll`,
          seen.layout === 'phone' &&
            seen.ground === background[theme] &&
            seen.tabbar === tabbar &&
            screen.title.test(seen.title ?? '') &&
            seen.titleSeen &&
            seen.sideways.length === 0,
          seen,
        );
        await shot(page, `phone-${screen.name}-${size.width}x${size.height}-${theme}`);
        const small = await page.evaluate(smallTargets, { skip: TARGET_SKIP });
        check(`${where}: every control takes a 44 px finger`, small.length === 0, small);
        await scrollToEnd(page);
        const end = await page.evaluate(lastContent, { layerSelector: LAYER });
        check(
          `${where}: the last content (${end.what}) scrolls into view above ${tabbar ? 'the tab bar' : 'the screen edge'}, uncovered`,
          end.bottom !== null && end.bottom <= end.floor + 1 && !end.covered,
          end,
        );
        await shot(page, `phone-${screen.name}-${size.width}x${size.height}-${theme}-end`);
      }
      await ctx.close();
    }
  }
}
