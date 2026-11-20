#!/usr/bin/env node
// Builds evals/datasets/text/items.jsonl. Rerun with `node evals/scripts/build-text.mjs`.
// LazyFinance rows are fetched at a pinned revision, checked by SHA-256 and cached in the OS temp dir.
// Nothing here is random, so no seed is needed.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EVALS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(EVALS, 'datasets', 'text', 'items.jsonl');
const WALLETS = JSON.parse(fs.readFileSync(path.join(EVALS, 'datasets', 'wallets.json'), 'utf8'));

// Every item is typed on Wednesday 2026-11-18 at 19:30 local time; relative dates resolve against it.
const CLOCK = {
  US: ['2026-11-18T19:30:00-05:00', 'America/New_York'],
  UK: ['2026-11-18T19:30:00+00:00', 'Europe/London'],
  CA: ['2026-11-18T19:30:00-05:00', 'America/Toronto'],
  AU: ['2026-11-18T19:30:00+11:00', 'Australia/Sydney'],
  IN: ['2026-11-18T19:30:00+05:30', 'Asia/Kolkata'],
  SG: ['2026-11-18T19:30:00+08:00', 'Asia/Singapore'],
  MY: ['2026-11-18T19:30:00+08:00', 'Asia/Kuala_Lumpur'],
  PH: ['2026-11-18T19:30:00+08:00', 'Asia/Manila'],
};
const CUR = { US: 'USD', UK: 'GBP', CA: 'CAD', AU: 'AUD', IN: 'INR', SG: 'SGD', MY: 'MYR', PH: 'PHP' };
const TODAY = '2026-11-18';
const YESTERDAY = '2026-11-17';

const CACHE = path.join(os.tmpdir(), 'moni-evals-cache');
async function fetchPinned(url, sha256) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, sha256);
  if (!fs.existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const buf = fs.readFileSync(file);
  const got = createHash('sha256').update(buf).digest('hex');
  if (got !== sha256) throw new Error(`${url}: sha256 ${got}, want ${sha256}`);
  return buf;
}

const items = [];
function add({ id, region, text, expected, source, licence, trainable, synthetic, tags }) {
  const [clientNow, timezone] = CLOCK[region];
  const full = expected.status === 'ok' && !expected.currency ? { ...expected, currency: CUR[region] } : expected;
  items.push({
    id,
    input: { text, wallets: WALLETS[region], clientNow, timezone },
    expected: full,
    metadata: { source, licence, trainable, synthetic, region, tags },
  });
}
const ok = (amount, type, extra = {}) => ({ status: 'ok', amount, type, ...extra });
const SKIP = { status: 'skipped' };

// ---------------------------------------------------------------------------
// LazyFinance/ExpenseDataset v1.0.0 (CC BY 4.0), English test rows. The card says "Never train on
// this split" for both test splits, so trainable is false. Each row's label was re-checked by hand;
// `want` is the reviewed gold, and the README lists where it departs from the dataset's own label.
// Clean and speech rows use disjoint ids so no expense appears twice.
// ---------------------------------------------------------------------------
const LF_REV = 'e00137f3f18266ddc9000042492367d6d506c6ff';
const lfSplit = async (split, sha) => new Map((await fetchPinned(
  `https://huggingface.co/datasets/LazyFinance/ExpenseDataset/resolve/${LF_REV}/data/${split}.jsonl`, sha,
)).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.id, r]));
const lf = {
  test_clean: await lfSplit('test_clean', 'adff974a87232063bc8e2be1533593b0d7e15d56d24f70dbdcc40c6adf6b6272'),
  test_apple_speech: await lfSplit('test_apple_speech', '1cd0b2cfb492b7917bee93bc1a6265dffc6e7e7450bc3446ffed883b07b163ec'),
};
const CREDIT = 'w-us-credit';
const CASH = 'w-us-cash';
const lazyRows = [
  // [split, row id, reviewed gold, tags]
  ['test_clean', 'eval_000001', ok(40, 'expense', { merchant: 'Shell' }), []],
  ['test_clean', 'eval_000009', ok(12, 'expense', { merchant: 'Subway' }), []],
  ['test_clean', 'eval_000013', ok(1200, 'expense', { walletId: CASH }), ['rent']],
  ['test_clean', 'eval_000021', ok(12.5, 'expense', { merchant: 'Regal Cinema', walletId: CREDIT }), ['cents-in-words']],
  ['test_clean', 'eval_000027', ok(1200, 'expense', { date: TODAY }), ['rent', 'relative-date']],
  ['test_clean', 'eval_000033', ok(15.5, 'expense', { merchant: 'CVS Pharmacy', walletId: CASH }), []],
  ['test_clean', 'eval_000049', ok(15.99, 'expense', { merchant: 'Netflix' }), ['subscription']],
  ['test_clean', 'eval_000065', ok(12.5, 'expense'), ['missing-currency', 'numbers-as-words']],
  ['test_clean', 'eval_000089', ok(35, 'expense', { date: TODAY }), ['relative-date']],
  ['test_clean', 'eval_000107', ok(42, 'expense', { merchant: 'Olive Garden', walletId: CASH }), []],
  ['test_clean', 'eval_000141', ok(1450, 'expense'), ['correction']],
  ['test_clean', 'eval_000117', SKIP, ['non-transaction']],
  ['test_clean', 'eval_000123', SKIP, ['non-transaction', 'question']],
  ['test_clean', 'eval_000137', SKIP, ['non-transaction', 'question']],
  ['test_apple_speech', 'eval_000011', ok(45, 'expense', { walletId: CREDIT }), ['asr-misheard-merchant']],
  ['test_apple_speech', 'eval_000015', ok(35, 'expense', { merchant: 'Uber', walletId: CREDIT }), []],
  ['test_apple_speech', 'eval_000017', ok(80, 'expense', { merchant: 'Foot Locker', walletId: CREDIT }), []],
  ['test_apple_speech', 'eval_000025', ok(200, 'expense', { merchant: 'Coursera', walletId: CREDIT }), []],
  ['test_apple_speech', 'eval_000035', ok(24.5, 'expense', { merchant: 'AMC Theatres', walletId: CREDIT }), ['asr-garbled-amount']],
  ['test_apple_speech', 'eval_000057', ok(2.5, 'expense'), ['asr-garbled-amount']],
  ['test_apple_speech', 'eval_000099', ok(30, 'expense'), []],
  ['test_apple_speech', 'eval_000101', ok(85, 'expense', { merchant: "Macy's", walletId: CREDIT }), []],
  ['test_apple_speech', 'eval_000103', ok(45, 'expense', { merchant: 'CVS Pharmacy', walletId: CASH }), []],
  ['test_apple_speech', 'eval_000105', ok(30, 'expense', { merchant: 'AMC Theatres', walletId: CREDIT }), []],
  ['test_apple_speech', 'eval_000143', ok(23.5, 'expense'), ['correction', 'asr-misheard-merchant', 'asr-garbled-amount']],
  ['test_apple_speech', 'eval_000145', ok(75, 'expense'), ['correction']],
  ['test_apple_speech', 'eval_000111', SKIP, ['non-transaction']],
  ['test_apple_speech', 'eval_000131', SKIP, ['non-transaction', 'question']],
];
for (const [split, rowId, want, tags] of lazyRows) {
  const row = lf[split].get(rowId);
  if (!row) throw new Error(`${split} has no ${rowId}`);
  if (row.locale !== 'en-US') throw new Error(`${split}/${rowId} is ${row.locale}`);
  const speech = split === 'test_apple_speech';
  add({
    id: `text-lazyfinance-${speech ? 'speech' : 'clean'}-${rowId.replace('eval_', '')}`,
    region: 'US',
    text: row.input.audio_transcription,
    expected: want,
    source: `LazyFinance/ExpenseDataset:${split}`,
    licence: 'CC-BY-4.0',
    trainable: false,
    // Clean rows are LLM-written and owner-reviewed; speech rows are real Apple Speech output.
    synthetic: !speech,
    tags: [speech ? 'asr' : 'typed', ...row.tags.map((t) => t.toLowerCase().replace(/_/g, '-')), ...tags],
  });
}

// ---------------------------------------------------------------------------
// moni-bench: the text cases from apps/backend/internal/extract/bench_test.go, wallets mapped to MY.
// ---------------------------------------------------------------------------
const bench = [
  ['cash-food', 'nasi lemak ayam rm8.50 paid cash', ok(8.5, 'expense', { walletId: 'w-my-cash' })],
  ['grab-on-tng', 'Grab to KLCC 23.40 tng', ok(23.4, 'expense', { merchant: 'Grab', walletId: 'w-my-ewallet' })],
  ['salary', 'got my salary 3200 in maybank', ok(3200, 'income', { walletId: 'w-my-bank' })],
  ['atm-withdrawal', 'withdrew 200 from atm', ok(200, 'transfer', { walletId: 'w-my-bank', toWalletId: 'w-my-cash' })],
  ['tng-top-up', 'topped up tng 50 from maybank', ok(50, 'transfer', { walletId: 'w-my-bank', toWalletId: 'w-my-ewallet' })],
  ['subscription', 'Spotify premium 15.90 this month', ok(15.9, 'expense', { merchant: 'Spotify' })],
  ['split-bill', "mamak with friends, I paid 42 for everyone, they'll pay me back 28 later", ok(42, 'expense')],
  ['refund', 'shopee refunded me rm 59', ok(59, 'income', { merchant: 'Shopee' })],
  ['malay-groceries', 'beli barang dapur kat mydin rm 87.30 guna maybank', ok(87.3, 'expense', { merchant: 'Mydin', walletId: 'w-my-bank' })],
  ['multi-item-total', 'zus coffee 2 lattes, total 19.80', ok(19.8, 'expense', { merchant: 'ZUS Coffee' })],
  ['no-amount', 'remember to check my credit card statement', SKIP],
];
for (const [slug, text, want] of bench) {
  add({
    id: `text-bench-${slug}`, region: 'MY', text, expected: want,
    source: 'moni-bench', licence: 'own', trainable: true, synthetic: true,
    tags: [want.status === 'ok' ? want.type : 'non-transaction', ...(slug.startsWith('malay') ? ['malay'] : [])],
  });
}

// ---------------------------------------------------------------------------
// Hand-written, across regions. `asr` marks speech-style input: no punctuation, numbers as words.
// ---------------------------------------------------------------------------
const hand = [
  // [region, slug, text, gold, tags]
  ['US', 'lunch-card', 'lunch 12.50 card', ok(12.5, 'expense'), ['typed', 'shorthand']],
  ['US', 'uber-amex', 'uber 23.40 amex', ok(23.4, 'expense', { merchant: 'Uber', walletId: 'w-us-credit' }), ['typed', 'shorthand']],
  ['US', 'gas-yesterday', 'twenty bucks for gas yesterday', ok(20, 'expense', { date: YESTERDAY }), ['asr', 'slang', 'relative-date']],
  ['US', 'rent-words', 'paid rent fifteen hundred', ok(1500, 'expense'), ['asr', 'numbers-as-words']],
  ['US', 'salary', 'got paid 3200 salary', ok(3200, 'income'), ['typed', 'income']],
  ['US', 'chase-to-venmo', 'moved 500 from chase to venmo', ok(500, 'transfer', { walletId: 'w-us-bank', toWalletId: 'w-us-ewallet' }), ['typed', 'transfer']],
  ['US', 'atm-monday', 'took out sixty dollars from the atm on monday', ok(60, 'transfer', { walletId: 'w-us-bank', toWalletId: 'w-us-cash', date: '2026-11-16' }), ['asr', 'transfer', 'relative-date']],
  ['US', 'starbucks', 'starbucks 6.75', ok(6.75, 'expense', { merchant: 'Starbucks' }), ['typed', 'shorthand']],
  ['US', 'venmo-friend', "venmo'd jake 45 for concert tickets", ok(45, 'expense', { merchant: 'Jake', walletId: 'w-us-ewallet' }), ['typed', 'p2p']],
  ['US', 'spend-question', 'how much did I spend on groceries this month', SKIP, ['typed', 'non-transaction', 'question']],
  ['UK', 'tesco-meal-deal', 'tesco meal deal 3.85', ok(3.85, 'expense', { merchant: 'Tesco' }), ['typed', 'shorthand']],
  ['UK', 'fiver-car-park', 'a fiver for the car park', ok(5, 'expense'), ['asr', 'slang']],
  ['UK', 'quid-pub-friday', 'spent forty quid at the pub last friday', ok(40, 'expense', { date: '2026-11-13' }), ['asr', 'slang', 'relative-date']],
  ['UK', 'monzo-to-paypal', 'topped up paypal with 100 from monzo', ok(100, 'transfer', { walletId: 'w-uk-bank', toWalletId: 'w-uk-ewallet' }), ['typed', 'transfer']],
  ['UK', 'asos-refund', 'refund from asos 32.99', ok(32.99, 'income', { merchant: 'ASOS' }), ['typed', 'refund']],
  ['UK', 'council-tax-reminder', 'remind me to pay the council tax on friday', SKIP, ['typed', 'non-transaction', 'reminder']],
  ['AU', 'coles-commbank', 'coles groceries 87.40 commbank', ok(87.4, 'expense', { merchant: 'Coles', walletId: 'w-au-bank' }), ['typed', 'shorthand']],
  ['AU', 'flat-white', 'paid eighteen fifty for a flat white and a muffin', ok(18.5, 'expense'), ['asr', 'numbers-as-words']],
  ['AU', 'tax-refund', 'got 250 back from the tax office', ok(250, 'income'), ['typed', 'refund']],
  ['AU', 'pay-off-card', 'put 300 from commbank on my anz visa', ok(300, 'transfer', { walletId: 'w-au-bank', toWalletId: 'w-au-credit' }), ['typed', 'transfer', 'card-payment']],
  ['AU', 'cancel-netflix', 'cancel netflix next month its 18.99 now', SKIP, ['typed', 'non-transaction', 'reminder']],
  ['CA', 'tims-cash', 'tim hortons 4.35 cash', ok(4.35, 'expense', { merchant: 'Tim Hortons', walletId: 'w-ca-cash' }), ['typed', 'shorthand']],
  ['CA', 'hydro-words', 'hydro bill one hundred twelve dollars and forty cents', ok(112.4, 'expense'), ['asr', 'numbers-as-words', 'bill']],
  ['CA', 'rent-2-5k', '2.5k rent paid on the 1st', ok(2500, 'expense', { date: '2026-11-01' }), ['typed', 'slang', 'absolute-date']],
  ['IN', 'swiggy-paytm', 'swiggy 450 paytm', ok(450, 'expense', { merchant: 'Swiggy', walletId: 'w-in-ewallet' }), ['typed', 'shorthand']],
  ['IN', 'salary-lakh', 'got salary 1.2 lakh in hdfc', ok(120000, 'income', { walletId: 'w-in-bank' }), ['typed', 'slang', 'lakh', 'income']],
  ['IN', 'electricity-words', 'paid two thousand five hundred rupees for electricity bill yesterday', ok(2500, 'expense', { date: YESTERDAY }), ['asr', 'numbers-as-words', 'bill', 'relative-date']],
  ['IN', 'hdfc-to-paytm', 'sent 5k from hdfc to paytm', ok(5000, 'transfer', { walletId: 'w-in-bank', toWalletId: 'w-in-ewallet' }), ['typed', 'slang', 'transfer']],
  ['IN', 'balance-question', "what's my balance", SKIP, ['typed', 'non-transaction', 'question']],
  ['SG', 'grab-grabpay', 'grab ride 14.20 grabpay', ok(14.2, 'expense', { merchant: 'Grab', walletId: 'w-sg-ewallet' }), ['typed', 'shorthand']],
  ['SG', 'chicken-rice', 'chicken rice five dollars', ok(5, 'expense'), ['asr', 'numbers-as-words']],
  ['SG', 'salary-dbs', 'salary 5800 dbs', ok(5800, 'income', { walletId: 'w-sg-bank' }), ['typed', 'income']],
  ['SG', 'budget-setting', 'set a budget of 500 for food', SKIP, ['typed', 'non-transaction', 'amount-but-not-spend']],
  ['MY', 'mamak-tng', 'mamak 15.60 tng', ok(15.6, 'expense', { walletId: 'w-my-ewallet' }), ['typed', 'shorthand']],
  ['MY', 'cash-deposit', 'deposited two hundred ringgit cash into maybank this morning', ok(200, 'transfer', { walletId: 'w-my-cash', toWalletId: 'w-my-bank', date: TODAY }), ['asr', 'transfer', 'relative-date']],
  ['PH', 'jollibee-gcash', 'jollibee 289 gcash', ok(289, 'expense', { merchant: 'Jollibee', walletId: 'w-ph-ewallet' }), ['typed', 'shorthand']],
  ['PH', 'send-to-mama', 'sent 1500 to mama through gcash', ok(1500, 'expense', { walletId: 'w-ph-ewallet' }), ['typed', 'p2p']],
  ['PH', 'bdo-to-gcash', 'cash in 2000 to gcash from bdo', ok(2000, 'transfer', { walletId: 'w-ph-bank', toWalletId: 'w-ph-ewallet' }), ['typed', 'transfer']],
  ['PH', 'gcash-balance', 'how much is left in my gcash', SKIP, ['asr', 'non-transaction', 'question']],
];
for (const [region, slug, text, want, tags] of hand) {
  add({
    id: `text-${region.toLowerCase()}-${slug}`, region, text, expected: want,
    source: 'moni-handwritten', licence: 'own', trainable: true, synthetic: true, tags,
  });
}

items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
if (new Set(items.map((i) => i.id)).size !== items.length) throw new Error('duplicate ids');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, items.map((i) => JSON.stringify(i)).join('\n') + '\n');

const tally = {};
for (const i of items) {
  const k = `${i.metadata.source.split(':')[0]} ${i.metadata.tags.includes('asr') ? 'asr' : 'typed'} ${i.expected.status}`;
  tally[k] = (tally[k] ?? 0) + 1;
}
console.log(`wrote ${items.length} items to ${path.relative(process.cwd(), OUT)}`);
console.table(tally);
