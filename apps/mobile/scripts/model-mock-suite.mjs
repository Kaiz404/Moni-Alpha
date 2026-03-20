import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { passesNotificationTransactionPrefilter } = require('./notification-filter.js');

// Mocked model-level suite: injects a deterministic mocked LLM output
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function randomInt(rand, min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick(rand, list) {
  return list[randomInt(rand, 0, list.length - 1)];
}

const txApps = ['Kuda Bank','GTBank','Opay Wallet','PalmPay','Moniepoint','Revolut','PayPal','Chime Bank','Wise','Access Bank'];
const nonTxApps = ['Instagram','Gmail','YouTube','Weather','Calendar','News','Slack','Discord','Spotify','Google Photos'];
const currencies = ['USD','NGN','EUR','INR','KES','GHS'];
const merchants = ['Netflix','Amazon','Uber','Jumia','AirtimeTopup','DSTV'];
const counterparties = ['John','Acme Ltd','Jane','Bright Oil','MegaStore','Utility Co'];

function buildTxNotification(rand, idx) {
  const app = pick(rand, txApps);
  const amount = randomInt(rand, 5, 5000);
  const currency = pick(rand, currencies);
  const counterparty = pick(rand, counterparties);
  const merchant = pick(rand, merchants);
  const income = rand() > 0.5;
  const text = income
    ? `Your account has been credited with ${amount} ${currency} from ${counterparty}.`
    : `You paid ${amount} ${currency} to ${merchant}. Available balance updated.`;
  return { id: `tx-${idx}`, app, title: income ? 'Credit Alert' : 'Debit Alert', titleBig: '', text, bigText: text, subText: '', summaryText: '', extraInfoText: '', time: new Date().toISOString(), receivedAt: new Date().toISOString() };
}

function buildNonTxNotification(rand, idx) {
  const app = pick(rand, nonTxApps);
  const shape = randomInt(rand, 0, 3);
  if (shape === 0) return { id: `notx-${idx}`, app, title: 'Promo Offer', titleBig: '', text: 'Get 50% off premium today. Limited time offer.', bigText: '', subText: '', summaryText: '', extraInfoText: '', time: new Date().toISOString(), receivedAt: new Date().toISOString() };
  if (shape === 1) return { id: `notx-${idx}`, app: pick(rand, txApps), title: 'Security Alert', titleBig: '', text: 'Your OTP is 937521. Do not share with anyone.', bigText: '', subText: '', summaryText: '', extraInfoText: '', time: new Date().toISOString(), receivedAt: new Date().toISOString() };
  if (shape === 2) return { id: `notx-${idx}`, app: pick(rand, txApps), title: 'Balance Reminder', titleBig: '', text: 'Your current balance is healthy. Tap to open app.', bigText: '', subText: '', summaryText: '', extraInfoText: '', time: new Date().toISOString(), receivedAt: new Date().toISOString() };
  return { id: `notx-${idx}`, app, title: 'Message Received', titleBig: '', text: `John sent you a photo at 12:45 PM`, bigText: '', subText: '', summaryText: '', extraInfoText: '', time: new Date().toISOString(), receivedAt: new Date().toISOString() };
}

// Mocked LLM generateFn — returns object matching notificationSchema used by analyzer
function mockGenerateFn(notification) {
  const text = (notification.bigText || notification.text || '').toLowerCase();
  if (/(credited|credit|you paid|paid)/.test(text)) {
    return {
      object: {
        is_transaction: true,
        reasoning: 'Mock LLM: matched credit/debit keywords',
        confidence: 0.9,
        amount: 100,
        currency: 'USD',
        type: text.includes('credit') ? 'income' : 'expense',
        merchant: text.includes('to') ? 'MockMerchant' : null,
        description: null,
        wallet_hint: 'Mock Wallet',
        category_hint: null,
        transaction_date: new Date().toISOString(),
      }
    };
  }
  return { object: { is_transaction: false, reasoning: 'Mock LLM: not a transaction' } };
}

async function run() {
  const rand = lcg(20260320);
  const totalTx = 500;
  const totalNonTx = 500;
  let tp=0, fn=0, tn=0, fp=0, modelApproved=0;

  for (let i=0;i<totalTx;i++){
    const n = buildTxNotification(rand,i);
    const pre = passesNotificationTransactionPrefilter(n);
    if (!pre) { fn++; continue; }
    const model = mockGenerateFn(n).object;
    if (model.is_transaction) { modelApproved++; tp++; } else { fn++; }
  }
  for (let i=0;i<totalNonTx;i++){
    const n = buildNonTxNotification(rand,i);
    const pre = passesNotificationTransactionPrefilter(n);
    if (!pre) { tn++; continue; }
    const model = mockGenerateFn(n).object;
    if (!model.is_transaction) { tn++; } else { fp++; modelApproved++; }
  }

  const total = totalTx + totalNonTx;
  console.log('Model-level mock suite results:', { total, tp, fn, tn, fp, modelApproved });
}

run().catch((e)=>{ console.error(e); process.exit(1); });
