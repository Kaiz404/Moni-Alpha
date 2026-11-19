// Moni chat in web-verify (`--only chat`): every layout in both themes, the keys, reduced motion, the
// 700 crossing with a half-typed message, Moni's AI consent (Not now, closing, Turn on), an answer card
// against the web e2e user's rows, and the draft for many rows (its rows against REST, the rows lit behind,
// Approve with the card's Undo and with Ctrl Z, Not mine). The clock is pinned to the seed's day. Every
// write is undone: categories by Undo, consent rows by deleting what this part added.
import { Buffer } from 'node:buffer';

const MINUS = '−';
const money = (minor) => `RM${(Math.abs(minor) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const minorOf = (amount) => Math.round(Number(amount) * 100);
/** A stand-in for the gateway when the drive runs without one: what `/v1/chat/analyze` answers. */
export const STUB_AI_URL = 'http://127.0.0.1:9';
const STUB_REPLY = 'Grab orders are most of Food this month.';

export async function verifyChat(t) {
  const { browser, base, storage, check, shot, settle, pair, seed, supabaseUrl, publishable, token, secret, widths, background, realGateway } = t;
  const rest = async (path, init = {}, key = 'user') => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key === 'admin' ? secret : publishable,
        Authorization: `Bearer ${key === 'admin' ? secret : token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]}: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };
  const userId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub;
  const categories = await rest('categories?select=id,name,user_id&deleted=eq.false');
  const named = (name) => categories.find((c) => c.name === name && c.user_id === userId) ?? categories.find((c) => c.name === name);
  const food = named('Food & Dining');
  const transport = named('Transportation') ?? named('Transport');
  if (!check("the e2e user has Food & Dining and the seed's transport category", Boolean(food && transport), { food, transport })) return;

  const month = seed.seedDay.slice(0, 7);
  const inMonth = (row) => {
    const day = seed.dayOf(row.transaction_date);
    return day.startsWith(month) && day <= seed.seedDay;
  };
  const spends = (row) => row.type === 'expense' && !row.analysis_excluded && !row.debt_activity_id && row.currency === seed.currency;
  const grabInFood = () =>
    rest(`transactions?select=id,amount,merchant,category_id,type,currency,transaction_date,analysis_excluded,debt_activity_id&deleted=eq.false&category_id=eq.${food.id}&merchant=ilike.*grab*`).then(
      (rows) => rows.filter((row) => spends(row) && inMonth(row)),
    );
  const categoryOf = async (ids) =>
    Object.fromEntries((await rest(`transactions?select=id,category_id&id=in.(${ids.join(',')})`)).map((row) => [row.id, row.category_id]));
  async function until(test, ms = 20_000) {
    const end = Date.now() + ms;
    let value = await test();
    while (!value.ok && Date.now() < end) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      value = await test();
    }
    return value;
  }

  const lastConsent = (await rest(`ai_consents?select=id&user_id=eq.${userId}&order=id.desc&limit=1`, {}, 'admin'))[0]?.id ?? 0;
  const consentNow = async () => Object.fromEntries((await rest('ai_consent_current?select=use,granted')).map((row) => [row.use, row.granted]));
  const consentBefore = await consentNow();
  console.log(`web e2e user's Moni's AI before this part: ${JSON.stringify(consentBefore)}`);

  const activityFood = `/activity?categories=${food.id}&pane=chat`;
  const pinned = async (options) => {
    const ctx = await browser.newContext({ storageState: storage, timezoneId: seed.zone, ...options });
    await ctx.clock.setFixedTime(seed.pin);
    await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
    const analyzed = [];
    await ctx.route('**/v1/chat/analyze', async (route) => {
      analyzed.push(route.request().postDataJSON());
      if (realGateway) return route.continue();
      return route.fulfill({
        json: { status: 'ok', reply: STUB_REPLY, modelId: 'stub' },
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
      });
    });
    return { ctx, analyzed };
  };
  const ready = async (page) => {
    await page.waitForFunction(() => document.documentElement.dataset.shellReady === 'true');
    await page.locator('.activity[data-loaded], .home[data-loaded], [data-screen]').first().waitFor({ timeout: 30_000 }).catch(() => {});
    await page.locator('aside[data-pane="chat"]').waitFor({ timeout: 10_000 });
  };
  const box = (page) => page.getByLabel('Ask or add a transaction');
  const say = async (page, text) => {
    await box(page).fill(text);
    await box(page).press('Enter');
  };

  try {
    // ---------- every layout, light and dark, with a draft in the thread ----------
    for (const theme of ['light', 'dark']) {
      for (const size of widths) {
        const { ctx } = await pinned({ viewport: { width: size.width, height: size.height }, colorScheme: theme });
        const p = await ctx.newPage();
        await p.goto(`${base}${activityFood}`);
        await ready(p);
        await settle(p);
        const where = `Moni chat at ${size.width} ${theme}`;
        const chatBox = await p.locator('aside[data-pane="chat"]').boundingBox();
        const state = await p.evaluate(() => ({
          layout: document.documentElement.dataset.layout,
          bg: getComputedStyle(document.body).backgroundColor,
          wide: document.documentElement.scrollWidth <= innerWidth,
          tabbar: getComputedStyle(document.querySelector('nav.tabbar')).display !== 'none',
          scrim: [...document.querySelectorAll('.scrim-pane')].some((el) => getComputedStyle(el).display !== 'none'),
        }));
        const form =
          size.layout === 'phone'
            ? chatBox?.x === 0 && chatBox?.width === size.width && !state.tabbar
            : size.layout === 'rail-one-column'
              ? Math.round(chatBox?.width) === 420 && state.scrim
              : Math.round(chatBox?.width) === 420 && !state.scrim;
        check(
          `${where}: ${size.layout}, ${size.layout === 'phone' ? 'the pushed page with no tab bar' : size.layout === 'rail-one-column' ? 'over the page with a scrim' : 'docked beside the page'}, ${theme} ground, no sideways scroll`,
          state.layout === size.layout && form && state.bg === background[theme] && state.wide,
          { ...state, chatBox },
        );
        const context = await p.locator('[data-testid="chat-context"]').textContent();
        check(`${where}: the header says what the view shows`, context === 'Looking at Activity, Food & Dining', context);
        await shot(p, `chat-first-${size.width}-${theme}`);
        await say(p, 'Move my Grab rides out of Food');
        await p.locator('.draft-card').waitFor({ timeout: 10_000 });
        await shot(p, `chat-${size.width}-${theme}`);
        await ctx.close();
      }
    }

    // ---------- first open, the keys, the consent, an answer, the draft ----------
    const { ctx, analyzed } = await pinned({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await rest('ai_consents', { method: 'POST', body: JSON.stringify([{ user_id: userId, use: 'all', granted: false, notice_version: '2026-11-19' }]) });
    await p.goto(`${base}/home`);
    await p.waitForFunction(() => document.documentElement.dataset.shellReady === 'true');
    await p.keyboard.press('/');
    await p.locator('aside[data-pane="chat"]').waitFor();
    check('/ opens Moni chat from Home, which names itself', (await p.locator('[data-testid="chat-context"]').textContent()) === 'Looking at Home');
    const hello = await p.locator('.chat-hello').textContent();
    check('first open says Hi and asks what you spent', /^Hi .+\.What did you spend\?$/.test(hello ?? ''), hello);
    check('three starter cards sit above the box', (await p.locator('.chat-starter').count()) === 3);
    check('the AI line sits under the box', await p.getByText('Moni chat uses AI and can get things wrong. Nothing is saved until you approve it.').isVisible());
    check('the header carries the lilac AI label', await p.locator('.chat-head .ai-tag').isVisible());
    await p.locator('.chat-starter').first().click();
    check('a starter fills the box and sends nothing', (await box(p).inputValue()) === '12.50 at Mamak Ali' && (await p.locator('.chat-me').count()) === 0);
    await settle(p);
    await shot(p, 'chat-first-open-1440-light');
    await box(p).press('Shift+Enter');
    await box(p).type('cash');
    check('Shift+Enter starts a new line and sends nothing', (await box(p).inputValue()) === '12.50 at Mamak Ali\ncash' && (await p.locator('.chat-me').count()) === 0);
    await box(p).fill('12.50 at Mamak Ali');
    await box(p).press('Enter');
    await p.locator('.chat-add').waitFor({ timeout: 5000 }).catch(() => {});
    check('Enter sends; a spend points to Add, with no AI call', (await p.locator('.chat-me').count()) === 1 && (await p.locator('.chat-add').isVisible()) && analyzed.length === 0);
    await p.keyboard.press('Escape');
    await p.waitForURL(`${base}/home`).catch(() => {});
    await p.locator('aside[data-pane="chat"]').waitFor({ state: 'detached' }).catch(() => {});
    check('Esc closes Moni chat', p.url() === `${base}/home`, p.url());
    await p.keyboard.press('/');
    await p.locator('aside[data-pane="chat"]').waitFor();
    check('the thread is still there when chat opens again', (await p.locator('.chat-me').count()) === 1);

    await p.goto(`${base}${activityFood}`);
    await ready(p);
    await p.locator('.activity[data-loaded]').waitFor({ timeout: 30_000 });
    check('the box asks about these rows on Activity', (await box(p).getAttribute('placeholder')) === 'Ask about these rows');
    const question = 'Why is Food so high this month?';
    await say(p, question);
    const dialog = p.getByRole('dialog', { name: 'Moni chat uses AI' });
    await dialog.waitFor({ timeout: 5000 }).catch(() => {});
    check("with Moni's AI off, the first question asks first and sends nothing", (await dialog.isVisible()) && analyzed.length === 0);
    check('the dialog links What Moni sends to Settings', (await dialog.getByRole('link', { name: 'What Moni sends' }).getAttribute('href')) === '/settings/ai');
    await settle(p);
    await shot(p, 'chat-consent-1440-light');
    await dialog.getByRole('button', { name: 'Not now' }).click();
    await p.waitForTimeout(400);
    check(
      'Not now closes it, says AI is off for chat, and sends nothing',
      !(await dialog.isVisible()) && (await p.getByText("Moni's AI is off for chat.").last().isVisible()) && analyzed.length === 0,
    );
    await say(p, question);
    await dialog.waitFor({ timeout: 5000 }).catch(() => {});
    await p.keyboard.press('Escape');
    await p.waitForTimeout(400);
    check(
      'Esc on the dialog counts as Not now and keeps the chat open',
      !(await dialog.isVisible()) && (await p.locator('aside[data-pane="chat"]').isVisible()) && analyzed.length === 0,
    );
    const offRows = await consentNow();
    check('neither Not now wrote a consent row once the user had answered', offRows.all === false, offRows);

    await say(p, question);
    await dialog.getByRole('button', { name: 'Turn on AI' }).click();
    const on = await until(async () => {
      const rows = await consentNow();
      return { ok: rows.all === true && rows.chat === true, rows };
    });
    check("Turn on AI records Moni's AI on, chat included", on.ok, on.rows);
    const card = p.locator('.answer-card').last();
    await card.waitFor({ timeout: 90_000 }).catch(() => {});
    check('then the question goes to the gateway once, with the snapshot and tone', analyzed.length === 1 && analyzed[0]?.message === question && Boolean(analyzed[0]?.snapshot?.currencies), {
      calls: analyzed.length,
    });
    check('the week bars print no values at rest', (await card.locator('.week-col').evaluateAll((cols) => cols.map((col) => col.textContent.trim()).join(''))) === '');
    const weeks = [];
    for (const col of await card.locator('.week-col').all()) {
      await col.hover();
      const week = await col.locator('.week-bar').getAttribute('data-week');
      const tip = (await card.locator('.week-tip').textContent({ timeout: 2000 }).catch(() => '')) ?? '';
      weeks.push({ week, value: tip.startsWith(week) ? tip.slice(week.length).trim() : tip });
    }
    await p.mouse.move(0, 0);
    const foodRows = seed.transactions.filter((row) => spends(row) && inMonth(row) && row.category_id === food.id);
    const want = [];
    for (let start = 1; start <= Number(seed.seedDay.slice(8)); start += 7) {
      const end = Math.min(start + 6, Number(seed.seedDay.slice(8)));
      const sum = foodRows
        .filter((row) => {
          const date = Number(seed.dayOf(row.transaction_date).slice(8));
          return date >= start && date <= end;
        })
        .reduce((total, row) => total + minorOf(row.amount), 0);
      want.push(money(sum));
    }
    check(
      "the answer card is Food & Dining by week, each bar's tooltip what the web e2e user's Food rows add up to",
      (await card.locator('.caps').first().textContent())?.toUpperCase() === 'FOOD & DINING BY WEEK' && JSON.stringify(weeks.map((w) => w.value)) === JSON.stringify(want),
      { weeks, want },
    );
    const caption = await card.locator('.answer-caption').textContent();
    check(`the model's reply is the caption (${realGateway ? 'the local gateway' : 'the stubbed gateway'})`, Boolean(caption) && (realGateway || caption === STUB_REPLY), caption);
    const bar = card.locator('.week-bar').first();
    await bar.scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    const barBox = await bar.boundingBox();
    await p.mouse.move(barBox.x + barBox.width * 0.3, barBox.y + barBox.height * 0.5);
    const tip = card.locator('.week-tip');
    await tip.waitFor({ timeout: 2000 }).catch(() => {});
    const tipA = await tip.boundingBox().catch(() => null);
    await p.mouse.move(barBox.x + barBox.width * 0.8, barBox.y + barBox.height * 0.7);
    await p.waitForTimeout(100);
    const tipB = await tip.boundingBox().catch(() => null);
    check('the card tooltip follows the pointer', Boolean(tipA && tipB && tipB.x > tipA.x && tipB.y > tipA.y), { tipA, tipB });
    await p.mouse.move(5, 5);

    await say(p, 'Move my Grab rides out of Food');
    const draft = p.locator('.draft-card').last();
    await draft.waitFor({ timeout: 10_000 });
    const expectedRows = await grabInFood();
    const drafted = await draft.locator('.draft-row:not(.draft-row-more)').evaluateAll((rows) => rows.map((row) => row.dataset.rowId));
    const draftedAmounts = (await draft.locator('.draft-row-amount').allTextContents()).sort();
    const wantAmounts = expectedRows.map((row) => `${MINUS}${money(minorOf(row.amount))}`).sort();
    check(
      `the draft lists the ${expectedRows.length} Grab rows REST finds in Food this month, from Food & Dining to ${transport.name} (where the Grab rides sit), with no AI call`,
      JSON.stringify([...drafted].sort()) === JSON.stringify(expectedRows.map((row) => row.id).sort()) &&
        JSON.stringify(draftedAmounts) === JSON.stringify(wantAmounts) &&
        (await draft.locator('.draft-top .caps').last().textContent()) === `${expectedRows.length} rows` &&
        (await draft.locator('.draft-move').textContent()) === `Food & Dining${transport.name}` &&
        analyzed.length === 1,
      { drafted, draftedAmounts, wantAmounts },
    );
    const lit = await p.locator('.activity-table [data-draft]').evaluateAll((rows) => rows.map((row) => row.dataset.rowId).sort());
    check(`the same rows light up in Activity behind, with Food → ${transport.name} in their cell`, JSON.stringify(lit) === JSON.stringify([...drafted].sort()) && (await p.locator('.activity-table [data-draft] .draft-to').count()) === lit.length, lit);
    const fromAfter = await draft.locator('.draft-after').first().textContent();
    check(`the card says Food & Dining and ${transport.name} after the change`, /^Food & Dining after/.test(fromAfter ?? '') && (await draft.locator('.draft-after').count()) === 2, fromAfter);
    await settle(p);
    const thread = await shot(p, 'chat-thread-1440-light');
    await pair('chat-1440', 'r2/W2-Chat.png', thread);

    const ids = expectedRows.map((row) => row.id);
    check('the draft card has the focus, so Enter approves it', await draft.evaluate((el) => el === document.activeElement));
    await p.keyboard.press('Enter');
    await p.locator('.draft-settled[data-state="done"]').waitFor({ timeout: 5000 }).catch(() => {});
    const done = await p.locator('.draft-settled[data-state="done"]').textContent().catch(() => '');
    check(`Enter approves: "Changed ${ids.length} rows to ${transport.name}, then Undo"`, done === `Changed ${ids.length} rows to ${transport.name}Undo`, done);
    let moved = await until(async () => {
      const now = await categoryOf(ids);
      return { ok: ids.every((id) => now[id] === transport.id), now };
    });
    check(`the rows are in ${transport.name} over REST`, moved.ok, moved.now);
    check('the rows behind are no longer lit', (await p.locator('.activity-table [data-draft]').count()) === 0);
    await shot(p, 'chat-done-1440-light');
    await p.locator('.draft-settled[data-state="done"]').getByRole('button', { name: 'Undo' }).click();
    moved = await until(async () => {
      const now = await categoryOf(ids);
      return { ok: ids.every((id) => now[id] === food.id), now };
    });
    check("the card's Undo puts them back in Food & Dining over REST, and the draft opens again", moved.ok && (await draft.isVisible()), moved.now);

    await draft.getByRole('button', { name: /^Approve/ }).click();
    moved = await until(async () => {
      const now = await categoryOf(ids);
      return { ok: ids.every((id) => now[id] === transport.id), now };
    });
    check('Approve by its button moves them again', moved.ok, moved.now);
    await p.locator('body').click({ position: { x: 600, y: 30 } });
    await p.keyboard.press('Control+z');
    moved = await until(async () => {
      const now = await categoryOf(ids);
      return { ok: ids.every((id) => now[id] === food.id), now };
    });
    check('Ctrl Z undoes it too, and the draft opens again', moved.ok && (await p.locator('.draft-card').last().isVisible()), moved.now);
    await p.locator('.draft-card').last().getByRole('button', { name: 'Not mine' }).click();
    const kept = await p.locator('.draft-settled[data-state="kept"]').textContent().catch(() => '');
    const still = await categoryOf(ids);
    check('Not mine: "Kept in Food & Dining. Nothing changed." and nothing did', kept === 'Kept in Food & Dining. Nothing changed.' && ids.every((id) => still[id] === food.id), { kept, still });
    await shot(p, 'chat-kept-1440-light');
    check('the first question went with no history, as the phone sends a new thread', (analyzed[0]?.history ?? []).length === 0, analyzed[0]?.history);
    await say(p, 'And how is Transportation doing?');
    await p.locator('.answer-card').nth(1).waitFor({ timeout: 90_000 }).catch(() => {});
    const history = analyzed[1]?.history ?? [];
    check(
      "the next question carries the answered pair as history, timed, with no draft or error in it",
      history.length === 2 && history[0].content === `[15:00] ${question}` && history[1].role === 'assistant' && history[1].content === `[15:00] ${caption}`,
      history,
    );
    await ctx.close();

    // ---------- the 700 crossing keeps the thread and the half-typed message ----------
    {
      const { ctx: rctx } = await pinned({ viewport: { width: 1024, height: 768 } });
      const r = await rctx.newPage();
      await r.goto(`${base}${activityFood}`);
      await ready(r);
      await say(r, 'Move my Grab rides out of Food');
      await r.locator('.draft-card').waitFor({ timeout: 10_000 });
      await box(r).fill('and Starbu');
      await box(r).evaluate((el) => {
        el.dataset.marker = 'kept';
      });
      await r.setViewportSize({ width: 390, height: 844 });
      await r.waitForFunction(() => document.documentElement.dataset.layout === 'phone');
      await settle(r);
      const chatBox = await r.locator('aside[data-pane="chat"]').boundingBox();
      check(
        'crossing 700 keeps the thread and the half-typed message in the same box, now the pushed chat page',
        (await box(r).inputValue()) === 'and Starbu' && (await box(r).getAttribute('data-marker')) === 'kept' && (await r.locator('.draft-card').count()) === 1 && chatBox?.x === 0 && chatBox?.width === 390,
        chatBox,
      );
      await shot(r, 'chat-390-after-resize');
      await r.setViewportSize({ width: 1024, height: 768 });
      await r.waitForFunction(() => document.documentElement.dataset.layout === 'rail');
      check('and back across 700 the message is still there', (await box(r).inputValue()) === 'and Starbu');
      await rctx.close();
    }

    // ---------- reduced motion ----------
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const { ctx: mctx } = await pinned({ viewport: { width: 1440, height: 900 }, reducedMotion });
      const m = await mctx.newPage();
      await m.goto(`${base}${activityFood}`);
      await ready(m);
      const pane = await m.locator('aside[data-pane="chat"]').evaluate((el) => getComputedStyle(el).animationName);
      const expected = reducedMotion === 'reduce' ? 'fade-in' : 'slide-in-right';
      check(`Moni chat opens with ${expected} when motion is ${reducedMotion}`, pane === expected, pane);
      await say(m, 'How is Food doing?');
      const grow = await m.locator('.week-bar').first().evaluate((el) => getComputedStyle(el).animationName, null, { timeout: 90_000 }).catch(() => null);
      const bars = reducedMotion === 'reduce' ? 'none' : 'bar-grow';
      check(`the answer card's bars ${reducedMotion === 'reduce' ? "don't grow" : 'grow in'} when motion is ${reducedMotion}`, grow === bars, grow);
      await mctx.close();
    }
  } finally {
    const added = await rest(`ai_consents?user_id=eq.${userId}&id=gt.${lastConsent}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } }, 'admin');
    const after = await consentNow();
    check(
      `Moni's AI is back as it was for the web e2e user (${added?.length ?? 0} rows this part added, removed)`,
      JSON.stringify(Object.entries(after).sort()) === JSON.stringify(Object.entries(consentBefore).sort()),
      { before: consentBefore, after },
    );
  }
}
