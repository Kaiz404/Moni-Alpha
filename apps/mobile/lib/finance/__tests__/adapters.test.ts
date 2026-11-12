import { createTransactionSchema } from '@repo/types';

import { toFinanceTransaction } from '@/lib/finance/adapters';

const ROW = {
  id: 't1',
  type: 'expense',
  amount: '12.00',
  transaction_date: '2026-11-12T03:00:00.000Z',
  place_id: 'p-zus',
  place_coords_at: '2026-11-12T03:00:00.123+00:00',
};

describe('toFinanceTransaction', () => {
  it('reads place_coords_at as UTC ISO, so reusing the place passes the save schema', () => {
    const row = toFinanceTransaction(ROW);
    expect(row?.placeCoordsAt).toBe('2026-11-12T03:00:00.123Z');
  });

  it('drops a place_coords_at that is not a date', () => {
    expect(toFinanceTransaction({ ...ROW, place_coords_at: 'soon' })?.placeCoordsAt).toBeNull();
  });
});

describe('createTransactionSchema', () => {
  it('accepts a place_coords_at with a +00:00 offset', () => {
    const parsed = createTransactionSchema.safeParse({
      walletId: '6f1a3c56-3b1e-4a35-9a3e-0b1c2d3e4f50',
      amountMinor: 1200,
      type: 'expense',
      transactionDate: '2026-11-12T03:00:00.000Z',
      placeId: 'p-zus',
      placeCoordsAt: '2026-11-12T03:00:00.123+00:00',
    });
    expect(parsed.success).toBe(true);
  });
});
