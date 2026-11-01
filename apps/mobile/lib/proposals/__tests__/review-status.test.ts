import { reviewStatus } from '@/lib/proposals/review-status';

const plain = { hasWallet: true, paired: false, maybeDuplicate: false, timesFiled: 0 };

describe('reviewStatus', () => {
  it.each([
    [{ timesFiled: 14 }, 'Usual for you', 'onTrack'],
    [{ timesFiled: 3 }, 'Usual for you', 'onTrack'],
    [{ timesFiled: 2 }, 'Seen before', 'onTrack'],
    [{ timesFiled: 1 }, 'Seen before', 'onTrack'],
    [{ hasWallet: false, timesFiled: 14 }, 'Needs a wallet', 'near'],
    [{ paired: true, timesFiled: 14 }, 'Same payment', 'review'],
    [{ maybeDuplicate: true, timesFiled: 14 }, 'Maybe a duplicate', 'review'],
    [{ hasWallet: false, paired: true, maybeDuplicate: true }, 'Needs a wallet', 'near'],
  ])('%j reads %s', (facts, label, tone) => {
    expect(reviewStatus({ ...plain, ...facts })).toEqual({ tone, label });
  });

  it('shows nothing for a merchant the user has never filed', () => {
    expect(reviewStatus(plain)).toBeNull();
  });
});
