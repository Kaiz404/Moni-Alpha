import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';

import { billSeriesKey, planAddBill, type RecurringOverrideRow } from '../bills';

const NOW = '2026-10-14T03:00:00.000Z';

function context(migrated = true) {
  let next = 0;
  return { userId: 'user-1', now: NOW, newId: () => `new-${(next += 1)}`, isMigrated: () => migrated };
}

const row = (over: Partial<RecurringOverrideRow>): RecurringOverrideRow => ({
  id: 'o-netflix',
  user_id: 'user-1',
  series_key: 'MYR|expense|netflix',
  status: 'dismissed',
  kind: null,
  expected_amount: null,
  expected_day: null,
  currency: 'MYR',
  remind: true,
  deleted: false,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  ...over,
});

const unifi = { name: 'Unifi fibre', amountMinor: 12900 as MinorAmount, currency: 'MYR' as const, dueDate: '2026-10-20', once: false };
const netflix = {
  name: 'Netflix',
  amountMinor: 5490 as MinorAmount,
  currency: 'MYR' as const,
  dueDate: '2026-11-03',
  once: false,
  from: { seriesKey: 'MYR|expense|netflix', walletId: 'w-maybank', categoryId: 'c-subs' },
};
const BILL = {
  status: 'confirmed',
  kind: 'bill',
  currency: 'MYR',
  skip_period: null,
};

describe('billSeriesKey', () => {
  it('groups a typed name under its merchant, and refuses a name with no letters', () => {
    expect(billSeriesKey('Unifi fibre', 'MYR')).toBe('MYR|expense|unifi fibre');
    expect(billSeriesKey('123', 'MYR')).toBeNull();
  });
});

describe('planAddBill', () => {
  it('adds Unifi at RM129 due monthly on day 20 under its name', () => {
    expect(planAddBill([], unifi, context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [
          {
            table: 'recurring_overrides',
            row: {
              id: 'new-1',
              user_id: 'user-1',
              series_key: 'MYR|expense|unifi fibre',
              ...BILL,
              expected_amount: '129.00',
              expected_day: 20,
              name: 'Unifi fibre',
              due_once: null,
              deleted: false,
            },
          },
        ],
        patch: [],
        softDelete: [],
      },
      result: { seriesKey: 'MYR|expense|unifi fibre' },
    });
  });

  it("confirms a payment's own series in place with its wallet and category", () => {
    expect(planAddBill([row({})], netflix, context())).toEqual({
      kind: 'writes',
      writes: {
        insert: [],
        patch: [
          {
            table: 'recurring_overrides',
            id: 'o-netflix',
            patch: {
              ...BILL,
              expected_amount: '54.90',
              expected_day: 3,
              name: 'Netflix',
              due_once: null,
              wallet_id: 'w-maybank',
              category_id: 'c-subs',
              updated_at: NOW,
            },
          },
        ],
        softDelete: [],
      },
      result: { seriesKey: 'MYR|expense|netflix' },
    });
  });

  it("revives a forgotten verdict's row once, due just once, and leaves other users' rows alone", () => {
    const rows = [row({ deleted: true }), row({ id: 'o-theirs', user_id: 'user-2' })];
    const plan = planAddBill(rows, { ...netflix, once: true }, context());
    expect(plan.kind === 'writes' && plan.writes.insert).toEqual([
      {
        table: 'recurring_overrides',
        row: {
          ...row({}),
          ...BILL,
          expected_amount: '54.90',
          expected_day: 3,
          name: 'Netflix',
          due_once: '2026-11-03',
          wallet_id: 'w-maybank',
          category_id: 'c-subs',
          deleted: false,
          updated_at: NOW,
        },
      },
    ]);
  });

  it('says what is missing and writes nothing', () => {
    expect(planAddBill([], { ...unifi, name: '  ' }, context())).toEqual({ kind: 'error', message: 'Name the bill first.' });
    expect(planAddBill([], { ...unifi, name: '42' }, context())).toEqual({ kind: 'error', message: 'A bill name needs a letter in it.' });
    expect(planAddBill([], { ...unifi, amountMinor: 0 as MinorAmount }, context())).toEqual({ kind: 'error', message: 'Add an amount first.' });
    expect(planAddBill([], { ...unifi, dueDate: '' }, context())).toEqual({ kind: 'error', message: 'Pick a due date first.' });
    expect(planAddBill([], unifi, context(false))).toEqual({
      kind: 'error',
      message: 'Moni needs a server update before it can save this. Try again later.',
    });
  });
});
