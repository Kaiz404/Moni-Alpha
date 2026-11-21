import { describe, expect, it } from 'vitest';
import {
  currencyChoices,
  parseBalance,
  phoneLinkMail,
  searchCurrencies,
  setupChecklist,
  showsChecklist,
  showsGetApp,
  suggestedCurrency,
  walletsReady,
  walletsToCreate,
  type WalletDraft,
} from '../setup';

describe('the main currency', () => {
  it('suggests from the language region, else the time zone, else nothing', () => {
    expect(suggestedCurrency('en-MY', 'Europe/London')).toBe('MYR');
    expect(suggestedCurrency('en-US', 'Asia/Kuala_Lumpur')).toBe('USD');
    expect(suggestedCurrency('en', 'Asia/Kuala_Lumpur')).toBe('MYR');
    expect(suggestedCurrency('en', 'Antarctica/Troll')).toBeNull();
  });

  it('names each current currency in sentence case with its symbol, by name', () => {
    expect(currencyChoices(['USD', 'MYR', 'XAU', 'HKD', 'EUR'])).toEqual([
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'HKD', name: 'Hong Kong dollar', symbol: 'HK$' },
      { code: 'MYR', name: 'Malaysian ringgit', symbol: 'RM' },
      { code: 'USD', name: 'US dollar', symbol: 'US$' },
    ]);
  });

  it('finds a currency by its code, its name or a country', () => {
    const choices = currencyChoices(['USD', 'MYR', 'SGD', 'EUR']);
    expect(searchCurrencies(choices, 'sgd').map((c) => c.code)).toEqual(['SGD']);
    expect(searchCurrencies(choices, 'ringgit').map((c) => c.code)).toEqual(['MYR']);
    expect(searchCurrencies(choices, 'malaysia').map((c) => c.code)).toEqual(['MYR']);
    expect(searchCurrencies(choices, 'germany').map((c) => c.code)).toEqual(['EUR']);
    expect(searchCurrencies(choices, '  ').map((c) => c.code)).toEqual(['EUR', 'MYR', 'SGD', 'USD']);
  });
});

describe('wallets', () => {
  const draft = (name: string, balance: string, kind: WalletDraft['kind'] = 'bank', currency = 'MYR'): WalletDraft => ({ key: name, name, kind, currency, balance });

  it('reads a starting balance as typed, and refuses what is not money', () => {
    expect(parseBalance('2,281.80')).toBe(228180);
    expect(parseBalance('RM 86.4')).toBe(8640);
    expect(parseBalance('')).toBe(0);
    expect(parseBalance('-120')).toBe(-12000);
    expect(parseBalance('12.345')).toBeNull();
    expect(parseBalance('1.2.3')).toBeNull();
  });

  it('continues once a wallet has a name and every named balance reads', () => {
    expect(walletsReady([draft('', '10')])).toBe(false);
    expect(walletsReady([draft('Cash', '63.60'), draft('', 'oops')])).toBe(true);
    expect(walletsReady([draft('Cash', '63.6.0')])).toBe(false);
  });

  it('creates the named wallets in order with their kind’s icon and card style', () => {
    expect(walletsToCreate([draft(' Maybank Savings ', '2,281.80'), draft('', '5'), draft('Wise USD', '120', 'bank', 'USD'), draft('Touch ’n Go', '', 'ewallet')])).toEqual([
      { name: 'Maybank Savings', type: 'bank', currency: 'MYR', initialBalanceMinor: 228180, color: '#F9D51F', icon: 'bank', cardStyleId: 'citrus-pop' },
      { name: 'Wise USD', type: 'bank', currency: 'USD', initialBalanceMinor: 12000, color: '#F9D51F', icon: 'bank', cardStyleId: 'citrus-pop' },
      { name: 'Touch ’n Go', type: 'ewallet', currency: 'MYR', initialBalanceMinor: 0, color: '#8C5CF3', icon: 'wallet', cardStyleId: 'violet-dusk' },
    ]);
  });
});

describe("Home's Get set up card", () => {
  const items = (over: Partial<Parameters<typeof setupChecklist>[0]> = {}) =>
    setupChecklist({ currency: 'MYR', currencyName: 'Malaysian ringgit', aiOn: true, wallets: 4, monthName: 'October', budgetSet: false, phoneUsed: false, ...over });

  it('lists the four set-up steps and this month’s budget, with what each one holds', () => {
    expect(items()).toEqual([
      { key: 'currency', title: 'Pick your main currency', line: 'MYR, Malaysian ringgit', done: true },
      { key: 'ai', title: "Choose about Moni's AI", line: 'On, change it in Settings', done: true },
      { key: 'wallets', title: 'Add your wallets', line: '4 wallets', done: true },
      { key: 'budget', title: "Set October's budget", line: 'This draws your spending chart', done: false },
      { key: 'phone', title: 'Get the phone app', line: 'For bank alerts and receipts', done: false },
    ]);
    expect(items({ aiOn: false, wallets: 1 }).slice(1, 3).map((item) => item.line)).toEqual(['Off, change it in Settings', '1 wallet']);
  });

  it('shows from the end of set-up until every step is done or it is closed', () => {
    expect(showsChecklist(items(), { finishedAt: '2026-10-14T07:00:00.000Z' })).toBe(true);
    expect(showsChecklist(items(), {})).toBe(false);
    expect(showsChecklist(items(), { finishedAt: '2026-10-14T07:00:00.000Z', hidden: true })).toBe(false);
    expect(showsChecklist(items({ budgetSet: true, phoneUsed: true }), { finishedAt: '2026-10-14T07:00:00.000Z' })).toBe(false);
  });

  it('mails the Play link to the visitor themself', () => {
    expect(phoneLinkMail('kai@example.com', 'https://play.example/moni')).toBe(
      'mailto:kai%40example.com?subject=Moni%20for%20your%20phone&body=Get%20Moni%20on%20your%20Android%20phone%3A%20https%3A%2F%2Fplay.example%2Fmoni%0A%0ASign%20in%20with%20kai%40example.com%20and%20everything%20it%20captures%20shows%20on%20the%20web%20too.',
    );
  });
});

describe('Get the app', () => {
  const android = 'Mozilla/5.0 (Linux; Android 14; Redmi Note 13) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  const day = 24 * 60 * 60 * 1000;

  it('shows on Android only, and stays closed for 30 days', () => {
    expect(showsGetApp(android, null, 100 * day)).toBe(true);
    expect(showsGetApp(iphone, null, 100 * day)).toBe(false);
    expect(showsGetApp(android, 80 * day, 100 * day)).toBe(false);
    expect(showsGetApp(android, 70 * day, 100 * day)).toBe(true);
  });
});
