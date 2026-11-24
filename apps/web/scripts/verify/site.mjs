// The public site in web-verify (`--only site`): the landing page, the privacy policy and the terms in
// English and Malay, at every width in both themes, signed out; their links reachable without a session;
// the language switch; every [CONFIRM] placeholder still marked; and a signed-in visitor's way into the app.

const LEGAL = [
  { path: '/privacy', title: 'Privacy policy', lang: 'en', draft: 'Draft, not yet reviewed' },
  { path: '/privacy/ms', title: 'Dasar Privasi', lang: 'ms', draft: 'Draf, belum disemak' },
  { path: '/terms', title: 'Terms of service', lang: 'en', draft: 'Draft, not yet reviewed' },
  { path: '/terms/ms', title: 'Terma Perkhidmatan', lang: 'ms', draft: 'Draf, belum disemak' },
];
const HERO = 'Know what’s safe to spend, every day.';

export async function verifySite(t) {
  const { browser, base, storage, check, shot, pair, settle, widths, background } = t;
  const fitsWidth = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  /** The page's own ground (the landing page paints one), else the body's. */
  const ground = (p) =>
    p.evaluate(() => {
      const own = document.querySelector('.lp') && getComputedStyle(document.querySelector('.lp')).backgroundColor;
      return own || getComputedStyle(document.body).backgroundColor;
    });
  const marked = (p) => p.evaluate(() => [...new Set([...document.querySelectorAll('[data-confirm]')].map((m) => m.dataset.confirm))]);

  /** Lets every moment play to its end: the viewport grows to the page's height, so each one is in view. */
  async function fullPage(p, name) {
    const { width, height } = p.viewportSize();
    const tall = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.setViewportSize({ width, height: tall });
    await p.waitForTimeout(6000);
    await settle(p);
    const path = await shot(p, name);
    await p.setViewportSize({ width, height });
    return path;
  }

  for (const theme of ['light', 'dark']) {
    for (const size of widths) {
      const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, colorScheme: theme });
      await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      const p = await ctx.newPage();
      const where = `at ${size.width} ${theme}`;

      const res = await p.goto(`${base}/`);
      const h1 = await p.locator('h1:visible').first().textContent();
      const facts = await marked(p);
      check(
        `the landing page ${where}: signed out it stays on /, its H1, the ${theme} ground, no sideways scroll`,
        res?.status() === 200 && new URL(p.url()).pathname === '/' && h1 === HERO && (await ground(p)) === background[theme] && (await fitsWidth(p)),
        { status: res?.status(), url: p.url(), h1, ground: await ground(p) },
      );
      const shownFacts = await p.evaluate(() =>
        [...document.querySelectorAll('[data-confirm]')].filter((m) => m.getClientRects().length > 0).map((m) => m.dataset.confirm),
      );
      check(`the landing page ${where} shows no [CONFIRM] placeholder while Moni is unreleased`, shownFacts.length === 0, { shownFacts, facts });
      const iphone = await p.evaluate(() => /iPhone|App Store/.test(document.body.innerText));
      check(`the landing page ${where} says nothing about the iPhone or the App Store`, !iphone);
      const landing = await fullPage(p, `site-landing-${size.width}-${theme}`);
      if (theme === 'light' && size.width === 1440) await pair('site-landing-1440', 'land/W2-LandingFinal.png', landing);
      if (theme === 'light' && size.width === 390) {
        await p.evaluate(() => document.documentElement.scrollTo(0, 0));
        await pair('site-landing-390-hero', 'land/W2-LandingFinalPhone.png', await shot(p, 'site-landing-390-light-hero'));
        await p.locator('#privacy').scrollIntoViewIfNeeded();
        await pair('site-landing-390-privacy', 'land/W2-LandingFinalPhone.png', await shot(p, 'site-landing-390-light-privacy'));
      }

      for (const doc of LEGAL) {
        const r = await p.goto(`${base}${doc.path}`);
        const title = await p.locator('h1').first().textContent();
        const lang = await p.locator('article.legal').getAttribute('lang');
        const draft = await p.getByRole('note').first().textContent().catch(() => '');
        check(
          `${doc.path} ${where}: signed out, its title, ${doc.lang}, the draft notice, the ${theme} ground, no sideways scroll`,
          r?.status() === 200 &&
            new URL(p.url()).pathname === doc.path &&
            title === doc.title &&
            lang === doc.lang &&
            (draft ?? '').startsWith(doc.draft) &&
            (await ground(p)) === background[theme] &&
            (await fitsWidth(p)),
          { status: r?.status(), url: p.url(), title, lang, draft, ground: await ground(p), wide: await fitsWidth(p) },
        );
        if (size.width === 1440 || size.width === 390) await shot(p, `site${doc.path.replaceAll('/', '-')}-${size.width}-${theme}`);
      }
      await ctx.close();
    }
  }

  // ---------- the language switch, at 1440 and 390 ----------
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const p = await ctx.newPage();
    for (const kind of ['privacy', 'terms']) {
      await p.goto(`${base}/${kind}`);
      await p.getByRole('navigation', { name: 'Language' }).getByRole('link', { name: 'Bahasa Melayu' }).click();
      await p.waitForURL(`${base}/${kind}/ms`);
      const ms = await p.locator('article.legal').getAttribute('lang');
      const current = await p.getByRole('navigation', { name: 'Bahasa' }).locator('[aria-current="page"]').textContent();
      await p.getByRole('navigation', { name: 'Bahasa' }).getByRole('link', { name: 'English' }).click();
      await p.waitForURL(`${base}/${kind}`);
      const en = await p.locator('article.legal').getAttribute('lang');
      check(`/${kind} at ${width} switches to Malay and back`, ms === 'ms' && current === 'Bahasa Melayu' && en === 'en', { ms, current, en });
    }
    await p.goto(`${base}/privacy`);
    const first = await p.locator('.legal-toc a').nth(3);
    const target = await first.getAttribute('href');
    await first.click();
    const top = await p.locator(target).evaluate((el) => Math.round(el.getBoundingClientRect().top));
    check(`/privacy at ${width}: a contents link scrolls its section to the top`, top >= 0 && top <= 40, { target, top });
    await ctx.close();
  }

  // ---------- links reachable signed out ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${base}/`);
    // While Moni is unreleased the landing hides its legal links; the pages still answer by address.
    const shownLegal = await p.evaluate(() =>
      ['/privacy', '/terms', '/delete-account'].filter((h) => [...document.querySelectorAll(`a[href="${h}"]`)].some((a) => a.getClientRects().length > 0)),
    );
    check('the landing page shows no Privacy policy, Terms or Delete your account link while Moni is unreleased', shownLegal.length === 0, shownLegal);
    for (const path of ['/privacy', '/terms', '/delete-account']) {
      const res = await ctx.request.get(`${base}${path}`, { maxRedirects: 0 });
      check(`${path} still answers 200 signed out`, res.status() === 200, res.status());
    }
    await p.goto(`${base}/`);
    const hrefs = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')))]);
    const statuses = [];
    for (const href of hrefs) statuses.push([href, (await ctx.request.get(`${base}${href}`, { maxRedirects: 0 })).status()]);
    check('every link on the landing page answers 200 signed out, with no redirect', statuses.every(([, s]) => s === 200), statuses);

    await p.goto(`${base}/login`);
    const legal = await p.evaluate(() => ['/privacy', '/terms'].every((h) => document.querySelector(`a[href="${h}"]`)));
    check('sign in links the privacy policy and the terms', legal);

    await p.goto(`${base}/`);
    const switchRow = p.getByRole('switch');
    await switchRow.click();
    const off = await switchRow.getAttribute('aria-checked');
    const offLine = await p.getByText('Off. Typing still works.').isVisible();
    await switchRow.click();
    check("the Your data card's AI switch turns off and on", off === 'false' && offLine && (await switchRow.getAttribute('aria-checked')) === 'true', { off, offLine });

    const question = p.locator('#faq details').first();
    await question.locator('summary').click();
    await settle(p);
    check('a question in Questions opens', (await question.getAttribute('open')) !== null);

    const replay = p.getByRole('button', { name: 'Replay the opening' });
    await replay.focus();
    await p.keyboard.press('Enter');
    await p.waitForTimeout(100);
    check('Replay keeps the keyboard focus', await p.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Replay the opening'));
    await ctx.close();
  }

  // ---------- reduced motion ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto(`${base}/`);
    const moving = await p.evaluate(() =>
      document.getAnimations().filter((a) => {
        const frames = a.effect?.getKeyframes?.() ?? [];
        return frames.some((f) => f.transform && f.transform !== 'none');
      }).length,
    );
    check('under reduce motion the opening only fades', moving === 0, { moving });
    await shot(p, 'site-landing-1440-reduced-motion');
    await ctx.close();
  }

  // ---------- signed in ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: storage });
    const p = await ctx.newPage();
    await p.goto(`${base}/`);
    const open = p.locator('header.lp-top').getByRole('link', { name: 'Open Moni' });
    await open.waitFor({ timeout: 10_000 }).catch(() => {});
    check('signed in, / stays on the landing page with Open Moni', new URL(p.url()).pathname === '/' && (await open.isVisible()), p.url());
    await open.click();
    await p.waitForURL(`${base}/home`, { timeout: 15_000 }).catch(() => {});
    check('Open Moni goes to /home', new URL(p.url()).pathname === '/home', p.url());
    await p.goto(`${base}/settings`);
    const rows = await p.evaluate(() => ['/privacy', '/terms'].map((h) => document.querySelector(`main a[href="${h}"]`)?.textContent?.trim()));
    check('Settings links the privacy policy and the terms', rows[0] === 'Privacy policy' && rows[1] === 'Terms', rows);
    await ctx.close();
  }
}
