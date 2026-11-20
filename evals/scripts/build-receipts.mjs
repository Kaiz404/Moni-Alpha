#!/usr/bin/env node
// Builds evals/datasets/receipts/items.jsonl and its images. Rerun with `node evals/scripts/build-receipts.mjs`.
// Needs network (Hugging Face datasets-server), sharp from the repo's node_modules, and Playwright's
// headless Chromium shell (~/.cache/ms-playwright/chromium_headless_shell-*). Every label below was
// checked by eye against its image; a public row whose key no longer matches fails the build.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EVALS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(EVALS, '..');
const SUITE = path.join(EVALS, 'datasets', 'receipts');
const IMAGES = path.join(SUITE, 'images');
const CACHE = path.join(SUITE, '.cache');
const WALLETS = JSON.parse(fs.readFileSync(path.join(EVALS, 'datasets', 'wallets.json'), 'utf8'));
const FORCE = process.argv.includes('--force');

const sharp = await loadSharp();
const SHELL = findHeadlessShell();

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    const roots = [REPO, path.resolve(REPO, '..', '..', '..')].map((r) => path.join(r, 'node_modules', '.pnpm'));
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const dir = fs.readdirSync(root).find((d) => /^sharp@/.test(d));
      if (dir) return (await import(path.join(root, dir, 'node_modules', 'sharp', 'lib', 'index.js'))).default;
    }
    throw new Error('sharp not found: run pnpm install in the repo');
  }
}

function findHeadlessShell() {
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  const dir = fs.existsSync(base) && fs.readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort().pop();
  const bin = dir && path.join(base, dir, 'chrome-linux', 'headless_shell');
  if (!bin || !fs.existsSync(bin)) throw new Error('Playwright headless_shell not found: run npx playwright install chromium');
  return bin;
}

// JPEG, longest side <= 1280px, quality 80.
const toJpeg = (input, out) =>
  sharp(input).rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' })
    .jpeg({ quality: 80, mozjpeg: true }).toFile(out);

const clientNow = (date, offset, days = 2) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.toISOString().slice(0, 10)}T20:00:00${offset}`;
};

const items = [];
const add = (item) => items.push(item);

// ---------------------------------------------------------------- SROIE (Malaysia, licence unclear)
// idx is the row in jsdnrs/ICDAR2019-SROIE test split; key guards against a reordered mirror.
// merchant is the name a person would say (brand over legal entity where the receipt brands it).
// itemCount only where the receipt prints a count or every product line is qty 1.
const SROIE = [
  [4, 'X51005230616', 38.9, '2018-01-18', "McDonald's", null, ['fast-food', 'cash-change']],
  [14, 'X51005337877', 53.0, '2018-03-20', 'Uroko Japanese Cuisine', 4, ['restaurant', 'service-charge', 'handwriting']],
  [19, 'X51005365187', 31.9, '2018-03-02', 'F&P Pharmacy', 6, ['pharmacy']],
  [23, 'X51005433556', 49.7, '2018-03-11', 'YHM Aeon Tebrau City', null, ['restaurant', 'scan-small']],
  [30, 'X51005442388', 21.6, '2018-03-20', 'Contento', null, ['cafe', 'scan-small']],
  [31, 'X51005444040', 133.7, '2018-03-09', "Ben's Independent Grocer", 2, ['grocery']],
  [34, 'X51005444046', 66.15, '2018-03-25', 'Star Grocer', 7, ['grocery', 'rounding']],
  [37, 'X51005447844', 110.0, '2018-02-23', 'Jiawei House', null, ['restaurant', 'cut-off']],
  [41, 'X51005568866', 5.05, '2017-08-20', 'Popular Book', 4, ['books', 'discount', 'rounding']],
  [52, 'X51005605287', 12.25, '2018-03-14', 'AEON', 2, ['grocery']],
  [53, 'X51005605295', 5.15, '2018-03-22', 'Econsave', 2, ['grocery', 'handwriting']],
  [79, 'X51005705759', 109.9, '2017-08-01', 'Mydin', 15, ['stationery', 'rotated']],
  [89, 'X51005715455', 10.6, '2018-03-26', '99 Speedmart', null, ['grocery', 'dot-matrix']],
  [90, 'X51005719823', 46.2, '2018-01-29', 'AA Pharmacy', null, ['pharmacy', 'card']],
  [93, 'X51005719863', 77.4, '2018-01-12', 'Sen Lee Heong Restaurant', 4, ['restaurant', 'faded']],
  [95, 'X51005719889', 42.0, '2018-01-04', 'Heng Kee Bak Kut Teh', null, ['restaurant']],
  [97, 'X51005719898', 11.9, '2018-03-19', 'Mr DIY', 1, ['hardware']],
  [99, 'X51005719905', 8.2, '2018-03-25', 'Saint Heart Pastry', 3, ['bakery']],
  [121, 'X51005757233', 9.95, '2018-03-09', 'Guardian', 1, ['pharmacy', 'dot-matrix']],
  [133, 'X51005806695', 4.1, '2018-02-28', 'Juwita Weddings', null, ['retail', 'highlighter']],
  [149, 'X51006327953', 68.9, '2017-02-03', 'Mei Let Restaurant', null, ['restaurant', 'handwriting']],
  [150, 'X51006327960', 9.9, '2017-02-07', "King's Confectionery", 1, ['bakery', 'dot-matrix']],
  [158, 'X51006334742', 167.55, '2017-01-01', 'The Cut Steakhouse & Burgers', null, ['restaurant', 'torn']],
  // Date line is covered by a redaction dot; amount and merchant are clear.
  [162, 'X51006334927', 6.4, null, 'Caltex', 2, ['fuel-station', 'redacted-date', 'handwriting']],
  [165, 'X51006349083', 46.25, '2018-04-19', 'Cha For Tea', 4, ['cafe']],
  [182, 'X51006401977', 14.85, '2017-04-19', 'B & Best Restaurant', null, ['restaurant', 'handwriting']],
  // Printed as 4/22/2018: month first, unlike the rest of the slice.
  [194, 'X51006414715', 41.81, '2018-04-22', 'Secret Recipe', 2, ['restaurant', 'us-date-format', 'scan-small']],
];

async function datasetRow(dataset, idx) {
  const url = `https://datasets-server.huggingface.co/rows?dataset=${dataset}&config=default&split=test&offset=${idx}&length=1`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return (await res.json()).rows[0].row;
    if (attempt === 8) throw new Error(`${url}: HTTP ${res.status}`);
    const wait = Number(res.headers.get('retry-after')) * 1000 || 5000 * attempt;
    await new Promise((r) => setTimeout(r, wait));
  }
}

async function fetchImage(row, out) {
  if (fs.existsSync(out) && !FORCE) return;
  const res = await fetch(row.image.src);
  if (!res.ok) throw new Error(`${row.image.src}: HTTP ${res.status}`);
  await toJpeg(Buffer.from(await res.arrayBuffer()), out);
}

async function buildSroie() {
  fs.mkdirSync(CACHE, { recursive: true });
  for (const [idx, key, amount, date, merchant, itemCount, tags] of SROIE) {
    const file = `sroie-${key}.jpg`;
    const out = path.join(CACHE, file);
    if (!fs.existsSync(out) || FORCE) {
      const row = await datasetRow('jsdnrs/ICDAR2019-SROIE', idx);
      if (row.key !== key) throw new Error(`SROIE test row ${idx} is ${row.key}, expected ${key}`);
      await fetchImage(row, out);
    }
    const input = { image: `.cache/${file}`, wallets: WALLETS.MY, clientNow: clientNow(date ?? '2016-11-11', '+08:00'), timezone: 'Asia/Kuala_Lumpur' };
    const expected = { status: 'ok', amount, currency: 'MYR', type: 'expense', merchant };
    if (date) expected.date = date;
    if (itemCount) expected.itemCount = itemCount;
    add({
      id: `receipt-sroie-${key.toLowerCase()}`,
      input,
      expected,
      metadata: { source: 'sroie', licence: 'unclear', trainable: false, synthetic: false, region: 'MY', tags: ['scan', ...tags] },
    });
  }
}

// ---------------------------------------------------------------- CORD v2 (Indonesia, CC BY 4.0)
// Shop names and dates are blurred in CORD, so only amount, itemCount and (when printed) currency are scored.
// itemCount = product lines, which equals the sum of quantities on every receipt picked here.
const CORD = [
  [14, 281435, 6, null, ['restaurant', 'service-charge', 'coupon']],
  [15, 63000, 2, null, ['cafe', 'blurry']],
  [24, 118000, 3, 'IDR', ['bakery', 'card', 'zero-price-line']],
  [25, 43000, 3, null, ['bakery', 'shadow']],
  [33, 148127, 3, null, ['restaurant', 'discount', 'service-charge']],
  [45, 88000, 4, null, ['cafe', 'crumpled']],
  [47, 63000, 3, null, ['retail', 'card', 'zero-price-line']],
  [49, 23000, 2, null, ['bakery', 'dark']],
  [62, 48000, 2, null, ['cafe']],
  [75, 282000, 6, null, ['restaurant', 'tax', 'dark']],
];

async function buildCord() {
  for (const [idx, amount, itemCount, currency, tags] of CORD) {
    const file = `cord-test-${String(idx).padStart(3, '0')}.jpg`;
    const out = path.join(IMAGES, file);
    if (!fs.existsSync(out) || FORCE) {
      const row = await datasetRow('naver-clova-ix/cord-v2', idx);
      const meta = JSON.parse(row.ground_truth).meta;
      if (meta.image_id !== idx) throw new Error(`CORD test row ${idx} has image_id ${meta.image_id}`);
      await fetchImage(row, out);
    }
    const expected = { status: 'ok', amount, type: 'expense', itemCount };
    if (currency) expected.currency = currency;
    add({
      id: `receipt-cord-test-${String(idx).padStart(3, '0')}`,
      input: { image: `images/${file}`, wallets: WALLETS.SG },
      expected,
      metadata: { source: 'cord-v2', licence: 'CC-BY-4.0', trainable: true, synthetic: false, region: 'ID', tags: ['photo', ...tags] },
    });
  }
}

// ---------------------------------------------------------------- Moni bench receipts (regression)
// cmd/server/testdata/receipt.png is byte-identical to bench/familymart.png, so it is one item.
const BENCH = [
  ['familymart', 12.5, '2026-10-07', 'FamilyMart', 3, ['convenience', 'live-test']],
  ['mamak', 31.9, '2026-10-08', 'Nasi Kandar Pelita', 4, ['restaurant', 'sst', 'cash-change', 'rounding']],
  ['mrdiy', 33.2, '2026-11-18', 'Mr DIY', 4, ['hardware', 'legal-name', 'short-year']],
  ['tealive', 24.7, '2026-10-10', 'Tealive', 2, ['cafe', 'service-tax', 'modifier-line']],
  ['watsons', 59.04, '2026-10-09', 'Watsons', 4, ['pharmacy', 'discount', 'points']],
];

async function buildBench() {
  for (const [name, amount, date, merchant, itemCount, tags] of BENCH) {
    const file = `moni-bench-${name}.jpg`;
    await toJpeg(path.join(REPO, 'apps/backend/internal/extract/testdata/bench', `${name}.png`), path.join(IMAGES, file));
    add({
      id: `receipt-moni-bench-${name}`,
      input: { image: `images/${file}`, wallets: WALLETS.MY, clientNow: clientNow(date, '+08:00', 1), timezone: 'Asia/Kuala_Lumpur' },
      expected: { status: 'ok', amount, currency: 'MYR', type: 'expense', merchant, date, itemCount },
      metadata: { source: 'moni-bench', licence: 'own', trainable: true, synthetic: true, region: 'MY', tags: ['render', ...tags] },
    });
  }
}

// ---------------------------------------------------------------- Synthetic receipts
// Totals are computed in integer cents from the template slots, so labels are exact.
const REGIONS = {
  US: { currency: 'USD', sym: '$', tz: 'America/New_York', offset: '-05:00', fmt: 'mdy' },
  UK: { currency: 'GBP', sym: '£', tz: 'Europe/London', offset: '+00:00', fmt: 'dmy' },
  AU: { currency: 'AUD', sym: 'A$', tz: 'Australia/Sydney', offset: '+11:00', fmt: 'dmy' },
  CA: { currency: 'CAD', sym: 'C$', tz: 'America/Toronto', offset: '-05:00', fmt: 'ymd' },
  IN: { currency: 'INR', sym: '₹', tz: 'Asia/Kolkata', offset: '+05:30', fmt: 'dmy-dash' },
  SG: { currency: 'SGD', sym: 'S$', tz: 'Asia/Singapore', offset: '+08:00', fmt: 'dmy' },
  PH: { currency: 'PHP', sym: '₱', tz: 'Asia/Manila', offset: '+08:00', fmt: 'mdy' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function showDate(iso, fmt) {
  const [y, m, d] = iso.split('-');
  if (fmt === 'mdy') return `${m}/${d}/${y}`;
  if (fmt === 'dmy') return `${d}/${m}/${y}`;
  if (fmt === 'dmy-dash') return `${d}-${m}-${y}`;
  if (fmt === 'ymd') return `${y}-${m}-${d}`;
  if (fmt === 'long') return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
  if (fmt === 'us-long') return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
  throw new Error(fmt);
}

const fmtMoney = (cents, region) =>
  (cents / 100).toLocaleString(region === 'IN' ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (cents, rate) => Math.round(cents * rate);

// Each calc returns the summary lines under the items and the total paid, all in cents.
const CALC = {
  salesTax: (rate, label) => (sub) => {
    const tax = pct(sub, rate);
    return { lines: [['Subtotal', sub], [label, tax]], total: sub + tax };
  },
  taxAndTip: (rate, tipRate) => (sub) => {
    const tax = pct(sub, rate);
    const tip = pct(sub, tipRate);
    return { lines: [['Subtotal', sub], [`Sales Tax ${(rate * 100).toFixed(3)}%`, tax], [`Tip (${tipRate * 100}%)`, tip]], total: sub + tax + tip };
  },
  couponTax: (coupon, rate) => (sub) => {
    const tax = pct(sub - coupon, rate);
    return { lines: [['Subtotal', sub], ['Coupon SAVE5', -coupon], [`Tax ${(rate * 100).toFixed(2)}%`, tax]], total: sub - coupon + tax };
  },
  vatIncl: (rate, label) => (sub) => ({ lines: [[label, Math.round((sub * rate) / (1 + rate)), 'note']], total: sub }),
  serviceIncl: (svc, vatRate) => (sub) => {
    const s = pct(sub, svc);
    return { lines: [['Subtotal', sub], [`Service ${svc * 100}%`, s], [`VAT ${vatRate * 100}% incl.`, Math.round(((sub + s) * vatRate) / (1 + vatRate)), 'note']], total: sub + s };
  },
  twoTax: (a, aLabel, b, bLabel) => (sub) => {
    const ta = pct(sub, a);
    const tb = pct(sub, b);
    return { lines: [['Subtotal', sub], [aLabel, ta], [bLabel, tb]], total: sub + ta + tb };
  },
  gstIndia: (rate) => (sub) => {
    const half = pct(sub, rate / 2);
    const raw = sub + 2 * half;
    const total = Math.round(raw / 100) * 100;
    return { lines: [['Taxable Value', sub], [`CGST @${(rate / 2) * 100}%`, half], [`SGST @${(rate / 2) * 100}%`, half], ['Round Off', total - raw]], total };
  },
  svcGst: (svc, gst) => (sub) => {
    const s = pct(sub, svc);
    const g = pct(sub + s, gst);
    return { lines: [['Subtotal', sub], [`Svc Chg ${svc * 100}%`, s], [`GST ${gst * 100}%`, g]], total: sub + s + g };
  },
  discountVat: (disc, vatRate) => (sub) => {
    const d = pct(sub, disc);
    const total = sub - d;
    return { lines: [['Subtotal', sub], [`Member discount ${disc * 100}%`, -d], [`VAT ${vatRate * 100}% incl.`, Math.round((total * vatRate) / (1 + vatRate)), 'note']], total };
  },
  phVat: (svc) => (sub) => {
    const s = pct(sub, svc);
    const total = sub + s;
    const vatable = Math.round(total / 1.12);
    return { lines: [['Subtotal', sub], ...(svc ? [[`Service Charge ${svc * 100}%`, s]] : []), ['VATable Sales', vatable, 'note'], ['VAT 12%', total - vatable, 'note']], total };
  },
};

// [name, qty, unit price in cents]
const SYNTH = [
  { id: 'us-grocery-tx', region: 'US', merchant: 'Lone Star Grocers', addr: ['4410 Burnet Rd', 'Austin, TX 78756'], date: '2026-10-17', time: '18:42', dfmt: 'mdy', style: 'thermal',
    items: [['Organic Bananas', 1, 189], ['Whole Milk 1 gal', 1, 429], ['Sourdough Loaf', 1, 549], ['Cheddar Block 8oz', 1, 399], ['Dish Soap', 1, 349]], calc: CALC.salesTax(0.0825, 'Sales Tax 8.25%'), pay: 'VISA ****4417', tags: ['grocery', 'sales-tax', 'card'] },
  { id: 'us-diner-tip-tax', region: 'US', merchant: 'Blue Door Diner', addr: ['212 Atlantic Ave', 'Brooklyn, NY 11201'], date: '2026-11-14', time: '20:15', dfmt: 'mdy', style: 'photo-wood',
    items: [['Cheeseburger Deluxe', 1, 1695], ['Cobb Salad', 1, 1450], ['Sweet Potato Fries', 1, 650], ['Iced Tea', 2, 375]], calc: CALC.taxAndTip(0.08875, 0.2), pay: 'AMEX ****1009', tags: ['restaurant', 'tip', 'sales-tax', 'tricky'] },
  { id: 'us-pharmacy-coupon', region: 'US', merchant: 'Cornerstone Pharmacy', addr: ['88 Main Street', 'Columbus, OH 43215'], date: '2026-10-23', time: '11:06', dfmt: 'mdy', style: 'laser',
    items: [['Ibuprofen 200mg 100ct', 1, 899], ['Vitamin D3 2000IU', 1, 1249], ['Hand Lotion 12oz', 1, 679], ['Bandages Assorted', 1, 449]], calc: CALC.couponTax(500, 0.0575), pay: 'DEBIT ****2290', tags: ['pharmacy', 'discount', 'sales-tax', 'tricky'] },
  { id: 'us-coffee', region: 'US', merchant: 'Fogline Coffee', addr: ['1530 Haight St', 'San Francisco, CA 94117'], date: '2026-11-16', time: '08:12', dfmt: 'us-long', style: 'thermal-narrow',
    items: [['Oat Latte 12oz', 1, 575], ['Almond Croissant', 1, 450]], calc: CALC.salesTax(0.08625, 'Tax'), pay: 'Apple Pay', tags: ['cafe', 'sales-tax', 'small'] },
  { id: 'uk-grocer-vat', region: 'UK', merchant: 'Marlow & Finch', addr: ['17 High Street', 'Marlow SL7 1AU'], date: '2026-10-24', time: '17:55', dfmt: 'dmy', style: 'thermal',
    items: [['Free Range Eggs x6', 1, 245], ['Sourdough Bloomer', 1, 210], ['Cheddar 400g', 1, 375], ['Sparkling Water 1L', 1, 95], ['Kitchen Roll 2pk', 1, 199], ['Dark Chocolate', 1, 150]], calc: CALC.vatIncl(0.2, 'VAT included'), pay: 'Contactless Mastercard', tags: ['grocery', 'vat-incl', 'card'] },
  { id: 'uk-pub-service', region: 'UK', merchant: 'The Crooked Anchor', addr: ['3 Quay Street', 'Bristol BS1 4DB'], date: '2026-11-07', time: '21:30', dfmt: 'long', style: 'photo-dark',
    items: [['Fish & Chips', 1, 1650], ['Steak Pie', 1, 1595], ['Pint Pale Ale', 2, 595], ['Sticky Toffee Pudding', 1, 750]], calc: CALC.serviceIncl(0.125, 0.2), pay: 'Visa Debit', tags: ['restaurant', 'service-charge', 'vat-incl'] },
  { id: 'uk-hardware', region: 'UK', merchant: 'Paddington Hardware', addr: ['221 Praed Street', 'London W2 1RH'], date: '2026-10-29', time: '10:21', dfmt: 'dmy', style: 'laser-rotated',
    items: [['Wood Screws 4x40 (200)', 1, 649], ['Masking Tape 25mm', 1, 299], ['Paint Brush Set', 1, 1199]], calc: CALC.vatIncl(0.2, 'Incl. VAT @20%'), pay: 'Cash £30.00', tags: ['hardware', 'vat-incl', 'cash-change', 'rotated'] },
  { id: 'au-cafe-gst', region: 'AU', merchant: 'Bondi Bean Café', addr: ['62 Hall Street', 'Bondi Beach NSW 2026', 'ABN 51 824 753 556'], date: '2026-11-15', time: '09:40', dfmt: 'dmy', style: 'thermal-narrow',
    items: [['Flat White', 2, 550], ['Smashed Avo Toast', 1, 1900], ['Banana Bread', 1, 750]], calc: CALC.vatIncl(0.1, 'Total includes GST'), pay: 'EFTPOS', tags: ['cafe', 'gst-incl', 'card'] },
  { id: 'au-hardware', region: 'AU', merchant: 'Coastline Hardware', addr: ['5 Industrial Dr', 'Mayfield NSW 2304', 'ABN 33 102 417 032'], date: '2026-10-19', time: '14:08', dfmt: 'dmy', style: 'photo-wood',
    items: [['Garden Hose 20m', 1, 3498], ['Hose Fitting Set', 1, 1299], ['Work Gloves L', 1, 899], ['Potting Mix 25L', 2, 795]], calc: CALC.vatIncl(0.1, 'GST included'), pay: 'Visa ****8812', tags: ['hardware', 'gst-incl', 'photo'] },
  { id: 'au-pharmacy', region: 'AU', merchant: 'Southbank Chemist', addr: ['140 Grey Street', 'South Brisbane QLD 4101'], date: '2026-11-12', time: '16:27', dfmt: 'long', style: 'faded',
    items: [['Paracetamol 500mg 20', 1, 399], ['SPF50+ Sunscreen 200ml', 1, 1699], ['Electrolyte Sachets', 1, 1249]], calc: CALC.vatIncl(0.1, 'GST incl.'), pay: 'Mastercard', tags: ['pharmacy', 'gst-incl', 'faded'] },
  { id: 'ca-grocery-hst', region: 'CA', merchant: 'Maple & Main Grocery', addr: ['301 King St W', 'Toronto ON M5V 1J5'], date: '2026-10-26', time: '19:03', dfmt: 'ymd', style: 'thermal',
    items: [['Maple Granola', 1, 699], ['Paper Towels 6pk', 1, 1049], ['Laundry Detergent', 1, 1399], ['Sparkling Water 12pk', 1, 649]], calc: CALC.salesTax(0.13, 'HST 13%'), pay: 'Interac Debit', tags: ['grocery', 'hst', 'card'] },
  { id: 'ca-coffee-gst', region: 'CA', merchant: 'Prairie Brew Coffee', addr: ['10150 Jasper Ave', 'Edmonton AB T5J 1W8'], date: '2026-11-17', time: '07:48', dfmt: 'ymd', style: 'thermal-narrow-blur',
    items: [['Americano Large', 1, 425], ['Breakfast Sandwich', 1, 795], ['Blueberry Muffin', 1, 375]], calc: CALC.salesTax(0.05, 'GST 5%'), pay: 'VISA ****0021', tags: ['cafe', 'gst', 'blurry'] },
  { id: 'ca-books-gst-pst', region: 'CA', merchant: 'Cedar Lane Books', addr: ['2580 W Broadway', 'Vancouver BC V6K 2G1'], date: '2026-10-31', time: '15:12', dfmt: 'us-long', style: 'laser',
    items: [['The Salt Path (pb)', 1, 2299], ['Notebook A5 Dotted', 1, 1495], ['Bookmark Set', 1, 599]], calc: CALC.twoTax(0.05, 'GST 5%', 0.07, 'PST 7%'), pay: 'Mastercard ****7730', tags: ['books', 'gst', 'pst'] },
  { id: 'in-sweets-gst', region: 'IN', merchant: 'Annapurna Sweets', addr: ['14 MG Road', 'Bengaluru 560001', 'GSTIN 29ABCDE1234F1Z5'], date: '2026-11-10', time: '18:20', dfmt: 'dmy-dash', style: 'thermal',
    items: [['Kaju Katli 500g', 1, 52000], ['Motichoor Ladoo 1kg', 1, 48000], ['Samosa', 4, 2500], ['Masala Chai', 2, 3000]], calc: CALC.gstIndia(0.05), pay: 'UPI', tags: ['sweets', 'gst', 'round-off', 'upi'] },
  { id: 'in-electronics-lakh', region: 'IN', merchant: 'Shree Ganesh Electronics', addr: ['Shop 7, Lamington Road', 'Mumbai 400007', 'GSTIN 27AAGFS5521K1ZP'], date: '2026-10-21', time: '13:45', dfmt: 'dmy', style: 'laser',
    items: [['55" 4K Smart TV', 1, 6299000], ['Soundbar 2.1ch', 1, 1499000], ['Wall Mount Kit', 1, 149900]], calc: CALC.gstIndia(0.18), pay: 'HDFC Credit Card', tags: ['electronics', 'gst', 'lakh-format', 'large-amount'] },
  { id: 'in-chai', region: 'IN', merchant: 'Kesar Chai House', addr: ['Sector 18 Market', 'Noida 201301'], date: '2026-11-18', time: '17:05', dfmt: 'dmy-dash', style: 'thermal-narrow-rotated',
    items: [['Kulhad Chai', 2, 4000], ['Bun Maska', 1, 6000], ['Veg Puff', 1, 3500]], calc: CALC.gstIndia(0.05), pay: 'Paytm', tags: ['cafe', 'gst', 'rotated'] },
  { id: 'sg-kopitiam-gst', region: 'SG', merchant: 'Lion City Kopi', addr: ['8 Tanjong Pagar Plaza', '#01-12 Singapore 081008', 'GST Reg No. 201812345K'], date: '2026-11-13', time: '12:31', dfmt: 'dmy', style: 'thermal',
    items: [['Kaya Toast Set', 1, 580], ['Laksa', 1, 750], ['Kopi C', 1, 180], ['Teh Peng', 1, 220]], calc: CALC.svcGst(0.1, 0.09), pay: 'PayNow', tags: ['restaurant', 'service-charge', 'gst'] },
  { id: 'sg-mart-gst-incl', region: 'SG', merchant: 'Orchard Fresh Mart', addr: ['290 Orchard Road', 'Singapore 238859'], date: '2026-10-28', time: '19:44', dfmt: 'long', style: 'photo-dark-crumple',
    items: [['Jasmine Rice 5kg', 1, 1395], ['Pak Choy', 2, 160], ['Chicken Thigh 1kg', 1, 890], ['Soy Sauce 640ml', 1, 345], ['Eggs 10s', 1, 405]], calc: CALC.discountVat(0.05, 0.09), pay: 'NETS', tags: ['grocery', 'gst-incl', 'discount', 'crumpled'] },
  { id: 'ph-eatery-vat', region: 'PH', merchant: 'Kalye Pinoy Eatery', addr: ['45 Maginhawa St', 'Quezon City 1101', 'VAT REG TIN 123-456-789-000'], date: '2026-11-08', time: '13:10', dfmt: 'mdy', style: 'thermal-blur',
    items: [['Chicken Adobo w/ Rice', 1, 18500], ['Sinigang na Baboy', 1, 32000], ['Lumpiang Shanghai', 1, 15000], ['Calamansi Juice', 2, 6500]], calc: CALC.phVat(0.1), pay: 'GCash', tags: ['restaurant', 'vat', 'service-charge', 'blurry'] },
  { id: 'ph-mart-vat', region: 'PH', merchant: 'Isla Mart', addr: ['Ayala Ave cor. Paseo de Roxas', 'Makati City 1226'], date: '2026-10-25', time: '20:02', dfmt: 'mdy', style: 'thermal',
    items: [['Instant Noodles 6pk', 1, 8400], ['Coffee 3in1 30s', 1, 21500], ['Bottled Water 1L', 3, 2500], ['Bath Soap 3x', 1, 12900], ['Canned Tuna', 2, 4250]], calc: CALC.phVat(0), pay: 'Cash ₱600.00', tags: ['grocery', 'vat', 'cash-change'] },
];

const STYLES = {
  thermal: { font: "'DejaVu Sans Mono', monospace", width: 380, paper: '#fbfaf6', ink: '#2b2b2b', size: 15 },
  'thermal-narrow': { font: "'Ubuntu Mono', monospace", width: 330, paper: '#fdfcf8', ink: '#333', size: 16 },
  'thermal-narrow-blur': { font: "'Ubuntu Mono', monospace", width: 330, paper: '#fdfcf8', ink: '#3a3a3a', size: 16, blur: 0.8, bg: '#8a8f94', rotate: -2 },
  'thermal-narrow-rotated': { font: "'DejaVu Sans Mono', monospace", width: 340, paper: '#fffef9', ink: '#2e2e2e', size: 14, bg: '#6b5a48', rotate: 4, crumple: true },
  'thermal-blur': { font: "'DejaVu Sans Mono', monospace", width: 380, paper: '#f6f4ee', ink: '#444', size: 15, blur: 0.9, bg: '#2f3338', rotate: 1.5 },
  laser: { font: "'Ubuntu', sans-serif", width: 470, paper: '#ffffff', ink: '#111', size: 15 },
  'laser-rotated': { font: "'Ubuntu', sans-serif", width: 450, paper: '#ffffff', ink: '#1a1a1a', size: 15, bg: '#c9c4ba', rotate: -3.5 },
  faded: { font: "'DejaVu Sans Mono', monospace", width: 370, paper: '#f3efe4', ink: '#8a8580', size: 15, bg: '#d8d3c8', rotate: 0.8 },
  'photo-wood': { font: "'DejaVu Sans Mono', monospace", width: 360, paper: '#fbf9f2', ink: '#2a2a2a', size: 14, bg: 'repeating-linear-gradient(92deg,#8b5e3c 0 14px,#946746 14px 30px,#7f5434 30px 41px)', rotate: -2.5, crumple: true, blur: 0.4 },
  'photo-dark': { font: "'Ubuntu Mono', monospace", width: 360, paper: '#f4f1ea', ink: '#2c2c2c', size: 16, bg: '#1f2226', rotate: 2.2, crumple: true, blur: 0.5 },
  'photo-dark-crumple': { font: "'DejaVu Sans Mono', monospace", width: 370, paper: '#f7f5ef', ink: '#333', size: 14, bg: '#24282c', rotate: -1.2, crumple: true, blur: 0.6 },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function receiptHtml(r) {
  const reg = REGIONS[r.region];
  const st = STYLES[r.style];
  const money = (c) => (c < 0 ? '-' : '') + fmtMoney(Math.abs(c), r.region);
  const sub = r.items.reduce((s, [, q, p]) => s + q * p, 0);
  const { lines, total } = r.calc(sub);
  const anyQty = r.items.some(([, q]) => q > 1);
  const row = (l, rr, cls = '') => `<div class="row ${cls}"><span>${esc(l)}</span><span>${esc(rr)}</span></div>`;
  const itemRows = r.items
    .map(([n, q, p]) => (q > 1 ? row(`${q} x ${n}`, money(q * p)) + `<div class="sub">@ ${money(p)} each</div>` : row(n, money(p))))
    .join('');
  const sumRows = lines.map(([l, c, kind]) => row(l, money(c), kind === 'note' ? 'note' : '')).join('');
  const cashMatch = /^Cash (\S)?([\d,.]+)$/.exec(r.pay);
  const payRows = cashMatch
    ? row('Cash', money(Math.round(Number(cashMatch[2].replace(/,/g, '')) * 100))) + row('Change', money(Math.round(Number(cashMatch[2].replace(/,/g, '')) * 100) - total))
    : row(r.pay, money(total));
  const bg = st.bg ?? '#e9e7e2';
  const crumple = st.crumple
    ? `background-image: linear-gradient(115deg, rgba(0,0,0,.05) 0 18%, rgba(255,255,255,.35) 22%, rgba(0,0,0,.04) 40%, rgba(255,255,255,.3) 55%, rgba(0,0,0,.06) 72%, rgba(255,255,255,.25) 85%), linear-gradient(200deg, rgba(0,0,0,.05), rgba(255,255,255,0) 40%, rgba(0,0,0,.05));`
    : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%}
  body{background:${bg};display:flex;align-items:center;justify-content:center}
  .r{width:${st.width}px;background-color:${st.paper};${crumple}color:${st.ink};font-family:${st.font};font-size:${st.size}px;line-height:1.45;
     padding:28px 24px 34px;box-shadow:0 6px 24px rgba(0,0,0,.35);transform:rotate(${st.rotate ?? 0}deg);filter:blur(${st.blur ?? 0}px)}
  .c{text-align:center}.b{font-weight:700}.big{font-size:1.35em;letter-spacing:.04em}
  .row{display:flex;justify-content:space-between;gap:12px}.sub{padding-left:1.4em;font-size:.9em;opacity:.85}
  .note{font-size:.92em;opacity:.85}.hr{border-top:1px dashed currentColor;margin:8px 0;opacity:.7}
  .tot{font-weight:700;font-size:1.2em}
  </style></head><body><div id="r" class="r">
  <div class="c b big">${esc(r.merchant)}</div>
  ${r.addr.map((a) => `<div class="c">${esc(a)}</div>`).join('')}
  <div class="hr"></div>
  ${row(showDate(r.date, r.dfmt), r.time)}
  ${row('Receipt #' + r.receiptNo, 'Till 2')}
  <div class="hr"></div>
  ${itemRows}
  <div class="hr"></div>
  ${sumRows}
  ${row('TOTAL', reg.sym + money(total), 'tot')}
  <div class="hr"></div>
  ${payRows}
  ${anyQty ? row('Items', String(r.items.length)) : ''}
  <div class="c" style="margin-top:14px">Thank you, come again!</div>
  </div></body></html>`;
  return { html, total };
}

function screenshot(html, width, height) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'moni-receipt-'));
  const page = path.join(tmp, 'page.html');
  const png = path.join(tmp, 'shot.png');
  fs.writeFileSync(page, html);
  execFileSync(SHELL, ['--no-sandbox', '--hide-scrollbars', '--disable-gpu', '--force-device-scale-factor=2', `--screenshot=${png}`, `--window-size=${width},${height}`, `file://${page}`], { stdio: 'ignore' });
  return { png, cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }) };
}

async function buildSynthetic() {
  let n = 0;
  for (const r of SYNTH) {
    r.receiptNo = String(100000 + ((n++ * 7919 + 1237) % 900000));
    const { html, total } = receiptHtml(r);
    const st = STYLES[r.style];
    const rows = 1.4 + r.addr.length + 2 + r.items.length + r.items.filter(([, q]) => q > 1).length + r.calc(1000).lines.length + 6;
    const height = Math.round(rows * st.size * 1.45 + 260);
    const { png, cleanup } = screenshot(html, st.width + 180, Math.max(600, height));
    const file = `synthetic-${r.id}.jpg`;
    await toJpeg(png, path.join(IMAGES, file));
    cleanup();
    const reg = REGIONS[r.region];
    add({
      id: `receipt-synthetic-${r.id}`,
      input: { image: `images/${file}`, wallets: WALLETS[r.region], clientNow: clientNow(r.date, reg.offset, 1), timezone: reg.tz },
      expected: { status: 'ok', amount: total / 100, currency: reg.currency, type: 'expense', merchant: r.merchant, date: r.date, itemCount: r.items.length },
      metadata: { source: 'synthetic-render', licence: 'own', trainable: true, synthetic: true, region: r.region, tags: ['render', r.style, ...r.tags] },
    });
  }
}

// ---------------------------------------------------------------- Negatives (not receipts)
const NEGATIVES = [
  {
    id: 'menu', tags: ['menu', 'prices'],
    html: `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#2d2a26;display:flex;align-items:center;justify-content:center;height:100%}
    .m{width:520px;background:#f5ecd9;color:#3b2a1a;font-family:'Ubuntu',sans-serif;padding:36px 40px;transform:rotate(-1.5deg);box-shadow:0 8px 30px rgba(0,0,0,.5)}
    h1{text-align:center;font-family:'DejaVu Serif',serif;margin:0 0 4px}h2{border-bottom:1px solid #b9a27e;font-size:18px;margin:22px 0 8px}
    .r{display:flex;justify-content:space-between;margin:6px 0}.d{font-size:13px;color:#6b5a45;margin-top:-4px}</style></head><body><div class="m">
    <h1>The Olive Branch</h1><div style="text-align:center;font-size:14px">Dinner Menu · Served 5pm – 10pm</div>
    <h2>Starters</h2><div class="r"><span>Burrata &amp; Heirloom Tomato</span><span>14</span></div><div class="d">basil oil, sea salt, grilled bread</div>
    <div class="r"><span>Crispy Calamari</span><span>13</span></div><div class="d">lemon aioli</div>
    <div class="r"><span>Soup of the Day</span><span>9</span></div>
    <h2>Mains</h2><div class="r"><span>Pan-Roasted Salmon</span><span>28</span></div><div class="d">fennel, citrus beurre blanc</div>
    <div class="r"><span>Wild Mushroom Risotto</span><span>22</span></div><div class="r"><span>Braised Short Rib</span><span>31</span></div>
    <div class="r"><span>Chicken Milanese</span><span>24</span></div>
    <h2>Desserts</h2><div class="r"><span>Tiramisu</span><span>10</span></div><div class="r"><span>Lemon Tart</span><span>9</span></div>
    <div style="margin-top:22px;font-size:12px;text-align:center">Please inform your server of any allergies.</div></div></body></html>`,
  },
  {
    id: 'blank-page', tags: ['blank'],
    html: `<!doctype html><html><head><style>body{margin:0;background:#5d6166;display:flex;align-items:center;justify-content:center;height:100%}
    .p{width:470px;height:660px;background:linear-gradient(160deg,#fbfbf8,#eeede7);transform:rotate(2deg);box-shadow:0 8px 28px rgba(0,0,0,.45)}</style></head>
    <body><div class="p"></div></body></html>`,
  },
  {
    id: 'product-photo', tags: ['product', 'price-tag'],
    html: `<!doctype html><html><head><meta charset="utf-8"><style>html{height:100%}body{margin:0;height:100%;background:linear-gradient(#dfe6ea 0 62%,#b8a58c 62%);position:relative;overflow:hidden;font-family:'Ubuntu',sans-serif}
    .mug{position:absolute;left:250px;top:420px;width:220px;height:250px;background:linear-gradient(90deg,#1f6f8b,#3aa0c2 45%,#1b5f77);border-radius:0 0 40px 40px;box-shadow:12px 18px 30px rgba(0,0,0,.35)}
    .handle{position:absolute;left:450px;top:470px;width:90px;height:120px;border:22px solid #2a87a6;border-left:none;border-radius:0 60px 60px 0}
    .rim{position:absolute;left:250px;top:405px;width:220px;height:36px;border-radius:50%;background:#16536a}
    .tag{position:absolute;left:520px;top:690px;background:#fff;padding:10px 16px;border-radius:6px;transform:rotate(8deg);box-shadow:0 3px 8px rgba(0,0,0,.3);font-size:18px}
    .brand{position:absolute;left:300px;top:540px;color:#e8f6fb;font-size:26px;font-weight:700;letter-spacing:.1em}</style></head><body>
    <div class="handle"></div><div class="mug"></div><div class="rim"></div><div class="brand">MORNING</div><div class="tag">Ceramic Mug 350ml<br><b>$12.99</b></div></body></html>`,
  },
];

async function buildNegatives() {
  for (const n of NEGATIVES) {
    const { png, cleanup } = screenshot(n.html, 760, 1000);
    const file = `negative-${n.id}.jpg`;
    await toJpeg(png, path.join(IMAGES, file));
    cleanup();
    add({
      id: `receipt-negative-${n.id}`,
      input: { image: `images/${file}`, wallets: WALLETS.US },
      expected: { status: 'skipped' },
      metadata: { source: 'synthetic-render', licence: 'own', trainable: true, synthetic: true, region: 'global', tags: ['negative', ...n.tags] },
    });
  }
}

// ---------------------------------------------------------------- main
fs.mkdirSync(IMAGES, { recursive: true });
fs.writeFileSync(path.join(SUITE, '.gitignore'), '# SROIE images: licence unclear, downloaded by evals/scripts/build-receipts.mjs\n/.cache/\n');
await buildSroie();
await buildCord();
await buildBench();
await buildSynthetic();
await buildNegatives();

const ids = new Set();
for (const it of items) {
  if (ids.has(it.id)) throw new Error(`duplicate id ${it.id}`);
  ids.add(it.id);
  if (!fs.existsSync(path.join(SUITE, it.input.image))) throw new Error(`missing image ${it.input.image}`);
}
items.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(path.join(SUITE, 'items.jsonl'), items.map((it) => JSON.stringify(it)).join('\n') + '\n');

const dirSize = (dir) => fs.readdirSync(dir).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
const counts = {};
for (const it of items) {
  const slice = it.metadata.tags.includes('negative') ? 'negative' : it.metadata.source;
  counts[slice] = (counts[slice] ?? 0) + 1;
}
console.log('items per source:', counts, 'total:', items.length);
console.log(`images/: ${(dirSize(IMAGES) / 1e6).toFixed(2)} MB committed; .cache/: ${(dirSize(CACHE) / 1e6).toFixed(2)} MB (gitignored)`);
