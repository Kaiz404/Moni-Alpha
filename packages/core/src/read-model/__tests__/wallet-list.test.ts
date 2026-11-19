import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';

import type { FinanceWallet } from '../types';
import { keptApartLine, walletGroups, walletListMeta } from '../wallet-list';

const wallet = (id: string, currency: string, type = 'bank') => ({ id, currency, type, name: id }) as FinanceWallet;

describe('walletGroups', () => {
  it('puts the main currency first, then the others by code, each with its own total', () => {
    const groups = walletGroups(
      [wallet('sgd', 'SGD'), wallet('maybank', 'MYR'), wallet('usd', 'USD'), wallet('cash', 'MYR', 'cash')],
      { sgd: 5000 as MinorAmount, maybank: 228180 as MinorAmount, usd: 1200 as MinorAmount, cash: 8640 as MinorAmount },
      'MYR',
    );
    expect(groups.map(({ currency, main, totalMinor, wallets }) => [currency, main, totalMinor, wallets.map((w) => w.id)])).toEqual([
      ['MYR', true, 236820, ['maybank', 'cash']],
      ['SGD', false, 5000, ['sgd']],
      ['USD', false, 1200, ['usd']],
    ]);
  });
});

describe('walletListMeta', () => {
  it('reads the type, alerts, cash in your pocket, and another currency by name', () => {
    expect(walletListMeta(wallet('a', 'MYR'), true, true)).toBe('Bank · alerts on');
    expect(walletListMeta(wallet('b', 'MYR', 'cash'), true, false)).toBe('In your pocket');
    expect(walletListMeta(wallet('c', 'MYR', 'credit'), true, false)).toBe('Card');
    expect(walletListMeta(wallet('d', 'SGD', 'ewallet'), false, false)).toBe('E-wallet · Singapore dollars');
  });
});

describe('keptApartLine', () => {
  it('names both currencies in words', () => {
    expect(keptApartLine('USD', 'MYR')).toBe('Kept apart. Moni never converts dollars or adds them to your ringgit.');
  });
});
