#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DELETE_ORDER, INSERT_ORDER, PROFILES, buildProfile, todayInTimezone } from './fixtures.mjs';

const MOBILE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const usage = () => `usage: seed.mjs --reset --profile <${PROFILES.join('|')}> [--today YYYY-MM-DD]
       seed.mjs --query <${Object.keys(QUERIES).join('|')}>`;

export class SeedError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function parseArgs(argv) {
  const args = { mode: null, profile: null, today: null, name: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) throw new SeedError(`${flag} needs a value`, 2);
      return next;
    };
    if (flag === '--reset') args.mode = 'reset';
    else if (flag === '--profile') args.profile = value();
    else if (flag === '--today') args.today = value();
    else if (flag === '--query') [args.mode, args.name] = ['query', value()];
    else throw new SeedError(`unknown argument ${flag}`, 2);
  }
  if (args.mode === 'reset' && !PROFILES.includes(args.profile ?? ''))
    throw new SeedError(`--reset needs --profile ${PROFILES.join(' or ')}`, 2);
  if (args.mode === 'query' && !(args.name in QUERIES)) throw new SeedError(`unknown query ${args.name}`, 2);
  if (args.today && !/^\d{4}-\d{2}-\d{2}$/.test(args.today)) throw new SeedError('--today is YYYY-MM-DD', 2);
  if (!args.mode) throw new SeedError('pass --reset or --query', 2);
  return args;
}

function mainCheckout() {
  try {
    const list = execFileSync('git', ['-C', MOBILE_ROOT, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' });
    return /^worktree (.+)$/m.exec(list)?.[1] ?? null;
  } catch {
    return null;
  }
}

// Same order as build-apk.sh: this worktree's .env.e2e, the main checkout's, then the .env
// files. A variable already set wins, and the first file that sets a key wins.
export function loadEnv(env = process.env) {
  const main = mainCheckout();
  const files = [join(MOBILE_ROOT, '.env.e2e'), main && join(main, 'apps/mobile/.env.e2e'), join(MOBILE_ROOT, '.env'), main && join(main, 'apps/mobile/.env')];
  const loaded = { ...env };
  for (const file of files) {
    if (!file || !existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (!match || match[1] in loaded) continue;
      const raw = match[2].trim();
      loaded[match[1]] = /^(["']).*\1$/.test(raw) ? raw.slice(1, -1) : raw.replace(/\s+#.*$/, '');
    }
  }
  return loaded;
}

export function e2eConfig(env) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const email = env.E2E_EMAIL?.trim().toLowerCase();
  if (!email || !/^e2e[^@]*@/.test(email))
    throw new SeedError(`E2E_EMAIL must be a dedicated test user whose address starts with e2e, got ${email ? email.replace(/^(.).*@/, '$1…@') : 'nothing'}`, 2);
  const missing = ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'E2E_PASSWORD'].filter((key) => !env[key]);
  if (missing.length) throw new SeedError(`set ${missing.join(', ')} in apps/mobile/.env.e2e`, 3);
  if (!env.SUPABASE_SECRET_KEY.startsWith('sb_secret_')) throw new SeedError('SUPABASE_SECRET_KEY must be an sb_secret_ key', 3);
  return { url, email, password: env.E2E_PASSWORD, secret: env.SUPABASE_SECRET_KEY };
}

function client({ url, secret }) {
  const headers = { apikey: secret, 'Content-Type': 'application/json' };
  return async function request(path, { method = 'GET', body, prefer } = {}) {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: prefer ? { ...headers, Prefer: prefer } : headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new SeedError(`${method} ${path.split('?')[0]} failed with ${response.status}: ${text.slice(0, 300)}`, 1);
    return { response, json: text ? JSON.parse(text) : null };
  };
}

async function findUser(request, email) {
  for (let page = 1; ; page++) {
    const { json } = await request(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = json.users ?? [];
    const user = users.find((u) => u.email?.toLowerCase() === email);
    if (user || users.length < 200) return user ?? null;
  }
}

// Creates the user with a confirmed email, or resets its password to the one in .env.e2e,
// so the Maestro sign-in subflow always has working credentials.
async function ensureUserWithPassword(request, { email, password }) {
  const existing = await findUser(request, email);
  if (existing) {
    await request(`/auth/v1/admin/users/${existing.id}`, { method: 'PUT', body: { password, email_confirm: true } });
    return { id: existing.id, created: false };
  }
  const { json } = await request('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password, email_confirm: true, user_metadata: { display_name: 'Kai' } },
  });
  return { id: json.id, created: true };
}

async function counts(request, userId) {
  const result = {};
  for (const table of DELETE_ORDER) {
    const { response } = await request(`/rest/v1/${table}?user_id=eq.${userId}&select=id`, {
      method: 'HEAD',
      prefer: 'count=exact',
    });
    result[table] = Number(response.headers.get('content-range')?.split('/')[1] ?? NaN);
  }
  return result;
}

async function reset(request, userId, profile, today) {
  const { json: system } = await request('/rest/v1/categories?user_id=is.null&deleted=eq.false&select=id,name');
  const fixtures = buildProfile(profile, {
    userId,
    today,
    systemCategories: Object.fromEntries(system.map((c) => [c.name, c.id])),
  });
  for (const table of DELETE_ORDER)
    await request(`/rest/v1/${table}?user_id=eq.${userId}`, { method: 'DELETE', prefer: 'return=minimal' });
  for (const table of INSERT_ORDER) {
    const rows = fixtures.rows[table];
    if (rows?.length) await request(`/rest/v1/${table}`, { method: 'POST', body: rows, prefer: 'return=minimal' });
  }
  await request('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    body: { id: userId, display_name: fixtures.displayName, preferences: fixtures.preferences },
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

const select = (request, path) => request(path).then(({ json }) => json);

export const QUERIES = {
  counts: (request, userId) => counts(request, userId),
  user: async (request, userId, config) => ({ id: userId, email: config.email }),
  wallets: (request, userId) =>
    select(request, `/rest/v1/wallet_balances?user_id=eq.${userId}&select=name,currency,current_balance&order=display_order`),
  'latest-transaction': async (request, userId) =>
    (await select(
      request,
      `/rest/v1/transactions?user_id=eq.${userId}&deleted=eq.false&select=id,type,amount,currency,merchant,description,transaction_date,metadata,created_at&order=created_at.desc&limit=1`,
    ))[0] ?? null,
  'pending-proposals': (request, userId) =>
    select(
      request,
      `/rest/v1/proposed_transactions?user_id=eq.${userId}&deleted=eq.false&status=eq.pending&select=id,source_type,merchant,amount,currency,wallet_id,created_at&order=created_at.desc`,
    ),
  debts: (request, userId) =>
    select(request, `/rest/v1/debts?user_id=eq.${userId}&deleted=eq.false&select=counterparty_name,direction,status,due_date&order=due_date`),
  bills: (request, userId) =>
    select(
      request,
      `/rest/v1/recurring_overrides?user_id=eq.${userId}&deleted=eq.false&select=name,kind,status,expected_amount,expected_day,remind&order=expected_day`,
    ),
};

async function main(argv) {
  const args = parseArgs(argv);
  const config = e2eConfig(loadEnv());
  const request = client(config);
  if (args.mode === 'query') {
    const user = await findUser(request, config.email);
    if (!user) throw new SeedError(`no user ${config.email} yet, run seed.mjs --reset --profile empty`, 4);
    console.log(JSON.stringify(await QUERIES[args.name](request, user.id, config), null, 2));
    return;
  }
  const today = args.today ?? todayInTimezone();
  const user = await ensureUserWithPassword(request, config);
  console.log(`user ${config.email} ${user.id}${user.created ? ' created' : ''}`);
  console.log(`before ${JSON.stringify(await counts(request, user.id))}`);
  await reset(request, user.id, args.profile, today);
  console.log(`after  ${JSON.stringify(await counts(request, user.id))}`);
  console.log(`seeded profile ${args.profile} for ${today}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof SeedError ? error.message : error);
    if (error instanceof SeedError && error.code === 2) console.error(usage());
    process.exitCode = error instanceof SeedError ? error.code : 1;
  });
}
