#!/usr/bin/env node
// Drives the real web app the way a user does and prints PASS or FAIL per check; the last line is the verdict.
//   node apps/web/scripts/verify/drive.mjs [--no-build] [--dev] [--out <dir>] [--skip-qr] [--doctor] [--port <n>]
// Builds and starts the app on a free port with the dev project's keys from apps/mobile/.env.e2e (this
// checkout's, then the main checkout's), reseeds the web's own e2e user (E2E_WEB_EMAIL) for the boards'
// day, signs in only as that user, and saves screenshots beside the board renders, with board-and-app
// pairs for the screens a board draws. The phone's e2e user is never read or written.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { verifyBudgetDebts } from './budget-debts.mjs';
import { STUB_AI_URL, verifyChat } from './chat.mjs';
import { driveLedgerScreens, readSeed } from './ledger-screens.mjs';
import { verifyPhoneLayout } from './phone-layout.mjs';
import { verifyPlaces } from './places.mjs';
import { verifyReview } from './review.mjs';
import { verifySettings } from './settings.mjs';
import { verifySite } from './site.mjs';
import { verifyFirstRun, verifyStates } from './states.mjs';
import { slotEmail } from '../../../mobile/scripts/e2e/seed.mjs';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const repo = join(web, '..', '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const only = option('--only')?.split(',') ?? null;
/** `--only ledger,keys` runs just those parts after sign-in; every part runs by default. */
const runs = (part) => !only || only.includes(part);

const RENDERS = process.env.MONI_BOARD_RENDERS ?? join(homedir(), '.local/share/moni-canvas/web-r1/renders');
const sha = execFileSync('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['-C', repo, 'status', '--porcelain', '--', 'apps/web'], { encoding: 'utf8' }).trim() !== '';
const OUT = option('--out') ?? join(RENDERS, 'app', `${sha}${dirty ? '-dirty' : ''}`);
mkdirSync(join(OUT, 'pairs'), { recursive: true });

const WIDTHS = [
  { width: 1440, height: 900, layout: 'sidebar' },
  { width: 1024, height: 768, layout: 'rail' },
  { width: 820, height: 1180, layout: 'rail-one-column' },
  { width: 390, height: 844, layout: 'phone' },
];
const ROUTES = [
  { path: '/home', title: /^(Morning|Afternoon|Evening|Welcome to Moni), / },
  { path: '/activity', title: /^Activity$/ },
  { path: '/budget', title: /^Budget$/ },
  { path: '/debts', title: /^Debts$/ },
  { path: '/home/places', title: /^Where you spend$/, pushed: true },
  { path: '/review', title: /^Review$/, pushed: true },
  { path: '/settings', title: /^Settings$/, pushed: true },
];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const NAV_FOR = { sidebar: 'nav.sidebar', rail: 'nav.rail', 'rail-one-column': 'nav.rail', phone: 'nav.tabbar' };
const BACKGROUND = { light: 'rgb(246, 242, 233)', dark: 'rgb(11, 10, 9)' };

let failures = 0;
let passes = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`);
  if (ok) passes++;
  else failures++;
  return ok;
}

function loadEnv() {
  const main = /^worktree (.+)$/m.exec(
    execFileSync('git', ['-C', repo, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' }),
  )?.[1];
  const env = {};
  for (const root of [repo, main]) {
    const file = root && join(root, 'apps/mobile/.env.e2e');
    if (!file || !existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
      if (match && !(match[1] in env)) env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'E2E_WEB_EMAIL', 'E2E_WEB_PASSWORD']) {
    if (!env[key]) throw new Error(`${key} is missing from apps/mobile/.env.e2e`);
  }
  return { ...env, email: slotEmail(env.E2E_WEB_EMAIL, process.env.MONI_WEB_SLOT), password: env.E2E_WEB_PASSWORD };
}

/** The boards' sample day, Wed 14 Oct 2026: the seed is written for it and every pinned page reads it. */
const SEED_DAY = '2026-10-14';
const seedScript = join(repo, 'apps/mobile/scripts/e2e/seed.mjs');
/** seed.mjs for the web's own user, so a phone run reseeding its user never moves a row under a check here. */
function webSeed(...seedArgs) {
  return execFileSync('node', [seedScript, '--user', 'web', ...seedArgs], { encoding: 'utf8' });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitFor(url, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const env = loadEnv();
const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const publishable = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const appEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable,
  NEXT_PUBLIC_MONI_APP_SCHEME: 'moni-e2e',
  NEXT_TELEMETRY_DISABLED: '1',
  // A local gateway when the caller names one (its CORS_ALLOWED_ORIGINS must hold this app's --port);
  // otherwise Moni chat's answers come from a stub the chat part routes.
  NEXT_PUBLIC_AI_API_URL: process.env.NEXT_PUBLIC_AI_API_URL ?? STUB_AI_URL,
};
const realGateway = Boolean(process.env.NEXT_PUBLIC_AI_API_URL);
const next = join(web, 'node_modules', '.bin', 'next');

if (flag('--doctor')) {
  check("apps/mobile/.env.e2e has the dev project keys and the web's e2e user", true);
  check("the web's e2e user is not the phone's", env.email.toLowerCase() !== env.E2E_EMAIL?.toLowerCase(), env.email);
  check('Playwright has its Chromium', existsSync(chromium.executablePath()), chromium.executablePath());
  const poll = await fetch(`${supabaseUrl}/functions/v1/qr-poll`, {
    method: 'POST',
    headers: { apikey: publishable, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pollSecret: 'doctor' }),
  })
    .then((res) => res.json())
    .catch((error) => ({ error: String(error) }));
  check('the dev project answers qr-poll', poll?.status === 'expired', poll);
  const start = await fetch(`${supabaseUrl}/functions/v1/qr-start`, { method: 'OPTIONS' }).catch(() => null);
  check('qr-start is deployed', start?.ok === true, start?.status);
  console.log(failures === 0 ? 'web-verify doctor PASS' : `web-verify doctor FAIL: ${failures} checks`);
  process.exit(failures === 0 ? 0 : 1);
}
const dev = flag('--dev');

if (!dev && !flag('--no-build')) {
  console.log('building the web app');
  execFileSync(next, ['build'], { cwd: web, env: appEnv, stdio: ['ignore', 'ignore', 'inherit'] });
}
console.log(`reseeding ${env.email} with the full profile for ${SEED_DAY}`);
webSeed('--reset', '--profile', 'full', '--today', SEED_DAY);
let seeded = JSON.parse(webSeed('--query', 'fingerprint'));
const port = option('--port') ? Number(option('--port')) : await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(next, [dev ? 'dev' : 'start', '--port', String(port), '--hostname', '127.0.0.1'], {
  cwd: web,
  env: appEnv,
  stdio: ['ignore', 'ignore', 'inherit'],
});
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);
if (!(await waitFor(`${base}/login`, 120_000))) {
  console.log('FAIL the app did not start');
  process.exit(1);
}
console.log(`app on ${base}, screenshots in ${OUT}`);

const browser = await chromium.launch();

/** Waits out the short entrance animations (page fade, pane slide) so a screenshot shows the settled screen. */
async function settle(page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => {
          const timing = a.effect?.getComputedTiming();
          return timing && Number.isFinite(timing.endTime) && timing.endTime < 1500;
        })
        .map((a) => a.finished.catch(() => {})),
    ),
  );
}

async function shot(page, name) {
  await settle(page);
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path });
  return path;
}

/** Board render on the left, the app on the right, at the same height. `board` is under RENDERS or absolute. */
async function pair(name, board, app) {
  const boardPath = board.startsWith('/') ? board : join(RENDERS, board);
  if (!existsSync(boardPath)) return check(`board render ${board} exists`, false, boardPath);
  const page = await browser.newPage({ viewport: { width: 2900, height: 900 } });
  const img = (p) =>
    `<img src="data:image/png;base64,${readFileSync(p).toString('base64')}" style="height:900px;width:auto;display:block">`;
  await page.setContent(
    `<body style="margin:0;display:flex;gap:20px;background:#888;width:max-content">${img(boardPath)}${img(app)}</body>`,
  );
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await page.locator('body').screenshot({ path: join(OUT, 'pairs', `${name}.png`) });
  await page.close();
}

/** One band of a tall board render, such as one section of W2-Parts, saved beside the pairs. */
async function boardBand(board, name, y, height) {
  const page = await browser.newPage({ viewport: { width: 1440, height } });
  await page.setContent(
    `<body style="margin:0;overflow:hidden"><img src="data:image/png;base64,${readFileSync(join(RENDERS, board)).toString('base64')}" style="display:block;margin-top:-${y}px"></body>`,
  );
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  const path = join(OUT, 'pairs', `board-${name}.png`);
  await page.screenshot({ path });
  await page.close();
  return path;
}

/**
 * Never lets a check delete the e2e user: `delete-account` answers ok without reaching the server, and
 * sign-out stays in this browser so the shared e2e session survives. Returns the calls it caught.
 */
async function stubDeletion(context) {
  const calls = [];
  await context.route('**/functions/v1/delete-account', (route) => {
    if (route.request().method() === 'POST') calls.push({ authorization: route.request().headers().authorization ?? '' });
    return route.fulfill({ json: { ok: true }, headers: CORS });
  });
  await context.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, headers: CORS, body: '' }));
  return calls;
}

/** Answers the public page's email-link request without sending mail. Returns the requests it caught. */
async function stubEmailLink(context) {
  const requests = [];
  await context.route('**/auth/v1/otp**', (route) => {
    if (route.request().method() === 'POST') requests.push({ url: route.request().url(), body: route.request().postDataJSON() });
    return route.fulfill({ json: {}, headers: CORS });
  });
  return requests;
}

async function open(page, path) {
  await page.goto(`${base}${path}`);
  await page.waitForFunction(() => document.documentElement.dataset.shellReady === 'true');
}

async function layoutOf(page) {
  return page.evaluate(() => document.documentElement.dataset.layout);
}

async function visibleNav(page) {
  return page.evaluate(() =>
    ['nav.sidebar', 'nav.rail', 'nav.tabbar'].filter((s) => {
      const el = document.querySelector(s);
      return el && getComputedStyle(el).display !== 'none';
    }),
  );
}

async function signInWithPassword(context) {
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill(env.email);
  await page.getByLabel('Password', { exact: true }).fill(env.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(`${base}/home`, { timeout: 20_000 }).catch(() => {});
  return page;
}

async function stubQr(context) {
  const later = (ms) => new Date(Date.now() + ms).toISOString();
  await context.route('**/functions/v1/qr-start', (route) =>
    route.fulfill({
      json: { requestId: '6f1c2a4e-8b3d-4c5f-9a7e-1d2b3c4d5e6f', pollSecret: 'stub', code: 'stub-code', codeExpiresAt: later(42_000), expiresAt: later(600_000) },
    }),
  );
  await context.route('**/functions/v1/qr-poll', (route) =>
    route.fulfill({ json: { status: 'waiting', code: 'stub-code', codeExpiresAt: later(42_000) } }),
  );
}

// Parallel slots sign in at once, and Supabase rate-limits password sign-ins, so a refusal waits and retries.
async function userToken() {
  let last;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: publishable, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.email, password: env.password }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.access_token) return json.access_token;
    last = `${res.status} ${json.error_code ?? json.msg ?? json.error ?? ''}`;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
  throw new Error(`the e2e user could not sign in: ${last}`);
}

async function approve(token, code, step) {
  const res = await fetch(`${supabaseUrl}/functions/v1/qr-approve`, {
    method: 'POST',
    headers: { apikey: publishable, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, step }),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

try {
  // ---------- signed out ----------
  if (runs('auth')) {
  // qr-start allows 10 live requests per address, so only the QR sign-in below asks the real function.
  const out = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await stubQr(out);
  const page = await out.newPage();
  await page.goto(`${base}/budget`);
  check('a signed-out visit to /budget lands on sign in with next', page.url() === `${base}/login?next=%2Fbudget`, page.url());
  await page.goto(`${base}/login`);
  await page.locator('[data-qr-state="showing"]').waitFor({ timeout: 15_000 }).catch(() => {});
  check('sign in shows a QR code', (await page.locator('[data-qr-state="showing"]').count()) === 1);
  const timer = await page.locator('.qr-card .meta').textContent().catch(() => '');
  check('the QR card counts down to the next code', /New code in \d:\d\d/.test(timer ?? ''), timer);
  await pair('auth-sign-in', 'r3/W2-Auth.png', await shot(page, 'auth-sign-in-1440'));

  await page.getByLabel('Email').fill(env.email);
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  await page.locator('form button[type="submit"]').click();
  await page.getByText("That email and password don't match. Check both and try again.").waitFor({ timeout: 15_000 }).catch(() => {});
  check('a wrong password shows the W2-Auth error', await page.getByText("That email and password don't match").isVisible());
  await pair('auth-error', 'r3/W2-Auth-error/W2-Auth.png', await shot(page, 'auth-error-1440'));

  await page.getByRole('button', { name: 'Create account', exact: true }).first().click();
  check('Create account puts mode=create in the URL', page.url().endsWith('/login?mode=create'), page.url());
  await page.getByLabel('Name').fill('Kai');
  await page.getByLabel('Email').fill('kai@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password1');
  await page.getByLabel('Month').selectOption('12');
  await page.getByLabel('Year').selectOption(String(new Date().getFullYear() - 18));
  await page.getByRole('checkbox').check();
  check('an under-18 birth month shows the age message', await page.getByText('Moni is for people 18 and over, so we can').isVisible());
  check('Create account stays disabled under 18', await page.locator('form button[type="submit"]').isDisabled());
  await page.getByLabel('Year').selectOption('1995');
  check('Create account enables at 18 and over with the terms ticked', await page.locator('form button[type="submit"]').isEnabled());
  await pair('auth-register', 'r3/W2-Auth-register/W2-Auth.png', await shot(page, 'auth-register-1440'));

  await page.goto(`${base}/login/forgot?email=kai%40example.com`);
  check('forgot password opens with the email filled', (await page.getByLabel('Email').inputValue()) === 'kai@example.com');
  await pair('auth-forgot', 'r3/W2-Auth-forgot/W2-Auth.png', await shot(page, 'auth-forgot-1440'));
  await page.goto(`${base}/login/verify?email=kai%40example.com`);
  check('verify names the email', await page.getByText('kai@example.com').first().isVisible());
  await pair('auth-verify', 'r3/W2-Auth-verify/W2-Auth.png', await shot(page, 'auth-verify-1440'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/login`);
  await shot(page, 'auth-sign-in-390');
  check('sign in at 390 has no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await out.close();

  }
  // ---------- QR sign-in, approved the way the phone does ----------
  if (!flag('--skip-qr') && runs('qr')) {
    const qr = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const qrPage = await qr.newPage();
    await qrPage.goto(`${base}/login`);
    const box = qrPage.locator('[data-qr-value]');
    await qrPage.locator('[data-qr-state="showing"], [data-qr-state="failed"]').waitFor({ timeout: 15_000 });
    const failed = await qrPage.locator('[data-qr-state="failed"]').textContent().catch(() => null);
    check('qr-start gives this browser a code', failed === null, failed);
    const link = failed === null ? await box.getAttribute('data-qr-value') : null;
    const code = /^moni-e2e:\/\/sign-in\?code=(.+)$/.exec(link ?? '')?.[1];
    if (check('the QR holds a moni-e2e sign-in link', Boolean(code), link)) {
    const token = await userToken();
    const asked = await approve(token, decodeURIComponent(code ?? ''), 'check');
    check('the phone check names this browser', typeof asked.json?.browser === 'string', asked);
    const approved = await approve(token, decodeURIComponent(code ?? ''), 'approve');
    check('the phone approves the code', approved.json?.ok === true, approved);
    await qrPage.waitForURL(`${base}/home`, { timeout: 20_000 }).catch(() => {});
    check('the browser signs itself in after the approval', qrPage.url() === `${base}/home`, qrPage.url());
    }
    await qr.close();
  }

  // ---------- signed in: every route at every width, light and dark ----------
  const auth = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await stubQr(auth);
  const signedIn = await signInWithPassword(auth);
  check('password sign-in reaches /home', signedIn.url() === `${base}/home`, signedIn.url());
  const seed = await readSeed({ supabaseUrl, publishable, token: await userToken() });
  check(`the web's e2e seed was written for ${SEED_DAY}; the ledger screens are checked at 3 pm that day`, seed.seedDay === SEED_DAY, seed.seedDay);
  const storage = await auth.storageState();
  await auth.close();
  const rest = async (path, { method = 'GET', body } = {}) => {
    const token = await userToken();
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      method,
      headers: { apikey: publishable, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  };

  // ---------- first run on an empty account, then the full seed back ----------
  if (runs('firstrun')) {
    await verifyFirstRun({ browser, base, storage, check, shot, settle, pair, boardBand, out: OUT, widths: WIDTHS, background: BACKGROUND, seed, webSeed, rest, email: env.email, password: env.password });
    // The full seed it puts back stamps three wallets' check-in with the time of the reseed.
    seeded = JSON.parse(webSeed('--query', 'fingerprint'));
  }

  if (runs('routes')) {
  for (const theme of ['light', 'dark']) {
    for (const size of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        storageState: storage,
        colorScheme: theme,
      });
      await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      const p = await ctx.newPage();
      for (const route of ROUTES) {
        await p.goto(`${base}${route.path}`);
        // Home and Activity read the store in the browser; their title and rows follow the first pull.
        await p.waitForFunction(() => !document.querySelector('.home, .activity') || document.querySelector('.home[data-loaded], .activity[data-loaded]'), null, { timeout: 20_000 }).catch(() => {});
        const where = `${route.path} at ${size.width} ${theme}`;
        const layout = await layoutOf(p);
        const navs = await visibleNav(p);
        const title = await p.locator('h1:visible').first().textContent();
        const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const wide = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
        // On the phone layout a pushed page (Review, Settings) has no tab bar.
        const nav = size.layout === 'phone' && route.pushed ? [] : [NAV_FOR[size.layout]];
        const ok =
          layout === size.layout &&
          navs.join() === nav.join() &&
          (size.layout === 'phone' && route.phoneTitle ? route.phoneTitle : route.title).test(title ?? '') &&
          bg === BACKGROUND[theme] &&
          wide;
        check(`${where}: ${size.layout}, its nav, title, ${theme} ground, no sideways scroll`, ok, { layout, navs, title, bg, wide });
        await shot(p, `${route.path.slice(1)}-${size.width}-${theme}`);
      }
      await ctx.close();
    }
  }
  for (const size of WIDTHS) {
    await pair(`home-${size.width}`, 'r2/W2-Home.png', join(OUT, `home-${size.width}-light.png`));
  }

  }
  // ---------- Home and Activity against the seed ----------
  if (runs('ledger')) await driveLedgerScreens({ browser, storage, base, check, shot, settle, pair, boardBand, OUT, seed });

  // ---------- Delete your account: the public page, the flow in Settings, done ----------
  if (runs('delete')) {
  // stubDeletion keeps every click here away from the real delete-account; live-check.mjs proves that one.
  const wideEnough = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const groundOf = (p) => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  for (const theme of ['light', 'dark']) {
    for (const size of WIDTHS.filter((w) => w.width === 1440 || w.width === 390)) {
      const where = `at ${size.width} ${theme}`;
      const viewport = { width: size.width, height: size.height };

      const anon = await browser.newContext({ viewport, colorScheme: theme });
      await anon.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      const sentTo = await stubEmailLink(anon);
      const a = await anon.newPage();
      await a.goto(`${base}/delete-account`);
      const anonState = {
        url: a.url(),
        title: await a.getByRole('heading', { name: 'Delete your Moni account' }).isVisible(),
        list: await a.getByText('Receipt photos').isVisible(),
        undone: await a.getByText("It goes at once and can't be undone.").isVisible(),
        signIn: await a.getByRole('link', { name: 'sign in' }).getAttribute('href'),
        bg: await groundOf(a),
        wide: await wideEnough(a),
      };
      check(
        `/delete-account signed out ${where}: public, says what goes and that it can't be undone, offers sign-in back here`,
        anonState.url === `${base}/delete-account` &&
          anonState.title &&
          anonState.list &&
          anonState.undone &&
          anonState.signIn === '/login?next=%2Fdelete-account' &&
          anonState.bg === BACKGROUND[theme] &&
          anonState.wide,
        anonState,
      );
      await shot(a, `delete-account-public-${size.width}-${theme}`);
      if (size.width === 1440 && theme === 'light') {
        await a.getByLabel('Email').fill('kai@example.com');
        await a.getByRole('button', { name: 'Email me a link' }).click();
        await a.getByRole('status').filter({ hasText: 'kai@example.com' }).waitFor({ timeout: 10_000 }).catch(() => {});
        const asked = sentTo[0];
        check(
          'Email me a link asks for a sign-in link back to /delete-account, never a new account, and says it is on its way',
          sentTo.length === 1 &&
            asked.body?.email === 'kai@example.com' &&
            asked.body?.create_user === false &&
            new URL(asked.url).searchParams.get('redirect_to') === `${base}/auth/callback?next=%2Fdelete-account` &&
            (await a.getByText('has a Moni account, a link is on its way').isVisible()),
          asked,
        );
        await shot(a, 'delete-account-public-sent-1440-light');
      }
      await anon.close();

      const ctx = await browser.newContext({ viewport, storageState: storage, colorScheme: theme });
      await ctx.addInitScript(() => localStorage.setItem('moni-theme', 'system'));
      const calls = await stubDeletion(ctx);
      const p = await ctx.newPage();
      for (const [path, name, opens, says] of [
        ['/delete-account', 'public-signed-in', null, 'Your sign-in, on every device'],
        ['/settings/profile', 'in-app', 'Delete your account', 'Everything Moni keeps for you goes for good, on every device.'],
      ]) {
        await p.goto(`${base}${path}`);
        if (opens) {
          const row = p.getByRole('button', { name: opens });
          await row.waitFor({ timeout: 15_000 }).catch(() => {});
          await row.click().catch(() => {});
        }
        const field = p.getByLabel('Type DELETE to confirm');
        const button = p.getByRole('button', { name: 'Delete my account' });
        await field.waitFor({ timeout: 15_000 }).catch(() => {});
        check(
          `${path} signed in ${where}: ${opens ? 'a dialog with one line on' : 'the list of'} what goes, then Delete my account disabled before the word, no sideways scroll`,
          (await p.getByText(says).isVisible()) &&
            (opens ? await p.getByRole('alertdialog', { name: 'Delete your account' }).isVisible() : true) &&
            (await button.isDisabled()) &&
            (await wideEnough(p)),
        );
        await shot(p, `delete-account-${name}-${size.width}-${theme}`);
        if (opens) {
          const focusedId = () => p.evaluate(() => document.activeElement?.id ?? '');
          const inDialog = () => p.evaluate(() => !!document.activeElement?.closest('[role="alertdialog"]'));
          const onField = (await focusedId()) === 'delete-confirm';
          const stays = [];
          for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
            await p.keyboard.press(key);
            stays.push(await inDialog());
          }
          await p.keyboard.press('Escape');
          await p.getByRole('alertdialog').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
          const back = await p.evaluate(() => document.activeElement?.textContent ?? '');
          check(
            `${path} ${where}: the dialog opens on the DELETE field, Tab stays inside, Esc closes it back to the row`,
            onField && stays.every(Boolean) && (await p.getByRole('alertdialog').count()) === 0 && back.includes(opens),
            { onField, stays, back },
          );
          await p.getByRole('button', { name: opens }).click();
          await field.waitFor({ timeout: 5_000 }).catch(() => {});
        }
        await field.fill('DELET');
        await field.press('Enter');
        await p.waitForTimeout(300);
        check(
          `${path} ${where}: Enter does nothing until the word matches`,
          calls.length === 0 && p.url() === `${base}${path}` && (await button.isDisabled()),
          { calls: calls.length, url: p.url() },
        );
        await field.fill(' delete');
        check(`${path} ${where}: DELETE in any letter case enables Delete my account`, await button.isEnabled());
        await shot(p, `delete-account-${name}-typed-${size.width}-${theme}`);
      }
      await p.getByRole('button', { name: 'Delete my account' }).click();
      await p.waitForURL(`${base}/delete-account/done`, { timeout: 15_000 }).catch(() => {});
      check(
        `Delete my account ${where}: one call with the access token, then the done page`,
        calls.length === 1 &&
          /^Bearer ey/.test(calls[0].authorization) &&
          p.url() === `${base}/delete-account/done` &&
          (await p.getByRole('heading', { name: 'Your account is deleted' }).isVisible()),
        { calls: calls.length, url: p.url() },
      );
      await shot(p, `delete-account-done-${size.width}-${theme}`);
      await p.goto(`${base}/home`);
      check(`after Delete ${where} this browser is signed out`, p.url().startsWith(`${base}/login`), p.url());
      await ctx.close();
    }
  }
  const inAppBand = await boardBand('r3/W2-Parts.png', 'delete-in-app', 3900, 710);
  await pair('delete-account-in-app', inAppBand, join(OUT, 'delete-account-in-app-typed-1440-light.png'));
  await pair('delete-account-done', inAppBand, join(OUT, 'delete-account-done-1440-light.png'));
  const publicBand = await boardBand('r3/W2-Parts.png', 'delete-public', 4630, 480);
  await pair('delete-account-public', publicBand, join(OUT, 'delete-account-public-1440-light.png'));

  }
  // ---------- reduced motion ----------
  if (runs('motion')) {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: storage, reducedMotion });
    const p = await ctx.newPage();
    await open(p, '/home');
    await p.keyboard.press('n');
    const pane = p.locator('aside[data-pane="add"]');
    await pane.waitFor();
    const animation = await pane.evaluate((el) => getComputedStyle(el).animationName);
    const expected = reducedMotion === 'reduce' ? 'fade-in' : 'slide-in-right';
    check(`Add opens with ${expected} when motion is ${reducedMotion}`, animation === expected, animation);
    await p.waitForTimeout(600);
    await shot(p, `add-1440-${reducedMotion === 'reduce' ? 'reduced' : 'motion'}`);
    await ctx.close();
  }

  for (const [from, to] of [['light', 'dark'], ['dark', 'light']]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: storage });
    await ctx.addInitScript((theme) => localStorage.setItem('moni-theme', theme), from);
    const p = await ctx.newPage();
    await open(p, '/home');
    await p.locator('.home-slot').first().waitFor();
    await p.getByRole('button', { name: /Settings$/ }).first().click();
    await p.getByRole('radio', { name: to === 'dark' ? 'Dark' : 'Light' }).click();
    await p.waitForFunction(() => document.getAnimations().some((a) => a.effect?.pseudoElement), null, { timeout: 3000 }).catch(() => {});
    const groups = await p.evaluate(() => [...new Set(document.getAnimations().map((a) => a.effect?.pseudoElement).filter(Boolean))].sort());
    check(
      `${from} to ${to}: the circle reveal is the only group, so Home's cards change under it`,
      groups.length > 0 && groups.every((group) => group.endsWith('(root)')),
      groups,
    );
    await ctx.close();
  }

  }
  // ---------- keyboard ----------
  if (runs('keys')) {
  const keysCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: storage });
  const k = await keysCtx.newPage();
  await open(k, '/home');
  await k.keyboard.press('Control+k');
  const palette = k.getByRole('dialog', { name: 'Search or ask Moni' });
  check('Ctrl K opens the command bar', await palette.isVisible());
  await k.waitForTimeout(500);
  await shot(k, 'palette-1440');
  await k.keyboard.type('bud');
  const options = (await k.getByRole('option').allTextContents()).join('|');
  check('typing narrows the results to Budget and Ask Moni', options === 'BudgetGB|Ask Moni: budTab', options);
  await k.keyboard.press('Enter');
  await k.waitForURL(`${base}/budget`).catch(() => {});
  check('Enter goes to the highlighted place', k.url() === `${base}/budget`, k.url());
  check('the command bar closes after running', !(await palette.isVisible()));

  await k.keyboard.press('/');
  await k.waitForURL(/pane=chat/).catch(() => {});
  check('/ docks Moni chat and puts it in the URL', (await k.locator('aside[data-pane="chat"]').isVisible()) && k.url().endsWith('/budget?pane=chat'), k.url());
  await k.waitForTimeout(600);
  await shot(k, 'chat-1440');
  await k.keyboard.press('Escape');
  await k.waitForURL(`${base}/budget`).catch(() => {});
  check('Esc closes Moni chat', !(await k.locator('aside[data-pane="chat"]').isVisible()) && k.url() === `${base}/budget`, k.url());

  await k.keyboard.press('Shift+?');
  const shortcuts = k.getByRole('dialog', { name: 'Keyboard shortcuts' });
  check('? opens the shortcuts dialog', await shortcuts.isVisible());
  await k.waitForTimeout(500);
  await shot(k, 'shortcuts-1440');
  await k.keyboard.press('Escape');
  check('Esc closes the shortcuts dialog', !(await shortcuts.isVisible()));

  await k.keyboard.press('g');
  await k.keyboard.press('d');
  await k.waitForURL(`${base}/debts`).catch(() => {});
  check('G then D goes to Debts', k.url() === `${base}/debts`, k.url());

  await k.keyboard.press('Control+k');
  await k.keyboard.type('what did I spend');
  await k.keyboard.press('Tab');
  await k.waitForURL(/pane=chat/).catch(() => {});
  const draft = await k.getByLabel('Ask or add a transaction').inputValue().catch(() => '');
  check('Tab in the command bar asks Moni with the typed words', draft === 'what did I spend', draft);
  await k.keyboard.press('Escape');

  await k.keyboard.press('Control+k');
  await k.keyboard.type('switch to dark');
  await k.keyboard.press('Enter');
  const toast = k.getByRole('status').filter({ hasText: 'Dark theme on' });
  await toast.waitFor({ timeout: 5000 }).catch(() => {});
  check('switching theme from the command bar shows a toast with Undo', await toast.getByRole('button', { name: 'Undo' }).isVisible());
  await k.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 3000 }).catch(() => {});
  check('the theme is dark', (await k.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  const toastBox = await toast.boundingBox();
  check('the toast sits bottom left beside the sidebar', toastBox !== null && toastBox.x >= 280 && toastBox.x < 300 && toastBox.y > 800, toastBox);
  await k.waitForTimeout(500);
  await shot(k, 'toast-1440-dark');
  await k.keyboard.press('Control+z');
  await k.waitForFunction(() => document.documentElement.dataset.theme === 'light', null, { timeout: 3000 }).catch(() => {});
  check('Ctrl Z undoes the theme switch', (await k.evaluate(() => document.documentElement.dataset.theme)) === 'light');

  await k.getByRole('button', { name: 'Fold the sidebar' }).click();
  await k.waitForFunction(() => document.documentElement.dataset.layout === 'rail', null, { timeout: 3000 }).catch(() => {});
  check('the fold button turns the sidebar into the rail at 1440', (await visibleNav(k)).join() === 'nav.rail' && (await layoutOf(k)) === 'rail');
  await k.reload();
  await k.waitForFunction(() => document.documentElement.dataset.shellReady === 'true');
  check('the fold holds across a reload', (await layoutOf(k)) === 'rail');
  await shot(k, 'rail-folded-1440');
  await k.keyboard.press('[');
  await k.waitForFunction(() => document.documentElement.dataset.layout === 'sidebar', null, { timeout: 3000 }).catch(() => {});
  check('[ opens the sidebar again', (await visibleNav(k)).join() === 'nav.sidebar');

  await k.getByRole('button', { name: /Settings$/ }).first().click();
  const menu = k.getByRole('menu', { name: 'Account' });
  check('the name at the foot of the sidebar opens the account menu', await menu.isVisible());
  await k.waitForTimeout(500);
  await shot(k, 'account-menu-1440');
  await k.keyboard.press('Escape');
  check('Esc closes the account menu', !(await menu.isVisible()));
  await keysCtx.close();

  }
  // ---------- crossing 700 keeps the route and the half-typed field ----------
  if (runs('resize')) {
  const resize = await browser.newContext({ viewport: { width: 1024, height: 768 }, storageState: storage });
  const r = await resize.newPage();
  await open(r, '/activity');
  await r.keyboard.press('n');
  await r.locator('.add-choice').first().waitFor();
  await r.keyboard.press('a');
  const field = r.locator('#add-draft');
  await field.fill('12.50 lunch at Mamak');
  await field.evaluate((el) => {
    el.dataset.marker = 'kept';
  });
  const before = r.url();
  await r.setViewportSize({ width: 390, height: 844 });
  await r.waitForFunction(() => document.documentElement.dataset.layout === 'phone');
  check('at 390 the layout is the phone layout', (await layoutOf(r)) === 'phone');
  check('crossing 700 keeps the route', r.url() === before, { before, after: r.url() });
  check(
    'crossing 700 keeps the half-typed field, in the same element',
    (await field.inputValue()) === '12.50 lunch at Mamak' && (await field.getAttribute('data-marker')) === 'kept',
  );
  await settle(r);
  const addBox = await r.locator('aside[data-pane="add"]').boundingBox();
  check('the Add pane fills the phone screen', addBox?.x === 0 && addBox?.width === 390, addBox);
  await shot(r, 'add-390-after-resize');
  await r.setViewportSize({ width: 1024, height: 768 });
  await r.waitForFunction(() => document.documentElement.dataset.layout === 'rail');
  check('and back across 700 the draft is still there', (await field.inputValue()) === '12.50 lunch at Mamak');
  await resize.close();
  }
  // ---------- Add: the chooser, Type it, and Ask Moni filling Type it ----------
  if (runs('add')) {
  const addCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: storage });
  const d = await addCtx.newPage();
  await open(d, '/activity');
  await d.locator('.activity[data-loaded]').waitFor({ timeout: 30_000 }).catch(() => {});
  await d.keyboard.press('n');
  const addPane = d.locator('aside[data-pane="add"]');
  await addPane.locator('.add-choice').first().waitFor({ timeout: 5000 }).catch(() => {});
  const choices = await addPane.locator('.add-choice').allInnerTexts();
  check('N opens the chooser: Type it and Ask Moni, each with its key', choices.map((text) => text.replace(/\s+/g, ' ').trim()).join('|') === 'Type it T|Ask Moni A', choices);
  await d.waitForTimeout(500);
  await shot(d, 'add-choose-1440');
  await d.keyboard.press('t');
  const amount = addPane.getByRole('textbox', { name: 'Amount', exact: true });
  check('T opens Type it with the amount in focus', await amount.evaluate((el) => el === document.activeElement).catch(() => false));
  await amount.fill('12.50');
  await addPane.getByRole('button', { name: /Pick a category/ }).click();
  await addPane.getByRole('option').first().click();
  await addPane.getByLabel('Shop or note').fill('Verify Kopitiam');
  await shot(d, 'add-type-1440');
  await addPane.getByLabel('Shop or note').press('Enter');
  const added = d.getByRole('status').filter({ hasText: 'Expense added' });
  await added.waitFor({ timeout: 5000 }).catch(() => {});
  check('Enter adds the expense, closes Add and offers Undo', (await added.getByRole('button', { name: 'Undo' }).isVisible().catch(() => false)) && !(await addPane.isVisible()));
  const rowShown = d.getByText('Verify Kopitiam').first();
  await rowShown.waitFor({ timeout: 5000 }).catch(() => {});
  check('the new expense shows on Activity', await rowShown.isVisible().catch(() => false));
  await d.keyboard.press('Control+z');
  await rowShown.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  check('Ctrl Z takes it back', !(await d.getByText('Verify Kopitiam').first().isVisible().catch(() => false)));

  await d.route('**/v1/extract/text', (route) =>
    route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' },
      json: {
        status: 'ok',
        extraction: { amount: 8.4, type: 'expense', currency: 'MYR', merchant: 'Mamak Ali', description: null, walletHint: null, categoryHint: null, walletId: null, transferToWalletHint: null, transferToWalletId: null, confidence: 0.9, reasoning: 'Heard an amount and a shop.', occurredAt: null },
      },
    }),
  );
  await d.keyboard.press('n');
  await addPane.locator('.add-choice').first().waitFor();
  await d.keyboard.press('a');
  await d.locator('#add-draft').fill('8.40 roti at Mamak Ali');
  await d.locator('#add-draft').press('Enter');
  const consent = d.getByRole('dialog', { name: 'Ask Moni uses AI' });
  await Promise.race([consent.waitFor({ timeout: 5000 }), amount.waitFor({ timeout: 5000 })]).catch(() => {});
  if (await consent.isVisible()) await consent.getByRole('button', { name: 'Turn on AI' }).click();
  await amount.waitFor({ timeout: 10_000 }).catch(() => {});
  check(
    'Ask Moni reads the sentence into Type it for the user to check',
    (await amount.inputValue().catch(() => '')) === '8.40' && (await addPane.getByLabel('Shop or note').inputValue().catch(() => '')) === 'Mamak Ali',
  );
  await d.waitForTimeout(400);
  await shot(d, 'add-ask-filled-1440');
  await d.keyboard.press('Escape');
  await addCtx.close();
  }
  if (runs('chat'))
    await verifyChat({ browser, base, storage, check, shot, settle, pair, seed, supabaseUrl, publishable, token: await userToken(), secret: env.SUPABASE_SECRET_KEY, widths: WIDTHS, background: BACKGROUND, realGateway });
  if (runs('settings')) await verifySettings({ browser, base, storage, check, shot, pair, settle, widths: WIDTHS, background: BACKGROUND, out: OUT, rest, seed });
  if (runs('states')) await verifyStates({ browser, base, storage, check, shot, settle, pair, boardBand, out: OUT, widths: WIDTHS, background: BACKGROUND, seed, rest, password: env.password });
  if (runs('phone')) await verifyPhoneLayout({ browser, base, storage, check, shot, settle, background: BACKGROUND, seed });
  if (runs('ledger')) await verifyBudgetDebts({ browser, base, storage, check, shot, pair, settle, open, out: OUT, widths: WIDTHS, background: BACKGROUND, navFor: NAV_FOR, seed, query: (name) => JSON.parse(webSeed('--query', name)) });
  if (runs('review')) await verifyReview({ browser, base, storage, check, shot, pair, settle, out: OUT, widths: WIDTHS, background: BACKGROUND, navFor: NAV_FOR, seed, query: (name) => JSON.parse(webSeed('--query', name)) });
  if (runs('places')) await verifyPlaces({ browser, base, storage, check, shot, pair, settle, open, out: OUT, widths: WIDTHS, background: BACKGROUND, navFor: NAV_FOR, seed, query: (name) => JSON.parse(webSeed('--query', name)) });
  if (runs('site')) await verifySite({ browser, base, storage, check, shot, pair, settle, widths: WIDTHS, background: BACKGROUND });

  // ---------- every write above was undone ----------
  let left = JSON.parse(webSeed('--query', 'fingerprint'));
  for (let tries = 0; tries < 10 && JSON.stringify(left) !== JSON.stringify(seeded); tries++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    left = JSON.parse(webSeed('--query', 'fingerprint'));
  }
  const drift = Object.keys(seeded).flatMap((table) =>
    [...new Set([...Object.keys(seeded[table]), ...Object.keys(left[table] ?? {})])]
      .filter((id) => seeded[table][id] !== left[table]?.[id])
      .map((id) => `${table}/${id}: ${seeded[table][id] ?? 'added'} -> ${left[table]?.[id] ?? 'gone'}`),
  );
  check("the web's e2e user's live rows end as the seed wrote them", drift.length === 0, drift);
} catch (error) {
  check('the drive ran to the end', false, String(error?.stack ?? error));
} finally {
  await browser.close();
  stop();
}

console.log(`screenshots: ${OUT}`);
console.log(failures === 0 ? `web-verify PASS (${passes} checks)` : `web-verify FAIL: ${failures} of ${passes + failures} checks`);
process.exit(failures === 0 ? 0 : 1);
