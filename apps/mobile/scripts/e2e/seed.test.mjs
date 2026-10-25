import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildProfile, dayShift, merchantKey, shiftDate } from './fixtures.mjs';
import { SeedError, parseArgs } from './seed.mjs';

const SEED = fileURLToPath(new URL('./seed.mjs', import.meta.url));
const USER = '9d73080a-d17e-4a32-b882-ff4ac1978ecc';
const SYSTEM = Object.fromEntries(
  ['Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Subscriptions', 'Housing', 'Healthcare', 'Gifts & Donations', 'Salary', 'Freelance'].map(
    (name, index) => [name, `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`],
  ),
);
const full = (today = '2026-10-25', userId = USER) => buildProfile('full', { userId, today, systemCategories: SYSTEM });

test('the date shift maps Wed 14 Oct 2026 to the seed day and keeps the sample order', () => {
  assert.equal(dayShift('2026-10-25'), 11);
  assert.equal(shiftDate('2026-10-14', '2026-10-25'), '2026-10-25');
  assert.equal(shiftDate('2026-10-01', '2026-11-03'), '2026-10-21');
  const days = full('2026-11-03').rows.transactions.map((t) => t.transaction_date);
  const sample = days.slice(0, 34);
  assert.deepEqual(sample, [...sample].sort());
  assert.equal(sample.at(-1), '2026-11-03T00:05:00.000Z');
});

test('the full profile leaves each wallet at its board balance', () => {
  const { wallets, transactions } = full().rows;
  const balance = (wallet) =>
    transactions.reduce((sum, t) => {
      if (t.type === 'income' && t.wallet_id === wallet.id) return sum + t.amount;
      if ((t.type === 'expense' || t.type === 'transfer') && t.wallet_id === wallet.id) return sum - t.amount;
      if (t.type === 'transfer' && t.transfer_to_wallet_id === wallet.id) return sum + t.amount;
      return sum;
    }, wallet.initial_balance);
  assert.deepEqual(
    wallets.map((w) => [w.name, w.currency, Math.round(balance(w) * 100) / 100]),
    [
      ['Maybank Savings', 'MYR', 2281.8],
      ["Touch 'n Go eWallet", 'MYR', 86.4],
      ['Cash', 'MYR', 63.6],
      ['Wise USD', 'USD', 120],
    ],
  );
});

test('the Review deck gets one capture per source type, newest first, the chat one without a wallet', () => {
  const proposals = full().rows.proposed_transactions;
  assert.deepEqual(
    proposals.map((p) => [p.source_type, p.merchant, p.wallet_id === null]),
    [
      ['notification', 'GRAB*FOOD', false],
      ['notification', 'Jaya Grocer', false],
      ['image', 'Restoran Nasi Kandar Ali', false],
      ['text', 'Parking KLCC', true],
    ],
  );
  assert.deepEqual(proposals.map((p) => p.created_at), [...proposals.map((p) => p.created_at)].sort().reverse());
});

test('bills, aliases, and the auto-add rule use the keys lib/ai/routine.ts derives', () => {
  const { recurring_overrides: bills, merchant_aliases: aliases, auto_add_rules: rules } = full().rows;
  assert.deepEqual(
    bills.map((b) => [b.series_key, b.expected_day]),
    [
      ['MYR|expense|netflix', 26],
      ['MYR|expense|spotify', 2],
      ['MYR|expense|unifi fibre', 5],
    ],
  );
  assert.deepEqual(aliases.map((a) => [a.raw_key, a.display_name]), [
    ['shopee', 'Shopee'],
    ['mbb ct pj', "Lotus's"],
    ['grab', 'Grab'],
    ['paynet', 'TNB electricity'],
  ]);
  assert.deepEqual(rules.map((r) => [r.merchant_key, r.source_app]), [['spotify', 'com.android.shell']]);
  assert.equal(merchantKey('GRAB*A-3KX2'), 'grab');
});

test('every row belongs to the seed user, and a reseed writes the same ids', () => {
  const first = full();
  const rows = Object.values(first.rows).flat();
  assert.ok(rows.length > 70);
  assert.ok(rows.every((row) => row.user_id === USER));
  const ids = (profile) => Object.values(profile.rows).flat().map((row) => row.id);
  assert.deepEqual(ids(full()), ids(first));
  assert.equal(new Set(ids(first)).size, ids(first).length);
  const other = ids(full('2026-10-25', '11111111-1111-4111-8111-111111111111'));
  assert.ok(other.every((id) => !ids(first).includes(id)));
});

test('the empty profile writes no rows', () => {
  assert.deepEqual(buildProfile('empty', { userId: USER, today: '2026-10-25', systemCategories: SYSTEM }).rows, {});
});

test('the arguments are checked before anything runs', () => {
  assert.deepEqual(parseArgs(['--reset', '--profile', 'full']), { mode: 'reset', profile: 'full', today: null, name: null });
  assert.throws(() => parseArgs(['--reset', '--profile', 'heavy']), (error) => error instanceof SeedError && error.code === 2);
  assert.throws(() => parseArgs(['--query', 'everything']), (error) => error instanceof SeedError && error.code === 2);
});

test('the guard refuses a user that is not a dedicated e2e user, with exit 2 and no request', () => {
  const run = spawnSync(process.execPath, [SEED, '--reset', '--profile', 'empty'], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      E2E_EMAIL: 'kai@gmail.com',
      E2E_PASSWORD: 'x',
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
      SUPABASE_SECRET_KEY: 'sb_secret_x',
    },
  });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /E2E_EMAIL must be a dedicated test user whose address starts with e2e, got k…@gmail.com/);
  assert.equal(run.stdout, '');
});
