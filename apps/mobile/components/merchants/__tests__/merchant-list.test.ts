import { guessMerchantName, merchantNameList, type MerchantPayment } from '../merchant-list';

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
