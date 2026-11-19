import { describe, expect, it } from 'vitest';

import { planForgetMerchantNames, planMerchantNames, type MerchantAliasRow } from '../merchant-names';

const NOW = '2026-10-14T03:00:00.000Z';

function context(migrated = true) {
  let next = 0;
  return { userId: 'user-1', now: NOW, newId: () => `new-${(next += 1)}`, isMigrated: () => migrated };
}

const row = (over: Partial<MerchantAliasRow>): MerchantAliasRow => ({
  id: 'a-grab',
  user_id: 'user-1',
  raw_key: 'grab',
  display_name: 'Grab',
  deleted: false,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  ...over,
});

describe('planMerchantNames', () => {
  it('names two new codes with one name in one batch', () => {
    expect(planMerchantNames([], ['grab food', 'grab'], 'Grab', context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [
          { table: 'merchant_aliases', row: { id: 'new-1', user_id: 'user-1', raw_key: 'grab food', display_name: 'Grab', deleted: false } },
          { table: 'merchant_aliases', row: { id: 'new-2', user_id: 'user-1', raw_key: 'grab', display_name: 'Grab', deleted: false } },
        ],
        patch: [],
        softDelete: [],
      },
      result: null,
    });
  });

  it('renames the newest live row, trims the name and leaves a code that already reads so', () => {
    const rows = [
      row({ id: 'old', updated_at: '2026-08-01T00:00:00.000Z' }),
      row({ id: 'new', updated_at: '2026-09-05T00:00:00.000Z' }),
      row({ id: 'shell', raw_key: 'shell', display_name: 'Grab rides' }),
    ];
    expect(planMerchantNames(rows, ['grab', 'shell'], '  Grab rides ', context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [{ table: 'merchant_aliases', id: 'new', patch: { display_name: 'Grab rides', updated_at: NOW } }],
        softDelete: [],
      },
      result: null,
    });
  });

  it('brings a forgotten name back on its own row, and skips other users and repeated codes', () => {
    const rows = [row({ deleted: true }), row({ id: 'theirs', user_id: 'user-2', raw_key: 'shell' })];
    const plan = planMerchantNames(rows, ['grab', 'grab'], 'Grab', context());
    expect(plan).toEqual({
      kind: 'writes',
      writes: {
        insert: [{ table: 'merchant_aliases', row: { ...rows[0], deleted: false, updated_at: NOW } }],
        patch: [],
        softDelete: [],
      },
      result: null,
    });
  });

  it('refuses a blank name, a name over 100 letters, a key that is not a merchant key, and a server without the table', () => {
    expect(planMerchantNames([], ['grab'], '   ', context())).toEqual({ kind: 'error', message: 'Type a name first.' });
    expect(planMerchantNames([], ['grab'], 'x'.repeat(101), context())).toEqual({ kind: 'error', message: 'That name is too long.' });
    expect(planMerchantNames([], ['GRAB*FOOD'], 'Grab', context()).kind).toBe('error');
    expect(planMerchantNames([], ['grab'], 'Grab', context(false))).toEqual({
      kind: 'error',
      message: 'Moni needs a server update before it can save this. Try again later.',
    });
  });
});

describe('planForgetMerchantNames', () => {
  it('soft-deletes every live row of each code, and nothing else', () => {
    const rows = [
      row({ id: 'phone' }),
      row({ id: 'web' }),
      row({ id: 'gone', deleted: true }),
      row({ id: 'shell', raw_key: 'shell' }),
      row({ id: 'theirs', user_id: 'user-2' }),
    ];
    expect(planForgetMerchantNames(rows, ['grab'], context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [],
        softDelete: [
          { table: 'merchant_aliases', id: 'phone', at: NOW },
          { table: 'merchant_aliases', id: 'web', at: NOW },
        ],
      },
      result: null,
    });
  });
});
