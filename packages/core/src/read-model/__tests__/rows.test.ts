import { describe, expect, it } from 'vitest';
import { createTransactionSchema } from '@repo/types';

import { toFinanceProposal, toFinanceTransaction } from '../rows';

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

describe('toFinanceProposal', () => {
  const capture = {
    id: 'p1',
    user_id: 'u1',
    source_type: 'notification',
    amount: '12.00',
    currency: 'MYR',
    type: 'expense',
    created_at: '2026-11-12T03:00:00.000Z',
    updated_at: '2026-11-12T03:00:00.000Z',
  };

  it('reads a later row an older app wrote offline as pending, so it waits in Review', () => {
    expect(
      toFinanceProposal({ ...capture, status: 'later', snoozed_until: '2026-11-13T00:00:00.000Z' })?.status,
    ).toBe('pending');
  });

  it('leaves Approve and Not mine out of the waiting captures', () => {
    expect(toFinanceProposal({ ...capture, status: 'approved' })).toBeNull();
    expect(toFinanceProposal({ ...capture, status: 'rejected' })).toBeNull();
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
