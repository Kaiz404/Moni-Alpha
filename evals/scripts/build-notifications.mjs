#!/usr/bin/env node
// Builds evals/datasets/notifications/items.jsonl. Rerun with `node evals/scripts/build-notifications.mjs`.
// Public sources are fetched at pinned revisions, checked by SHA-256 and cached in the OS temp dir.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const EVALS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(EVALS, 'datasets', 'notifications', 'items.jsonl');
const WALLETS = JSON.parse(fs.readFileSync(path.join(EVALS, 'datasets', 'wallets.json'), 'utf8'));
const SMS_APP = 'com.google.android.apps.messaging';

// Fixed seed: card endings and reference numbers come out the same on every build.
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261120);
const digits = (n) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join('');

const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Indian grouping: 120000 -> 1,20,000.00
const lakh = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lakhWhole = (n) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

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

// Reads one stored or deflated entry out of a zip archive.
function unzipEntry(zip, name) {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let p = zip.readUInt32LE(eocd + 16);
  const count = zip.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const entry = zip.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    if (entry === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      return method === 0 ? data : zlib.inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`zip has no ${name}`);
}

const items = [];
function add({ id, region, pkg, title, text, bigText, expected, source, licence, trainable, synthetic, tags }) {
  const notification = { packageName: pkg, title, text };
  if (bigText) notification.bigText = bigText;
  items.push({
    id,
    input: { notification, wallets: WALLETS[region] },
    expected,
    metadata: { source, licence, trainable, synthetic, region, tags },
  });
}

// ---------------------------------------------------------------------------
// Synthetic positives. Each bank template renders the alert from slots; the gold comes from the
// same slots. `wallet` is set only where the alert itself names the user's wallet in wallets.json.
// ---------------------------------------------------------------------------

const T = {
  chaseDebit: {
    region: 'US', bank: 'chase', pkg: 'com.chase.sig.android', wallet: 'w-us-bank',
    render: (s) => ({ title: 'Chase', text: `You made a $${money(s.amount)} debit card transaction with your account ending in ${s.last4} to ${s.raw}.` }),
  },
  chaseZelleIn: {
    region: 'US', bank: 'chase', pkg: 'com.chase.sig.android', wallet: 'w-us-bank',
    render: (s) => ({ title: 'Chase', text: `You received $${money(s.amount)} from ${s.raw} through Zelle®. It's in your account ending in ${s.last4}.` }),
  },
  chaseAtm: {
    region: 'US', bank: 'chase', pkg: 'com.chase.sig.android', wallet: 'w-us-bank', toWallet: 'w-us-cash',
    render: (s) => ({ title: 'Chase', text: `You withdrew $${money(s.amount)} from a Chase ATM with your debit card ending in ${s.last4}.` }),
  },
  chaseDeposit: {
    region: 'US', bank: 'chase', pkg: 'com.chase.sig.android', wallet: 'w-us-bank',
    render: (s) => ({ title: 'Chase', text: `A $${money(s.amount)} direct deposit from ${s.raw} posted to your account ending in ${s.last4}.` }),
  },
  bofaDebit: {
    region: 'US', bank: 'bofa', pkg: 'com.infonow.bofa',
    render: (s) => ({ title: 'Bank of America', text: `A $${money(s.amount)} purchase at ${s.raw} was made with your debit card ending in ${s.last4}.` }),
  },
  bofaBill: {
    region: 'US', bank: 'bofa', pkg: 'com.infonow.bofa',
    render: (s) => ({ title: 'Bank of America', text: `Your Bill Pay payment of $${money(s.amount)} to ${s.raw} was sent from your checking account ending in ${s.last4}.` }),
  },
  amexCharge: {
    region: 'US', bank: 'amex', pkg: 'com.americanexpress.android.acctsvcs.us', wallet: 'w-us-credit',
    render: (s) => ({ title: 'American Express', text: `A charge of $${money(s.amount)} at ${s.raw} was approved on your Gold Card ending in ${s.last5}.` }),
  },
  amexCredit: {
    region: 'US', bank: 'amex', pkg: 'com.americanexpress.android.acctsvcs.us', wallet: 'w-us-credit',
    render: (s) => ({ title: 'American Express', text: `A refund of $${money(s.amount)} from ${s.raw} was credited to your Gold Card ending in ${s.last5}.` }),
  },
  capOne: {
    region: 'US', bank: 'capitalone', pkg: 'com.konylabs.capitalone',
    render: (s) => ({ title: 'Capital One', text: `A transaction of $${money(s.amount)} was charged to your Quicksilver card ending in ${s.last4} at ${s.raw}.` }),
  },
  venmoIn: {
    region: 'US', bank: 'venmo', pkg: 'com.venmo', wallet: 'w-us-ewallet',
    render: (s) => ({ title: 'Venmo', text: `${s.raw} paid you $${money(s.amount)} ${s.note}` }),
  },
  cashAppIn: {
    region: 'US', bank: 'cashapp', pkg: 'com.squareup.cash',
    render: (s) => ({ title: 'Cash App', text: `${s.raw} sent you $${s.amount} for "${s.note}"` }),
  },
  paypalUs: {
    region: 'US', bank: 'paypal', pkg: 'com.paypal.android.p2pmobile',
    render: (s) => ({ title: 'PayPal', text: `You paid $${money(s.amount)} USD to ${s.raw}.` }),
  },
  monzoSpend: {
    region: 'UK', bank: 'monzo', pkg: 'co.uk.getmondo', wallet: 'w-uk-bank',
    render: (s) => ({ title: s.raw, text: `You spent £${money(s.amount)} ${s.emoji}` }),
  },
  monzoForeign: {
    region: 'UK', bank: 'monzo', pkg: 'co.uk.getmondo', wallet: 'w-uk-bank',
    render: (s) => ({ title: s.raw, text: `You spent €${money(s.amount)} (£${money(s.gbp)}) ${s.emoji}` }),
  },
  monzoIn: {
    region: 'UK', bank: 'monzo', pkg: 'co.uk.getmondo', wallet: 'w-uk-bank',
    render: (s) => ({ title: 'Monzo', text: `${s.raw} sent you £${money(s.amount)}${s.note ? ` ${s.note}` : ''}` }),
  },
  revolutEur: {
    region: 'UK', bank: 'revolut', pkg: 'com.revolut.revolut',
    render: (s) => ({ title: 'Revolut', text: `Paid €${money(s.amount)} at ${s.raw}` }),
  },
  barclaysDd: {
    region: 'UK', bank: 'barclays', pkg: 'com.barclays.android.barclaysmobilebanking',
    render: (s) => ({ title: 'Barclays', text: `Your Direct Debit of £${money(s.amount)} to ${s.raw} has been paid from your current account ending ${s.last4}.` }),
  },
  paypalUk: {
    region: 'UK', bank: 'paypal', pkg: 'com.paypal.android.p2pmobile', wallet: 'w-uk-ewallet',
    render: (s) => ({ title: 'PayPal', text: `You've paid £${money(s.amount)} GBP to ${s.raw}.` }),
  },
  commbankSpend: {
    region: 'AU', bank: 'commbank', pkg: 'com.commbank.netbank', wallet: 'w-au-bank',
    render: (s) => ({ title: 'CommBank', text: `You've spent ${s.cur === 'AUD' ? '$' : `${s.cur} `}${money(s.amount)} at ${s.raw} with your card ending ${s.last4}.` }),
  },
  commbankRefund: {
    region: 'AU', bank: 'commbank', pkg: 'com.commbank.netbank', wallet: 'w-au-bank',
    render: (s) => ({ title: 'CommBank', text: `A refund of $${money(s.amount)} from ${s.raw} has been credited to your Smart Access account.` }),
  },
  rbcPurchase: {
    region: 'CA', bank: 'rbc', pkg: 'com.rbc.mobile.android', wallet: 'w-ca-bank',
    render: (s) => ({ title: 'RBC', text: `A purchase of $${money(s.amount)} was made at ${s.raw} using your RBC Client Card ending in ${s.last4}.` }),
  },
  rbcEtransferIn: {
    region: 'CA', bank: 'rbc', pkg: 'com.rbc.mobile.android', wallet: 'w-ca-bank',
    render: (s) => ({ title: 'INTERAC e-Transfer', text: `${s.raw} sent you $${money(s.amount)} and the money has been automatically deposited into your RBC Chequing account.` }),
  },
  rbcBill: {
    region: 'CA', bank: 'rbc', pkg: 'com.rbc.mobile.android', wallet: 'w-ca-bank',
    render: (s) => ({ title: 'RBC', text: `Your bill payment of $${money(s.amount)} to ${s.raw} from RBC Chequing was successful.` }),
  },
  hdfcUpiOut: {
    region: 'IN', bank: 'hdfc', pkg: 'com.snapwork.hdfc', wallet: 'w-in-bank',
    render: (s) => ({ title: 'HDFC Bank', text: `Rs.${lakh(s.amount)} debited from HDFC Bank A/c **${s.last4} on ${s.date} to VPA ${s.vpa} (${s.raw}). UPI Ref No ${s.ref}. Not you? Call 18002586161.` }),
  },
  hdfcCredit: {
    region: 'IN', bank: 'hdfc', pkg: 'com.snapwork.hdfc', wallet: 'w-in-bank',
    render: (s) => ({ title: 'HDFC Bank', text: `INR ${lakh(s.amount)} credited to HDFC Bank A/c XX${s.last4} on ${s.date} by ${s.via} from ${s.raw}. Avl Bal INR ${lakh(s.balance)}.` }),
  },
  hdfcAtm: {
    region: 'IN', bank: 'hdfc', pkg: 'com.snapwork.hdfc', wallet: 'w-in-bank', toWallet: 'w-in-cash',
    render: (s) => ({ title: 'HDFC Bank', text: `Rs.${lakh(s.amount)} withdrawn at ATM ${s.raw} from A/c XX${s.last4} on ${s.date}. Avl Bal Rs.${lakh(s.balance)}.` }),
  },
  iciciCard: {
    region: 'IN', bank: 'icici', pkg: 'com.csam.icici.bank.imobile', wallet: 'w-in-credit',
    render: (s) => ({ title: 'ICICI Bank', text: `INR ${lakh(s.amount)} spent using ICICI Bank Credit Card XX${s.last4} on ${s.date} on ${s.raw}. Avl Limit: INR ${lakh(s.limit)}.` }),
  },
  iciciRefund: {
    region: 'IN', bank: 'icici', pkg: 'com.csam.icici.bank.imobile', wallet: 'w-in-credit',
    render: (s) => ({ title: 'ICICI Bank', text: `Refund of INR ${lakh(s.amount)} from ${s.raw} has been credited to your ICICI Bank Credit Card XX${s.last4}.` }),
  },
  paytmPaid: {
    region: 'IN', bank: 'paytm', pkg: 'net.one97.paytm', wallet: 'w-in-ewallet',
    render: (s) => ({ title: 'Paytm', text: `Paid ₹${lakhWhole(s.amount)} to ${s.raw} from Paytm Wallet` }),
  },
  paytmBill: {
    region: 'IN', bank: 'paytm', pkg: 'net.one97.paytm', wallet: 'w-in-ewallet',
    render: (s) => ({ title: 'Paytm', text: `Payment of ₹${lakh(s.amount)} for ${s.raw} electricity bill was successful. Order ID ${s.ref}.` }),
  },
  dbsCard: {
    region: 'SG', bank: 'dbs', pkg: 'com.dbs.sg.digibank', wallet: 'w-sg-bank',
    render: (s) => ({ title: 'DBS digibank', text: `Transaction Alert: SGD ${money(s.amount)} was spent on your DBS Visa Debit card ending ${s.last4} at ${s.raw}.` }),
  },
  dbsPaynowIn: {
    region: 'SG', bank: 'dbs', pkg: 'com.dbs.sg.digibank', wallet: 'w-sg-bank',
    render: (s) => ({ title: 'DBS digibank', text: `You have received SGD ${money(s.amount)} via PayNow from ${s.raw} to your account ending ${s.last4}.` }),
  },
  grabPay: {
    region: 'SG', bank: 'grabpay', pkg: 'com.grabtaxi.passenger', wallet: 'w-sg-ewallet',
    render: (s) => ({ title: 'GrabPay', text: `You paid S$${money(s.amount)} to ${s.raw} with your GrabPay Wallet.` }),
  },
  maybankVisa: {
    region: 'MY', bank: 'maybank', pkg: 'com.maybank2u.life', wallet: 'w-my-credit',
    render: (s) => ({ title: 'Maybank2u', text: `Your Maybank Visa card ending ${s.last4} was charged RM${money(s.amount)} at ${s.raw}.` }),
  },
  tngToll: {
    region: 'MY', bank: 'tng', pkg: 'my.com.tngdigital.ewallet', wallet: 'w-my-ewallet',
    render: (s) => ({ title: "Touch 'n Go eWallet", text: `Payment of RM ${money(s.amount)} to ${s.raw} was successful.` }),
  },
  cimbIn: {
    region: 'MY', bank: 'cimb', pkg: 'com.cimbmalaysia',
    render: (s) => ({ title: 'CIMB OCTO', text: `You've received RM ${money(s.amount)} from ${s.raw} via DuitNow. Ref: ${s.ref}.` }),
  },
  gcashIn: {
    region: 'PH', bank: 'gcash', pkg: 'com.globe.gcash.android', wallet: 'w-ph-ewallet',
    render: (s) => ({ title: 'GCash', text: `You have received PHP ${money(s.amount)} of GCash from ${s.raw} 0917${digits(7)}. Ref. No. ${s.ref}.` }),
  },
  gcashPaid: {
    region: 'PH', bank: 'gcash', pkg: 'com.globe.gcash.android', wallet: 'w-ph-ewallet',
    render: (s) => ({ title: 'GCash', text: `You have paid P${money(s.amount)} to ${s.raw}. Ref. No. ${s.ref}.` }),
  },
  bdoCard: {
    region: 'PH', bank: 'bdo', pkg: 'ph.com.bdo.retail', wallet: 'w-ph-bank',
    render: (s) => ({ title: 'BDO', text: `Your BDO Debit Card ending ${s.last4} was used for PHP ${money(s.amount)} at ${s.raw}.` }),
  },
};

const CUR = { US: 'USD', UK: 'GBP', AU: 'AUD', CA: 'CAD', IN: 'INR', SG: 'SGD', MY: 'MYR', PH: 'PHP' };

// [template, kind, type, slots, merchant (gold, null = unscored), tags]
const positives = [
  ['chaseDebit', 'purchase', 'expense', { amount: 6.45, raw: 'STARBUCKS STORE 08123' }, 'Starbucks', ['card']],
  ['chaseZelleIn', 'p2p-in', 'income', { amount: 250, raw: 'MIKE CHEN' }, 'Mike Chen', ['p2p', 'transfer-in']],
  ['chaseAtm', 'atm', 'transfer', { amount: 200 }, null, ['atm']],
  ['chaseDeposit', 'salary', 'income', { amount: 3148.62, raw: 'NORTHWIND LLC PAYROLL' }, 'Northwind', ['salary']],
  ['bofaDebit', 'purchase', 'expense', { amount: 63.2, raw: 'TARGET 00012345' }, 'Target', ['card']],
  ['bofaBill', 'bill', 'expense', { amount: 142.18, raw: 'Con Edison' }, 'Con Edison', ['bill']],
  ['amexCharge', 'purchase', 'expense', { amount: 412.6, raw: 'DELTA AIR LINES' }, 'Delta Air Lines', ['card']],
  ['amexCredit', 'refund', 'income', { amount: 34.99, raw: 'AMAZON.COM' }, 'Amazon', ['refund']],
  ['capOne', 'purchase', 'expense', { amount: 27.18, raw: 'CHIPOTLE 2231' }, 'Chipotle', ['card']],
  ['venmoIn', 'p2p-in', 'income', { amount: 40, raw: 'Sarah Lee', note: '🍕 pizza night' }, 'Sarah Lee', ['p2p', 'transfer-in']],
  ['cashAppIn', 'p2p-in', 'income', { amount: 25, raw: 'Alex Rivera', note: 'gas money' }, 'Alex Rivera', ['p2p', 'transfer-in']],
  ['paypalUs', 'purchase', 'expense', { amount: 59.99, raw: 'Etsy Inc.' }, 'Etsy', ['online']],

  ['monzoSpend', 'purchase', 'expense', { amount: 4.95, raw: 'Pret A Manger', emoji: '🥪' }, 'Pret A Manger', ['card']],
  ['monzoSpend', 'purchase', 'expense', { amount: 23.17, raw: 'Tesco', emoji: '🛒' }, 'Tesco', ['card']],
  // Monzo shows the card's currency and the pounds it settled at. Gold is the purchase as made: EUR.
  ['monzoForeign', 'foreign', 'expense', { amount: 45.2, gbp: 39.31, raw: 'Café de Flore', emoji: '☕', currency: 'EUR' }, 'Café de Flore', ['card', 'foreign-currency']],
  ['monzoIn', 'p2p-in', 'income', { amount: 30, raw: 'Emma Wilson', note: '🍻 Thanks for dinner' }, 'Emma Wilson', ['p2p', 'transfer-in']],
  ['monzoIn', 'salary', 'income', { amount: 2450, raw: 'BRIGHTWAVE LTD SALARY' }, 'Brightwave', ['salary']],
  ['revolutEur', 'foreign', 'expense', { amount: 18.5, raw: 'Lidl', currency: 'EUR' }, 'Lidl', ['card', 'foreign-currency']],
  ['barclaysDd', 'bill', 'expense', { amount: 42, raw: 'THAMES WATER' }, 'Thames Water', ['bill']],
  ['paypalUk', 'purchase', 'expense', { amount: 12.99, raw: 'Spotify' }, 'Spotify', ['online', 'subscription']],

  ['commbankSpend', 'purchase', 'expense', { amount: 42.8, raw: 'WOOLWORTHS 1234 SYDNEY', cur: 'AUD' }, 'Woolworths', ['card']],
  ['commbankSpend', 'foreign', 'expense', { amount: 29.99, raw: 'NETFLIX.COM', cur: 'USD', currency: 'USD' }, 'Netflix', ['card', 'foreign-currency', 'subscription']],
  ['commbankRefund', 'refund', 'income', { amount: 79, raw: 'JB HI-FI' }, 'JB Hi-Fi', ['refund']],

  ['rbcPurchase', 'purchase', 'expense', { amount: 18.75, raw: 'TIM HORTONS #4412' }, 'Tim Hortons', ['card']],
  ['rbcEtransferIn', 'p2p-in', 'income', { amount: 60, raw: 'PRIYA SHAH' }, 'Priya Shah', ['p2p', 'transfer-in']],
  ['rbcBill', 'bill', 'expense', { amount: 95.4, raw: 'ROGERS' }, 'Rogers', ['bill']],

  ['hdfcUpiOut', 'purchase', 'expense', { amount: 1249, raw: 'Swiggy', vpa: 'swiggy@icici', date: '12-11-26' }, 'Swiggy', ['upi']],
  ['hdfcUpiOut', 'purchase', 'expense', { amount: 185000, raw: 'TANISHQ', vpa: 'tanishq.retail@hdfcbank', date: '14-11-26' }, 'Tanishq', ['upi', 'lakh']],
  ['hdfcCredit', 'salary', 'income', { amount: 120000, raw: 'NIMBUS TECH PVT LTD SALARY NOV', via: 'NEFT', date: '01-11-26', balance: 184322.5 }, 'Nimbus Tech', ['salary', 'lakh']],
  ['hdfcCredit', 'p2p-in', 'income', { amount: 2500, raw: 'VPA rahul.k@okaxis RAHUL KUMAR', via: 'UPI', date: '15-11-26', balance: 66822.5 }, 'Rahul Kumar', ['upi', 'p2p', 'transfer-in']],
  ['hdfcAtm', 'atm', 'transfer', { amount: 10000, raw: 'S1ANBG21 MUMBAI', date: '16-11-26', balance: 56822.5 }, null, ['atm']],
  ['iciciCard', 'purchase', 'expense', { amount: 3499, raw: 'AMAZON', date: '14-Nov-26', limit: 152301 }, 'Amazon', ['card', 'lakh']],
  ['iciciRefund', 'refund', 'income', { amount: 899, raw: 'MYNTRA' }, 'Myntra', ['refund']],
  ['paytmPaid', 'purchase', 'expense', { amount: 250, raw: 'Chai Point' }, 'Chai Point', ['wallet']],
  ['paytmBill', 'bill', 'expense', { amount: 2340, raw: 'BSES Rajdhani' }, 'BSES Rajdhani', ['bill']],

  ['dbsCard', 'purchase', 'expense', { amount: 56.8, raw: 'NTUC FAIRPRICE' }, 'FairPrice', ['card']],
  ['dbsPaynowIn', 'p2p-in', 'income', { amount: 120, raw: 'WONG KAI MING' }, 'Wong Kai Ming', ['p2p', 'transfer-in']],
  ['grabPay', 'purchase', 'expense', { amount: 9.8, raw: 'Toast Box' }, 'Toast Box', ['wallet']],

  ['maybankVisa', 'purchase', 'expense', { amount: 128.4, raw: 'SHELL SS USJ 1' }, 'Shell', ['card']],
  ['tngToll', 'purchase', 'expense', { amount: 3.2, raw: 'PLUS Toll Sg Besi' }, 'PLUS', ['wallet', 'toll']],
  ['cimbIn', 'p2p-in', 'income', { amount: 300, raw: 'SITI NURHALIZA BT TARUDIN' }, 'Siti Nurhaliza', ['p2p', 'transfer-in']],

  ['gcashIn', 'p2p-in', 'income', { amount: 1500, raw: 'JUAN DELA CRUZ' }, 'Juan dela Cruz', ['p2p', 'transfer-in']],
  ['gcashPaid', 'purchase', 'expense', { amount: 245, raw: '7-ELEVEN' }, '7-Eleven', ['wallet']],
  ['gcashPaid', 'bill', 'expense', { amount: 1820.5, raw: 'MERALCO' }, 'Meralco', ['bill']],
  ['bdoCard', 'purchase', 'expense', { amount: 2350, raw: 'SM SUPERMARKET MEGAMALL' }, 'SM Supermarket', ['card']],
];

const counters = {};
for (const [name, kind, type, slots, merchant, tags] of positives) {
  const t = T[name];
  const s = { last4: digits(4), last5: digits(5), ref: digits(12), ...slots };
  const { title, text } = t.render(s);
  const expected = { status: 'ok', amount: s.amount, currency: s.currency ?? CUR[t.region], type };
  if (merchant) expected.merchant = merchant;
  if (t.wallet) expected.walletId = t.wallet;
  if (type === 'transfer' && t.toWallet) expected.toWalletId = t.toWallet;
  const key = `${t.region}-${t.bank}-${kind}`.toLowerCase();
  counters[key] = (counters[key] ?? 0) + 1;
  add({
    id: `notif-${key}-${String(counters[key]).padStart(3, '0')}`,
    region: t.region, pkg: t.pkg, title, text, expected,
    source: 'synthetic-template', licence: 'own', trainable: true, synthetic: true,
    tags: ['positive', kind, ...tags],
  });
}

// ---------------------------------------------------------------------------
// Hand-written negatives: alerts that carry money words or amounts but record nothing.
// ---------------------------------------------------------------------------
const SKIP = { status: 'skipped' };
const handNegatives = [
  ['US', 'chase-otp', 'com.chase.sig.android', 'Chase', `Chase: Your one-time code is ${digits(6)}. Don't share it. We'll never call to ask for it.`, ['otp']],
  ['US', 'amex-statement', 'com.americanexpress.android.acctsvcs.us', 'American Express', 'Your statement is ready. New balance: $1,284.55. Minimum payment of $40.00 is due Dec 12.', ['statement']],
  ['US', 'capitalone-declined', 'com.konylabs.capitalone', 'Capital One', `Your Quicksilver card ending in ${digits(4)} was declined for $212.40 at BEST BUY. Tap to review.`, ['declined']],
  ['US', 'cashapp-promo', 'com.squareup.cash', 'Cash App', 'Boost unlocked: get $5 off your next DoorDash order with Cash Card.', ['promo']],
  ['US', 'venmo-request', 'com.venmo', 'Venmo', 'Jordan Blake requested $30.00 for 🛒 groceries', ['request']],
  ['US', 'amazon-delivery', 'com.amazon.mShop.android.shopping', 'Arriving today', 'Your package with Anker USB-C Charger (order total $25.99) will arrive by 8 PM.', ['delivery']],
  ['UK', 'monzo-login', 'co.uk.getmondo', 'Monzo', 'New login to your Monzo account from Chrome on Windows in London. Not you? Tap to freeze your card.', ['login']],
  ['UK', 'barclays-upcoming-dd', 'com.barclays.android.barclaysmobilebanking', 'Barclays', 'A Direct Debit of £42.00 to THAMES WATER will be taken from your current account on 1 Dec.', ['reminder']],
  ['UK', 'revolut-login', 'com.revolut.revolut', 'Revolut', 'We noticed a sign-in from a new device (Pixel 9). If this wasn’t you, contact us in the app.', ['login']],
  ['AU', 'commbank-balance', 'com.commbank.netbank', 'CommBank', 'Your Smart Access balance is $1,842.10 as at 6:00am today.', ['balance']],
  ['CA', 'rbc-low-balance', 'com.rbc.mobile.android', 'RBC', 'Your RBC Chequing account balance has fallen below $100.00. Current balance: $86.42.', ['balance']],
  ['IN', 'hdfc-loan-promo', 'com.snapwork.hdfc', 'HDFC Bank', 'Pre-approved Personal Loan of Rs.5,00,000 at 10.5% p.a. is waiting for you. Tap to avail instantly. T&C apply.', ['promo', 'lakh']],
  ['IN', 'paytm-cashback', 'net.one97.paytm', 'Paytm', 'Pay your electricity bill and get up to ₹100 cashback! Offer valid till 30 Nov.', ['promo']],
  ['IN', 'icici-otp', 'com.csam.icici.bank.imobile', 'ICICI Bank', `OTP for txn of INR 3,499.00 at AMAZON on ICICI Bank Credit Card XX${digits(4)} is ${digits(6)}. Do not share OTP with anyone.`, ['otp']],
  ['SG', 'dbs-bill-due', 'com.dbs.sg.digibank', 'DBS digibank', 'Your DBS Live Fresh card bill of SGD 1,240.66 is due on 25 Nov 2026. Pay now to avoid late charges.', ['bill-due', 'statement']],
  ['SG', 'grabpay-failed', 'com.grabtaxi.passenger', 'GrabPay', 'Your top-up of S$50.00 to GrabPay Wallet was unsuccessful. You were not charged.', ['declined']],
  ['PH', 'lazada-delivery', 'com.lazada.android', 'Lazada', 'Your order #50128833 (₱1,299.00) is out for delivery today. Please prepare the exact amount for COD.', ['delivery']],
];
for (const [region, slug, pkg, title, text, tags] of handNegatives) {
  add({
    id: `notif-${region.toLowerCase()}-neg-${slug}`,
    region, pkg, title, text, expected: SKIP,
    source: 'moni-handwritten', licence: 'own', trainable: true, synthetic: true,
    tags: ['negative', ...tags],
  });
}

// ---------------------------------------------------------------------------
// UCI SMS Spam Collection (CC BY 4.0). Rows hand-screened; line numbers are 1-based in
// SMSSpamCollection. Hams that describe a real payment (lines 204, 1201, 1468) were left out.
// ---------------------------------------------------------------------------
const uciLines = unzipEntry(await fetchPinned(
  'https://archive.ics.uci.edu/static/public/228/sms+spam+collection.zip',
  '1587ea43e58e82b14ff1f5425c88e17f8496bfcdb67a583dbff9eefaf9963ce3',
), 'SMSSpamCollection').toString('utf8').split('\n');
const uciRows = [
  // [line, region, sender shown as the title, tags]
  [9, 'UK', '09061701461', ['spam', 'prize']],
  [35, 'UK', 'Ringtone UK', ['spam', 'subscription-offer']],
  [121, 'UK', '08719180248', ['spam', 'statement-lookalike']],
  [359, 'UK', '86688', ['spam', 'balance-lookalike']],
  [369, 'UK', 'Regal Portfolio', ['spam', 'promo']],
  [456, 'UK', '0800 1956669', ['spam', 'loan-offer']],
  [1493, 'UK', '80488', ['spam', 'credit-lookalike']],
  [1291, 'SG', 'Wei Ling', ['ham', 'price-quote']],
  [1401, 'IN', 'AD-ICICIB', ['ham', 'payee-registration', 'security']],
  [1678, 'UK', 'Sam', ['ham', 'price-quote']],
];
for (const [line, region, title, tags] of uciRows) {
  const [label, ...rest] = uciLines[line - 1].replace(/\r$/, '').split('\t');
  const text = rest.join('\t').trim().replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  if (!tags.includes(label)) throw new Error(`UCI line ${line} is ${label}, expected ${tags[0]}`);
  add({
    id: `notif-uci-sms-${String(line).padStart(4, '0')}`,
    region, pkg: SMS_APP, title, text, expected: SKIP,
    source: 'uci-sms-spam-collection', licence: 'CC-BY-4.0', trainable: true, synthetic: false,
    tags: ['negative', 'sms', ...tags],
  });
}

// ---------------------------------------------------------------------------
// finndot/finnai-slm-data-v4 (Apache-2.0), test_sms.jsonl at a pinned revision. Rows with empty
// gold from the generator templates (not the `parser/` rows, which are bank-parser fixtures).
// ---------------------------------------------------------------------------
const FINN_REV = '29b2911d52d245cbae78f525964f20b0a5071f9a';
const finn = (await fetchPinned(
  `https://huggingface.co/datasets/finndot/finnai-slm-data-v4/resolve/${FINN_REV}/test_sms.jsonl`,
  '8fe22a69c477b027bc779459893fe3c071bd44ab7398d975a9793a25c8536db0',
)).toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const finnPick = [
  ['1fc70a76b2ad45c0', ['declined', 'upi']],
  ['420e69c2600e52dd', ['declined', 'upi']],
  ['8e17217ed0b7a5d8', ['balance']],
  ['ed3a1c0ec8dadcf4', ['otp']],
  ['951bb67d785c2adf', ['promo']],
];
for (const [rowId, tags] of finnPick) {
  const row = finn.find((r) => r.id === rowId);
  if (!row) throw new Error(`finndot row ${rowId} missing`);
  if (row.template_id.startsWith('parser/') || (row.gold && Object.keys(row.gold).length)) {
    throw new Error(`finndot row ${rowId} is not an empty-gold generator row`);
  }
  add({
    id: `notif-finndot-${row.template_id.replace(/_/g, '-')}-${rowId}`,
    region: 'IN', pkg: SMS_APP, title: row.sender, text: row.sms, expected: SKIP,
    source: 'finndot/finnai-slm-data-v4', licence: 'Apache-2.0', trainable: true, synthetic: true,
    tags: ['negative', 'sms', ...tags],
  });
}

// ---------------------------------------------------------------------------
// moni-bench: the notification cases from apps/backend/internal/extract/bench_test.go and five
// English codes from testdata/one_time_codes.json. Bench wallets map to the MY wallet ids.
// ---------------------------------------------------------------------------
const MAYBANK = 'com.maybank2u.life';
const TNG = 'my.com.tngdigital.ewallet';
const bench = [
  // [slug, pkg, title, text, expected]
  ['card-purchase', MAYBANK, 'Maybank2u: Card Purchase', 'You have made a purchase of RM 23.90 at FAMILYMART KLCC with your card ending 4821.',
    // "card ending 4821" could be the Maybank debit card or the Maybank Visa, so no wallet.
    { amount: 23.9, type: 'expense', currency: 'MYR', merchant: 'FamilyMart' }],
  ['duitnow-received', TNG, "You've received money!", 'ALI BIN ABU has transferred RM 15.00 to you. Tap here to check the transaction details.',
    { amount: 15, type: 'income', currency: 'MYR', merchant: 'Ali bin Abu', walletId: 'w-my-ewallet' }],
  ['tng-merchant-payment', TNG, 'Payment successful', 'You have paid RM 6.50 to ZUS COFFEE SUNWAY.',
    { amount: 6.5, type: 'expense', currency: 'MYR', merchant: 'ZUS Coffee', walletId: 'w-my-ewallet' }],
  ['duitnow-sent', MAYBANK, 'DuitNow Transfer', 'You have successfully transferred RM 150.00 to AHMAD BIN ALI.',
    { amount: 150, type: 'expense', currency: 'MYR', merchant: 'Ahmad bin Ali', walletId: 'w-my-bank' }],
  ['salary-credited', MAYBANK, 'Money In', 'You have received RM 2,500.00 from SYARIKAT ABC SDN BHD into your account ending 1234.',
    { amount: 2500, type: 'income', currency: 'MYR', merchant: 'Syarikat ABC', walletId: 'w-my-bank' }],
  ['grabfood', 'com.grabtaxi.passenger', 'GrabFood', "Your order from McDonald's Bangsar is on the way. RM 32.70 paid with GrabPay.",
    { amount: 32.7, type: 'expense', currency: 'MYR', merchant: "McDonald's" }],
  ['refund-in', 'com.lazada.android', 'Refund processed', 'Refund of RM 25.00 for order 8829 has been credited to your Lazada Wallet.',
    { amount: 25, type: 'income', currency: 'MYR', merchant: 'Lazada' }],
  ['foreign-currency', 'com.transferwise.android', 'Wise', 'You spent 12.00 USD at AMAZON WEB SERVICES.',
    { amount: 12, type: 'expense', currency: 'USD', merchant: 'Amazon Web Services' }],
  ['malay-payment', MAYBANK, 'Maybank2u', 'Anda telah membuat pembayaran RM 12.00 kepada KEDAI MAKAN ALI.',
    { amount: 12, type: 'expense', currency: 'MYR', merchant: 'Kedai Makan Ali', walletId: 'w-my-bank' }],
  ['promotion', TNG, 'Weekend deal', 'Enjoy 20% cashback up to RM 10 on Shopee this weekend! T&C apply.', null],
  ['balance-snapshot', MAYBANK, 'Balance update', 'Your available balance is RM 1,204.50 as of 07 Oct.', null],
  ['bill-due', 'com.tnb.mytnb', 'Bill reminder', 'Your TNB bill of RM 120.35 is due on 15 Oct. Pay now to avoid disconnection.', null],
  ['failed-payment', TNG, 'Payment failed', 'Your payment of RM 45.00 to GRAB was unsuccessful. No money was deducted.', null],
  ['shipping-update', 'com.shopee.my', 'Order shipped', 'Your order 220931 (RM 89.00) has been shipped and will arrive in 2 days.', null],
];
for (const [slug, pkg, title, text, want] of bench) {
  const tags = want ? ['positive'] : ['negative'];
  if (slug === 'malay-payment') tags.push('malay');
  add({
    id: `notif-bench-${slug}`,
    region: 'MY', pkg, title, text,
    expected: want ? { status: 'ok', ...want } : SKIP,
    source: 'moni-bench', licence: 'own', trainable: true, synthetic: true,
    tags,
  });
}

const otpCorpus = JSON.parse(fs.readFileSync(
  path.resolve(EVALS, '..', 'apps', 'backend', 'internal', 'extract', 'testdata', 'one_time_codes.json'), 'utf8'));
const otpPick = [
  ['Maybank TAC quoting an amount', 'maybank-tac'],
  ['CIMB TAC, DuitNow', 'cimb-tac-duitnow'],
  ['Hong Leong OTP', 'hlb-otp'],
  ['UOB one-time passcode', 'uob-passcode'],
  ['card 3D Secure code', 'card-3ds'],
];
for (const [name, slug] of otpPick) {
  const c = otpCorpus.codes.find((x) => x.name === name);
  if (!c) throw new Error(`one_time_codes.json has no "${name}"`);
  add({
    id: `notif-bench-otp-${slug}`,
    region: 'MY', pkg: SMS_APP, title: c.title, text: c.text, bigText: c.bigText, expected: SKIP,
    source: 'moni-bench', licence: 'own', trainable: true, synthetic: true,
    tags: ['negative', 'otp', 'amount-in-code'],
  });
}

items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const ids = new Set(items.map((i) => i.id));
if (ids.size !== items.length) throw new Error('duplicate ids');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, items.map((i) => JSON.stringify(i)).join('\n') + '\n');

const tally = {};
for (const i of items) {
  const k = `${i.metadata.source} ${i.expected.status}`;
  tally[k] = (tally[k] ?? 0) + 1;
}
console.log(`wrote ${items.length} items to ${path.relative(process.cwd(), OUT)}`);
console.table(tally);
