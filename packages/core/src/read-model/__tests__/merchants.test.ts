import { describe, expect, it } from 'vitest';
import {
  guessMerchantName,
  merchantKey,
  merchantName,
  merchantNameList,
  type MerchantPayment,
} from '../merchants';

describe('merchantKey', () => {
  it.each([
    ['GRAB* A-12XY', 'grab'],
    ['GRAB*1234 KL', 'grab'],
    ['SQ *KOPI KOPI', 'sq kopi kopi'],
    ['Grab A-98QZ', 'grab'],
    ['FamilyMart KLCC #0231', 'familymart klcc'],
    ['  ', null],
    [null, null],
  ])('%s -> %s', (raw, key) => {
    expect(merchantKey(raw)).toBe(key);
  });
});

const aliases = [{ rawKey: 'grab', displayName: 'Grab' }];

describe('merchantName', () => {
  it("shows the user's name for a raw alert merchant", () => {
    expect(merchantName('GRAB*1234 KL', aliases)).toBe('Grab');
    expect(merchantName('Grab A-98QZ', aliases)).toBe('Grab');
  });

  it('keeps the raw text for a merchant without a name', () => {
    expect(merchantName('KEDAI ABC', aliases)).toBe('KEDAI ABC');
    expect(merchantName(null, aliases)).toBe(null);
  });
});

const pay = (
  merchant: string,
  day: number,
  overrides: Partial<MerchantPayment> = {},
): MerchantPayment => ({
  merchant,
  walletId: 'maybank',
  categoryId: 'food',
  transactionDate: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
  fromAlert: true,
  ...overrides,
});

const walletNames = { maybank: 'Maybank', tng: "Touch 'n Go" };

describe('merchantNameList', () => {
  it('lists a code with three payments and no name under To name, with its wallet and a guess', () => {
    const { toName, named } = merchantNameList(
      [pay('GRAB*FOOD', 3), pay('GRAB*FOOD', 7), pay('GRAB*FOOD', 13, { walletId: 'tng' })],
      [],
      walletNames,
    );

    expect(toName).toEqual([
      {
        key: 'grab food',
        raw: 'GRAB*FOOD',
        name: null,
        count: 3,
        wallet: 'Maybank',
        categoryId: 'food',
        guess: 'Grab Food',
      },
    ]);
    expect(named).toEqual([]);
  });

  it('waits for the third payment, and skips names typed by hand', () => {
    const { toName } = merchantNameList(
      [
        pay('SHELL 0441', 1),
        pay('SHELL 0441', 2),
        pay('Starbucks', 1, { fromAlert: false }),
        pay('Starbucks', 2, { fromAlert: false }),
        pay('Starbucks', 3, { fromAlert: false }),
      ],
      [],
      walletNames,
    );

    expect(toName).toEqual([]);
  });

  it('moves a named code to Named with its latest raw text, and keeps names with no payments', () => {
    const { toName, named } = merchantNameList(
      [pay('GRAB*1234 KL', 3), pay('GRAB*A-3KX2', 9, { walletId: 'tng' }), pay('GRAB*9999', 5)],
      [
        { rawKey: 'grab', displayName: 'Grab' },
        { rawKey: 'tnb', displayName: 'TNB electricity' },
      ],
      walletNames,
    );

    expect(toName).toEqual([]);
    expect(named.map((entry) => [entry.name, entry.raw, entry.count, entry.wallet])).toEqual([
      ['Grab', 'GRAB*A-3KX2', 3, 'Maybank'],
      ['TNB electricity', 'TNB', 0, null],
    ]);
  });
});

describe('guessMerchantName', () => {
  it('title-cases a readable key and gives up on short codes', () => {
    expect(guessMerchantName('grab food')).toBe('Grab Food');
    expect(guessMerchantName('mbb ct pj')).toBeNull();
  });
});
