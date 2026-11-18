#!/usr/bin/env node
// Drives the deployed delete-account and QR sign-in functions against the dev project.
//   node supabase/functions/_check/live-check.mjs [--skip-rotation]
// Reads EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, E2E_EMAIL and
// E2E_PASSWORD from apps/mobile/.env.e2e (this checkout's, then the main checkout's). It deletes only a
// throwaway user it creates itself; the e2e user only approves a QR sign-in.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

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
  for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'E2E_EMAIL', 'E2E_PASSWORD']) {
    if (!env[key]) throw new Error(`${key} is missing from apps/mobile/.env.e2e`);
  }
  return env;
}

const env = loadEnv();
const base = env.EXPO_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const publishable = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = env.SUPABASE_SECRET_KEY;
const CHROME_ON_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const USER_TABLES = [
  'wallets', 'categories', 'tags', 'transactions', 'transaction_tags', 'proposed_transactions', 'category_budgets',
  'debts', 'debt_activities', 'recurring_overrides', 'auto_add_rules', 'merchant_aliases',
];

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`);
  if (!ok) failures++;
}

async function call(path, { method = 'POST', key = publishable, token, body, headers = {}, raw } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const fn = (name, options) => call(`/functions/v1/${name}`, options);
const admin = (path, options = {}) => call(path, { ...options, key: secret });

async function signIn(email, password) {
  const res = await call('/auth/v1/token?grant_type=password', { body: { email, password } });
  if (res.status !== 200) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(res.json)}`);
  return { token: res.json.access_token, userId: res.json.user.id };
}

async function rowsOf(userId) {
  const counts = {};
  for (const table of [...USER_TABLES, 'profiles']) {
    const column = table === 'profiles' ? 'id' : 'user_id';
    const res = await admin(`/rest/v1/${table}?${column}=eq.${userId}&select=id`, { method: 'GET' });
    counts[table] = Array.isArray(res.json) ? res.json.length : `error ${res.status}`;
  }
  return counts;
}

async function receiptNames(userId, folder = userId) {
  const res = await admin('/storage/v1/object/list/receipts', { body: { prefix: folder, limit: 100 } });
  const names = [];
  for (const entry of res.json ?? []) {
    if (entry.id === null) names.push(...(await receiptNames(userId, `${folder}/${entry.name}`)));
    else names.push(`${folder}/${entry.name}`);
  }
  return names;
}

async function deleteAccountCheck() {
  console.log('-- delete-account');
  const email = `fn-check-${Date.now()}@example.com`;
  if (email === env.E2E_EMAIL) throw new Error('refusing to delete the e2e user');
  const password = `Check-${crypto.randomUUID()}`;
  const created = await admin('/auth/v1/admin/users', { body: { email, password, email_confirm: true } });
  if (created.status !== 200) throw new Error(`could not create the throwaway user: ${JSON.stringify(created.json)}`);
  const { token, userId } = await signIn(email, password);
  console.log(`throwaway user ${userId}`);

  try {
    const rest = async (table, row) => {
      const res = await call(`/rest/v1/${table}`, {
        token,
        body: { user_id: userId, ...row },
        headers: { Prefer: 'return=representation' },
      });
      if (res.status !== 201) throw new Error(`insert into ${table} failed: ${JSON.stringify(res.json)}`);
      return res.json[0];
    };
    const wallet = await rest('wallets', { name: 'Cash', type: 'cash', currency: 'MYR', color: '#000000', icon: 'cash' });
    const savings = await rest('wallets', { name: 'Savings', type: 'bank', currency: 'MYR', color: '#000000', icon: 'bank' });
    const spend = await rest('transactions', { wallet_id: wallet.id, type: 'expense', amount: 12.5, currency: 'MYR', merchant: 'Kopi' });
    await rest('transactions', { wallet_id: wallet.id, transfer_to_wallet_id: savings.id, type: 'transfer', amount: 5, currency: 'MYR' });
    const tag = await rest('tags', { name: 'check', color: '#000000' });
    await rest('transaction_tags', { transaction_id: spend.id, tag_id: tag.id });
    await rest('proposed_transactions', { wallet_id: wallet.id, type: 'expense', amount: 3, currency: 'MYR', source_type: 'text', source_text: 'kopi 3' });
    await rest('merchant_aliases', { raw_key: 'kopi', display_name: 'Kopi' });
    const category = await rest('categories', { name: 'Check', icon: 'coffee', color: '#FC7F78', type: 'expense' });
    await rest('category_budgets', { category_id: category.id, amount: 100, currency: 'MYR' });
    await rest('auto_add_rules', { merchant_key: 'kopi', source_app: 'com.example.bank', wallet_id: wallet.id, category_id: category.id });
    await rest('recurring_overrides', { series_key: 'MYR|expense|kopi', status: 'confirmed', currency: 'MYR' });
    const debt = await rest('debts', { counterparty_name: 'Mei', direction: 'owed_to_me', currency: 'MYR' });
    await rest('debt_activities', { debt_id: debt.id, kind: 'write_off', amount: 1 });

    for (const path of [`${userId}/receipt-a.jpg`, `${userId}/nested/receipt-b.jpg`]) {
      const up = await call(`/storage/v1/object/receipts/${path}`, {
        token,
        raw: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
        headers: { 'Content-Type': 'image/jpeg' },
      });
      if (up.status !== 200) throw new Error(`upload ${path} failed: ${JSON.stringify(up.json)}`);
    }
    const before = await rowsOf(userId);
    console.log(`before: ${JSON.stringify(before)}, receipts ${(await receiptNames(userId)).length}`);

    const anonymous = await fn('delete-account', { body: {} });
    check('delete-account refuses a call without a session (401)', anonymous.status === 401, anonymous);

    const first = await fn('delete-account', { token, body: {} });
    check('delete-account returns { ok: true }', first.status === 200 && first.json?.ok === true, first);
    const retry = await fn('delete-account', { token, body: {} });
    check('a retry with the same token still returns { ok: true }', retry.status === 200 && retry.json?.ok === true, retry);

    const user = await admin(`/auth/v1/admin/users/${userId}`, { method: 'GET' });
    check('the auth user is gone', user.status === 404, user.status);
    const left = await rowsOf(userId);
    check('no row of the user is left in any table', Object.values(left).every((n) => n === 0), left);
    const files = await receiptNames(userId);
    check('no receipt object is left under the user folder', files.length === 0, files);
  } finally {
    // A failed run must not leave the throwaway user behind. Never the e2e user: the guard above.
    await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
  }
}

async function qrCheck({ rotation }) {
  console.log('-- QR sign-in');
  const phone = await signIn(env.E2E_EMAIL, env.E2E_PASSWORD);
  const ua = { 'User-Agent': CHROME_ON_WINDOWS };

  const start = await fn('qr-start', { body: {}, headers: ua });
  const { requestId, pollSecret, code, codeExpiresAt, expiresAt } = start.json ?? {};
  check(
    'qr-start returns requestId, pollSecret, code, codeExpiresAt and expiresAt',
    start.status === 200 && [requestId, pollSecret, code, codeExpiresAt, expiresAt].every((v) => typeof v === 'string'),
    start,
  );
  const codeSeconds = Math.round((Date.parse(codeExpiresAt) - Date.now()) / 1000);
  // A couple of seconds either way for the clock difference between this machine and the edge.
  check('the code lives about a minute', codeSeconds >= 55 && codeSeconds <= 62, codeSeconds);

  const waiting = await fn('qr-poll', { body: { pollSecret } });
  check('qr-poll waits with the same code', waiting.json?.status === 'waiting' && waiting.json?.code === code, waiting);
  const wrong = await fn('qr-poll', { body: { pollSecret: 'not-a-secret' } });
  check('qr-poll with an unknown secret reads expired', wrong.json?.status === 'expired', wrong);

  const unsigned = await fn('qr-approve', { body: { code, step: 'check' } });
  check('qr-approve refuses a call without a session (401)', unsigned.status === 401, unsigned);
  const named = await fn('qr-approve', { token: phone.token, body: { code, step: 'check' } });
  check('qr-approve check names the browser', named.json?.browser === 'Chrome on Windows', named);
  const approved = await fn('qr-approve', { token: phone.token, body: { code, step: 'approve' } });
  check('qr-approve approve returns { ok: true }', approved.status === 200 && approved.json?.ok === true, approved);
  const again = await fn('qr-approve', { token: phone.token, body: { code, step: 'approve' } });
  check('a second approve of the same code is refused (409)', again.status === 409, again);

  const handed = await fn('qr-poll', { body: { pollSecret } });
  const tokenHash = handed.json?.tokenHash;
  check('qr-poll hands out the token hash', handed.json?.status === 'approved' && typeof tokenHash === 'string', handed);
  const second = await fn('qr-poll', { body: { pollSecret } });
  check('the next poll gets nothing', second.json?.status === 'expired' && second.json?.tokenHash === undefined, second);

  const verified = await call('/auth/v1/verify', { body: { type: 'magiclink', token_hash: tokenHash } });
  check(
    'verifyOtp with the hash yields a session for the phone user',
    verified.status === 200 && typeof verified.json?.access_token === 'string' && verified.json?.user?.id === phone.userId,
    { status: verified.status, error: verified.json?.msg ?? verified.json?.error_description },
  );
  const reused = await call('/auth/v1/verify', { body: { type: 'magiclink', token_hash: tokenHash } });
  check('the hash works once', reused.status !== 200, reused.status);

  if (!rotation) return;
  const next = await fn('qr-start', { body: {}, headers: ua });
  console.log('waiting 61 s for the code to lapse');
  await new Promise((resolve) => setTimeout(resolve, 61_000));
  const stale = await fn('qr-approve', { token: phone.token, body: { code: next.json.code, step: 'check' } });
  check('a lapsed code cannot be approved (410)', stale.status === 410, stale);
  const rotated = await fn('qr-poll', { body: { pollSecret: next.json.pollSecret } });
  check(
    'the poll after a lapsed code rotates it',
    rotated.json?.status === 'waiting' && typeof rotated.json?.code === 'string' && rotated.json.code !== next.json.code,
    rotated,
  );
  const fresh = await fn('qr-approve', { token: phone.token, body: { code: rotated.json?.code, step: 'check' } });
  check('the rotated code can be approved', fresh.json?.browser === 'Chrome on Windows', fresh);
}

await deleteAccountCheck();
await qrCheck({ rotation: !process.argv.includes('--skip-rotation') });
console.log(failures === 0 ? 'live check passed' : `live check FAILED: ${failures} checks`);
process.exit(failures === 0 ? 0 : 1);
