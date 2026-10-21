import type { MinorAmount } from '@repo/types';

import type { LedgerEntry } from '@/lib/ai/duplicates';
import {
  duplicateCopy,
  findTypedDuplicate,
} from '@/lib/capture/type-duplicate';

const now = new Date(2026, 9, 14, 14, 6);
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 3_600_000).toISOString();

const draft: LedgerEntry = {
  id: 'draft',
  kind: 'transaction',
  type: 'expense',
  walletId: 'maybank',
  currency: 'MYR',
  amountMinor: 2340,
  merchant: 'Grab food',
  at: now.toISOString(),
};
const grab: LedgerEntry = {
  ...draft,
  id: 'grab',
  kind: 'proposal',
  merchant: 'GRAB*FOOD',
  at: hoursAgo(26),
};

describe('typed duplicate', () => {
  it('matches the same amount and shop from yesterday', () => {
    expect(findTypedDuplicate(draft, [grab])?.id).toBe('grab');
  });

  it('ignores the same purchase four days ago', () => {
    expect(
      findTypedDuplicate(draft, [{ ...grab, at: hoursAgo(96) }]),
    ).toBeNull();
  });

  it('with no shop typed, matches only the same wallet', () => {
    const bare = { ...draft, merchant: null };

    expect(findTypedDuplicate(bare, [grab])?.id).toBe('grab');
    expect(
      findTypedDuplicate(bare, [{ ...grab, walletId: 'cash' }]),
    ).toBeNull();
  });

  it('words a waiting notification capture as the board does', () => {
    expect(
      duplicateCopy(
        {
          kind: 'proposal',
          amountMinor: 2340 as MinorAmount,
          currency: 'MYR',
          merchant: 'GRAB*FOOD',
          at: new Date(2026, 9, 14, 12, 41).toISOString(),
          walletName: 'Maybank',
          fromNotification: true,
        },
        now,
      ),
    ).toEqual({
      title: 'Already in Review',
      message:
        'Moni caught RM23.40 at GRAB*FOOD from your Maybank notification at 12:41 pm. Adding this too would count it twice.',
    });
  });

  it('words a saved row from yesterday', () => {
    expect(
      duplicateCopy(
        {
          kind: 'transaction',
          amountMinor: 1250 as MinorAmount,
          currency: 'MYR',
          merchant: 'Tesco',
          at: new Date(2026, 9, 13, 9, 5).toISOString(),
          walletName: 'Cash',
          fromNotification: false,
        },
        now,
      ).message,
    ).toBe(
      'You added RM12.50 at Tesco yesterday at 9:05 am. Adding this too would count it twice.',
    );
  });
});
