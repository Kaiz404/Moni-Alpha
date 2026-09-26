import { selectRecurringOverrides, type RecurringOverrideRow } from '../recurring-overrides';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('@/lib/store', () => ({ recurringOverrides$: {} }));
jest.mock('@/lib/supabase/client', () => ({ getUserId: jest.fn() }));

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
