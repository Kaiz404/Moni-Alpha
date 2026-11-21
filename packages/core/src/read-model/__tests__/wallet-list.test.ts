import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';

import type { FinanceWallet } from '../types';
import { keptApartLine, moveWallet, reorderSlot, waitingLine, walletGroups, walletListMeta, walletTint } from '../wallet-list';

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

describe('moveWallet', () => {
  const groups = walletGroups(
    [wallet('maybank', 'MYR'), wallet('tng', 'MYR'), wallet('cash', 'MYR', 'cash'), wallet('wise', 'USD'), wallet('dbs', 'SGD')],
    {},
    'MYR',
  );

  it('moves a wallet within its currency and keeps the other groups where they are', () => {
    expect(moveWallet(groups, 'cash', 0)).toEqual(['cash', 'maybank', 'tng', 'dbs', 'wise']);
    expect(moveWallet(groups, 'maybank', 1)).toEqual(['tng', 'maybank', 'cash', 'dbs', 'wise']);
  });

  it('never lets a wallet cross into another currency', () => {
    expect(moveWallet(groups, 'tng', 9)).toEqual(['maybank', 'cash', 'tng', 'dbs', 'wise']);
    expect(moveWallet(groups, 'wise', -3)).toEqual(['maybank', 'tng', 'cash', 'dbs', 'wise']);
  });
});

describe('reorderSlot', () => {
  it('takes a neighbour\'s slot once past its middle, and stops at the ends', () => {
    expect(reorderSlot(1, 78, 158, 4)).toBe(1);
    expect(reorderSlot(1, 80, 158, 4)).toBe(2);
    expect(reorderSlot(1, -80, 158, 4)).toBe(0);
    expect(reorderSlot(1, 900, 158, 4)).toBe(3);
    expect(reorderSlot(0, -900, 158, 4)).toBe(0);
  });
});

describe('walletTint', () => {
  it('follows the stored colour, so an Aqua bank wallet stays Aqua', () => {
    expect(walletTint('ocean-deep', 'bank')).toBe('aqua');
    expect(walletTint('citrus-pop', 'bank')).toBe('lemon');
    expect(walletTint('violet-dusk', 'ewallet')).toBe('lilac');
  });

  it('falls back to the wallet type without a known colour', () => {
    expect(walletTint(null, 'cash')).toBe('mint');
    expect(walletTint('retired-style', 'investment')).toBe('sky');
    expect(walletTint(null, 'unknown')).toBe('sand');
  });
});

describe('walletListMeta', () => {
  it('reads the type, alerts, cash in your pocket, and another currency by name', () => {
    expect(walletListMeta(wallet('a', 'MYR'), true, true)).toBe('Bank, alerts on');
    expect(walletListMeta(wallet('b', 'MYR', 'cash'), true, false)).toBe('In your pocket');
    expect(walletListMeta(wallet('c', 'MYR', 'credit'), true, false)).toBe('Card');
    expect(walletListMeta(wallet('d', 'SGD', 'ewallet'), false, false)).toBe('E-wallet, Singapore dollars');
  });
});

describe('keptApartLine', () => {
  it('names both currencies in words', () => {
    expect(keptApartLine('USD', 'MYR')).toBe('Kept apart. Moni never converts dollars or adds them to your ringgit.');
  });
});

describe('waitingLine', () => {
  const capture = (type: 'income' | 'expense' | 'transfer' | null, amount: number | null, walletId = 'mb', transferToWalletId: string | null = null) => ({
    type,
    walletId,
    transferToWalletId,
    amountMinor: amount as MinorAmount | null,
  });

  it('takes spending off and adds income on, net', () => {
    expect(waitingLine([capture('expense', 4520), capture('expense', 6460)], 'mb', 'MYR')).toBe('RM109.80 comes off this balance after review');
    expect(waitingLine([capture('income', 20000), capture('expense', 4520)], 'mb', 'MYR')).toBe('RM154.80 goes on this balance after review');
  });

  it('reads a transfer by its direction and leaves a capture with no type or amount out', () => {
    expect(waitingLine([capture('transfer', 5000, 'card', 'mb'), capture(null, 900), capture('expense', null)], 'mb', 'MYR')).toBe('RM50.00 goes on this balance after review');
    expect(waitingLine([capture(null, 900)], 'mb', 'MYR')).toBe('Not in this balance yet');
  });
});
