import type { Observable } from '@legendapp/state';
import type { MinorAmount } from '@repo/types';
import {
  addBill,
  selectRecurringOverrides,
  skipBill,
  updateBill,
  type RecurringOverrideRow,
} from '../recurring-overrides';

let mockNextId = 0;
const mockMigrated = { bills: true };
jest.mock('expo-crypto', () => ({ randomUUID: () => `override-${++mockNextId}` }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: async () => 'user-1' }));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return {
    recurringOverrides$: observable({}),
    assertMigrated: () => {
      if (!mockMigrated.bills) throw new Error('Moni needs a server update');
    },
  };
});

const { recurringOverrides$ } = jest.requireMock('@/lib/store') as {
  recurringOverrides$: Observable<Record<string, RecurringOverrideRow>>;
};

const USER = 'user-1';

function row(over: Partial<RecurringOverrideRow>): RecurringOverrideRow {
  return {
    id: 'row-1',
    user_id: USER,
    series_key: 'MYR|expense|netflix',
    status: 'confirmed',
    kind: 'subscription',
    expected_amount: '55.00',
    expected_day: 10,
    currency: 'MYR',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    deleted: false,
    ...over,
  };
}

describe('selectRecurringOverrides', () => {
  it('keeps the newest verdict when two devices wrote one for the same series', () => {
    const selected = selectRecurringOverrides(
      [
        row({ id: 'a', status: 'dismissed', updated_at: '2026-10-05T00:00:00.000Z' }),
        row({ id: 'b', status: 'confirmed', updated_at: '2026-10-03T00:00:00.000Z' }),
        row({ id: 'c', series_key: 'MYR|expense|unifi', updated_at: '2026-10-02T00:00:00.000Z' }),
      ],
      USER,
    );
    expect(selected.map((o) => [o.id, o.status])).toEqual([
      ['a', 'dismissed'],
      ['c', 'confirmed'],
    ]);
    expect(selected[0].expectedAmountMinor).toBe(5500);
  });

  it("drops cleared rows and other users' rows", () => {
    expect(
      selectRecurringOverrides(
        [row({ id: 'a', deleted: true }), row({ id: 'b', user_id: 'someone-else' })],
        USER,
      ),
    ).toEqual([]);
  });
});

const netflix = {
  seriesKey: 'MYR|expense|netflix',
  currency: 'MYR',
  amountMinor: 5490 as MinorAmount,
  dueDate: '2026-10-15',
};

describe('bill writers', () => {
  beforeEach(() => {
    recurringOverrides$.set({});
    mockMigrated.bills = true;
  });

  it("skipBill(seriesKey, '2026-10') writes skipPeriod and leaves status unchanged", async () => {
    recurringOverrides$.set({ 'row-1': row({ id: 'row-1', status: 'dismissed' }) });
    await skipBill(netflix, '2026-10');
    expect(recurringOverrides$.peek()['row-1']).toMatchObject({
      status: 'dismissed',
      skip_period: '2026-10',
      expected_amount: '55.00',
    });
  });

  it('confirms a detected bill with its current amount and day the first time it is edited', async () => {
    await updateBill(netflix, { remind: true });
    expect(Object.values(recurringOverrides$.peek())).toEqual([
      expect.objectContaining({
        series_key: 'MYR|expense|netflix',
        status: 'confirmed',
        kind: 'bill',
        expected_amount: '54.90',
        expected_day: 15,
        remind: true,
      }),
    ]);
  });

  it('adds Unifi at RM129 due on day 20 under a merchant series key', async () => {
    const key = await addBill({
      name: 'Unifi fibre',
      amountMinor: 12900 as MinorAmount,
      currency: 'MYR',
      dueDate: '2026-10-20',
      once: false,
    });
    expect(key).toBe('MYR|expense|unifi fibre');
    expect(Object.values(recurringOverrides$.peek())).toEqual([
      expect.objectContaining({
        series_key: 'MYR|expense|unifi fibre',
        status: 'confirmed',
        kind: 'bill',
        expected_amount: '129.00',
        expected_day: 20,
        name: 'Unifi fibre',
        due_once: null,
      }),
    ]);
  });

  it('refuses to write the new bill columns before their migration ran', async () => {
    mockMigrated.bills = false;
    await expect(skipBill(netflix, '2026-10')).rejects.toThrow('server update');
    expect(recurringOverrides$.peek()).toEqual({});
  });
});
