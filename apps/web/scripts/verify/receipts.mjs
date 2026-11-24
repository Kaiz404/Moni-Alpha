// Receipt photos in web-verify (`--only receipts`): a scanned transaction's pane in Activity shows the photo the
// web seed keeps for it (Receipt photo, Open the slip) in landscape and portrait in both themes, through a
// signed link only; the row opens the full-screen viewer, which zooms on a click, closes on Esc, on a click
// outside the photo and on ×, and only fades under reduced motion. Nothing is written.

const SIGNED = '/storage/v1/object/sign/receipts/';

export async function verifyReceipts(t) {
  const { browser, storage, base, check, shot, settle, seed, query } = t;
  const [scanned] = query('receipts');
  check('the web seed keeps a receipt photo on a scanned transaction', Boolean(scanned?.receipt_image_url), scanned);
  if (!scanned) return;
  const pinned = async (options) => {
    const ctx = await browser.newContext({ storageState: storage, timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    return ctx;
  };
  const viewer = (p) => p.getByRole('dialog', { name: 'Receipt photo' });
  const gone = (p) => viewer(p).waitFor({ state: 'detached', timeout: 3000 }).then(() => true, () => false);

  for (const theme of ['light', 'dark']) {
    for (const size of [
      { width: 1440, height: 900, name: 'landscape' },
      { width: 390, height: 844, name: 'portrait' },
    ]) {
      const where = `in ${size.name} ${theme}`;
      const ctx = await pinned({ viewport: { width: size.width, height: size.height }, colorScheme: theme });
      await ctx.addInitScript((t) => localStorage.setItem('moni-theme', t), theme);
      const p = await ctx.newPage();
      const opened = [];
      ctx.on('page', (page) => opened.push(page.url()));
      await p.goto(`${base}/activity/${scanned.id}`);
      await p.getByRole('complementary', { name: 'Transaction' }).getByText('Source').waitFor({ timeout: 30_000 }).catch(() => {});
      const row = p.getByRole('button', { name: /^Receipt photo/ });
      const thumb = row.locator('img');
      await thumb.waitFor({ timeout: 5000 }).catch(() => {});
      const src = await thumb
        .evaluate((el) => el.decode().then(() => el.currentSrc))
        .catch(() => '');
      check(`${where}: the pane shows Receipt photo with its thumbnail through a signed link`, src.includes(`${SIGNED}${scanned.receipt_image_url}?token=`), src);
      await row.scrollIntoViewIfNeeded().catch(() => {});
      await shot(p, `receipt-pane-${size.width}-${theme}`);
      if (!src) {
        await ctx.close();
        continue;
      }

      await row.click();
      await viewer(p).waitFor({ timeout: 5000 }).catch(() => {});
      await settle(p);
      const big = viewer(p).locator('img');
      const full = await big
        .evaluate((el) => ({ src: el.currentSrc, natural: el.naturalWidth, fit: getComputedStyle(el).objectFit, ground: getComputedStyle(el.parentElement).backgroundColor }))
        .catch(() => null);
      check(
        `${where}: the row opens the photo full screen on black, contained, from the signed link`,
        Boolean(full?.src.includes(SIGNED)) && full.natural > 0 && full.fit === 'contain' && full.ground === 'rgb(0, 0, 0)' && opened.length === 0,
        { full, opened },
      );
      await shot(p, `receipt-viewer-${size.width}-${theme}`);
      await p.keyboard.press('Escape');
      check(`${where}: Esc closes the photo`, await gone(p));
      await ctx.close();
    }
  }

  // Zoom, the click outside, × and reduced motion, at 1440.
  const ctx = await pinned({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${base}/activity/${scanned.id}`);
  const row = p.getByRole('button', { name: /^Receipt photo/ });
  await row.waitFor({ timeout: 30_000 }).catch(() => {});
  await row.locator('img').evaluate((el) => el.decode()).catch(() => {});
  await row.click();
  await viewer(p).waitFor({ timeout: 5000 }).catch(() => {});
  const animating = await p.evaluate(() => document.querySelector('[role="dialog"] img')?.getAnimations().length ?? 0);
  check('the photo grows out of the thumbnail as it opens', animating > 0, animating);
  await settle(p);
  const big = viewer(p).locator('img');
  const box = await big.boundingBox();
  await big.click({ position: { x: (box?.width ?? 0) / 2, y: (box?.height ?? 0) / 2 } });
  await settle(p);
  const zoomed = await big.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  check('a click on the photo zooms in', zoomed > 1.5, zoomed);
  await big.click();
  await settle(p);
  const back = await big.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  check('a second click zooms back out', Math.abs(back - 1) < 0.01, back);
  await p.mouse.move(720, 450);
  await p.mouse.wheel(0, -400);
  await settle(p);
  const wheeled = await big.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  check('the wheel zooms in', wheeled > 1, wheeled);
  await p.mouse.click(720, 450);
  await settle(p);
  await p.mouse.click(20, 450);
  check('a click outside the photo closes it', await gone(p));
  await row.click();
  await viewer(p).waitFor({ timeout: 5000 }).catch(() => {});
  await viewer(p).getByRole('button', { name: 'Close the receipt' }).click();
  check('× closes the photo', await gone(p));
  check('focus returns to the Receipt photo row', await row.evaluate((el) => el === document.activeElement));
  await ctx.close();

  const calm = await pinned({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const q = await calm.newPage();
  await q.goto(`${base}/activity/${scanned.id}`);
  const calmRow = q.getByRole('button', { name: /^Receipt photo/ });
  await calmRow.waitFor({ timeout: 30_000 }).catch(() => {});
  await calmRow.click();
  await viewer(q).waitFor({ timeout: 5000 }).catch(() => {});
  const moves = await q.evaluate(() =>
    (document.querySelector('[role="dialog"] img')?.getAnimations() ?? []).some((a) =>
      a.effect?.getKeyframes().some((frame) => frame.transform && frame.transform !== 'none'),
    ),
  );
  check('under reduced motion the photo fades in without growing', !moves);
  await calm.close();
}
