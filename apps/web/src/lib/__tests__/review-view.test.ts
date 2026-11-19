import type { ReviewedProposal } from '@repo/core';
import type { MinorAmount } from '@repo/types';
import { describe, expect, it } from 'vitest';

import { approvedText, captureName, caughtUpLine, notMineText, oldReviewHref, parseReviewView, reviewHref, waitingCount, waitingLine } from '../review-view';

const capture = (merchant: string | null, amount: number, currency = 'MYR') => ({
  id: merchant ?? 'x',
  merchant,
  description: null,
  amountMinor: amount as MinorAmount,
  currency,
});

describe('review words', () => {
  it('sums what waits in the main currency only, or says nothing waits', () => {
    expect(waitingLine([capture('GRAB*FOOD', 2340), capture('Jaya Grocer', 8640), capture('Steam', 999, 'USD')], 'MYR')).toBe('RM109.80 not counted yet');
    expect(waitingLine([], 'MYR')).toBe('Nothing waiting');
    expect(waitingCount(3)).toBe('3 waiting · oldest first');
  });

  it('names one approval by its category, counts several, and names a capture left without a wallet', () => {
    expect(approvedText({ approved: [capture('GRAB*FOOD', 2340)], category: 'Food & Dining', ruleSaved: true, skipped: [] })).toBe(
      'Added to Food & Dining, similar ones will be Auto',
    );
    expect(
      approvedText({ approved: [capture('GRAB*FOOD', 2340), capture('Jaya Grocer', 8640)], category: null, ruleSaved: false, skipped: [capture('Parking KLCC', 600)] }),
    ).toBe('2 approved · Parking KLCC still needs a wallet');
    expect(approvedText({ approved: [capture(null, 600)], category: null, ruleSaved: false, skipped: [] })).toBe('Capture approved');
    expect(notMineText(1)).toBe('1 not mine');
    expect(captureName({ merchant: '  ', description: 'Parking' })).toBe('Parking');
  });

  it("says today's decisions and what Approve added to the month", () => {
    const reviewed = (status: 'approved' | 'rejected', amount: number, at: string) =>
      ({ ...capture('x', amount), status, reviewedAt: at }) as unknown as ReviewedProposal;
    const dayOf = (at: string) => at.slice(0, 10);
    expect(
      caughtUpLine(
        [reviewed('approved', 2340, '2026-10-14T05:00:00Z'), reviewed('approved', 8640, '2026-10-14T05:01:00Z'), reviewed('rejected', 600, '2026-10-14T05:02:00Z'), reviewed('approved', 100, '2026-10-13T05:00:00Z')],
        '2026-10-14',
        dayOf,
        'MYR',
      ),
    ).toBe('2 approved, 1 not mine · RM109.80 added to October');
    expect(caughtUpLine([reviewed('rejected', 600, '2026-10-14T05:02:00Z')], '2026-10-14', dayOf, 'MYR')).toBe('1 not mine');
    expect(caughtUpLine([], '2026-10-14', dayOf, 'MYR')).toBe('Nothing waiting. New captures land here.');
  });

  it('reads the drawer from the URL and links to it', () => {
    expect(parseReviewView(null)).toBeNull();
    expect(parseReviewView('deck')).toBe('deck');
    expect(parseReviewView('list')).toBe('list');
    expect(parseReviewView('recent')).toBe('recent');
    expect(parseReviewView('')).toBe('deck');
    expect(reviewHref()).toBe('/home?review=deck');
    expect(reviewHref('a1')).toBe('/home?review=deck&capture=a1');
  });

  it('sends an old /review link to the drawer on Home', () => {
    expect(oldReviewHref(null, null)).toBe('/home?review=deck');
    expect(oldReviewHref(null, 'a1')).toBe('/home?review=deck&capture=a1');
    expect(oldReviewHref('recent', null)).toBe('/home?review=recent');
  });
});
