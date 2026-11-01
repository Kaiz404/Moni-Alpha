import type { CurrencyCode } from '@repo/types';

import {
  placeSuggestion,
  type PlaceSuggestionInput,
} from '@/lib/capture/place-suggestion';
import type { FinanceTransaction } from '@/lib/finance/types';
import { expense } from '@/lib/wallets/__tests__/balance-fixture';

const MYR = 'MYR' as CurrencyCode;
const SGD = 'SGD' as CurrencyCode;
const LNG = 101.671;
/** 244 m apart on one meridian, so a phone between them can be inside both radii. */
const NEAR = 3.13;
const FAR = 3.1322;

const paid = (
  id: string,
  day: number,
  latitude: number,
  over: Partial<FinanceTransaction> = {},
): FinanceTransaction =>
  expense(id, new Date(2026, 9, day, 12).toISOString(), {
    merchant: 'Mamak Ali',
    categoryId: 'food',
    locationLatitude: latitude,
    locationLongitude: LNG,
    ...over,
  });

const suggest = (
  transactions: FinanceTransaction[],
  latitude: number,
  over: Partial<PlaceSuggestionInput> = {},
) =>
  placeSuggestion({
    transactions,
    here: { latitude, longitude: LNG },
    currency: MYR,
    activeCategoryIds: new Set(['food', 'groceries']),
    locationOffWalletIds: new Set(),
    aliases: [],
    ...over,
  });

describe('the place suggestion', () => {
  it('suggests the merchant and category after one earlier payment', () => {
    expect(suggest([paid('a', 1, NEAR)], NEAR)).toEqual({
      merchant: 'Mamak Ali',
      categoryId: 'food',
    });
  });

  describe('which place', () => {
    const near = paid('near', 1, NEAR, { merchant: 'Mamak Ali' });
    const far = paid('far', 2, FAR, { merchant: 'Jaya Grocer', categoryId: 'groceries' });

    it('takes the nearest when two places are in range', () => {
      expect(suggest([near, far], 3.1309)?.merchant).toBe('Mamak Ali');
      expect(suggest([near, far], 3.1313)?.merchant).toBe('Jaya Grocer');
    });

    it('stops at the place radius', () => {
      expect(suggest([near], NEAR + 0.0013)?.merchant).toBe('Mamak Ali');
      expect(suggest([near], NEAR + 0.0014)).toBeNull();
    });

    it('is null with no place nearby', () => {
      expect(suggest([near, far], 3.14)).toBeNull();
      expect(suggest([], NEAR)).toBeNull();
    });

    it('breaks a distance tie by visits', () => {
      const again = paid('near-2', 3, NEAR, { merchant: 'Mamak Ali' });
      expect(suggest([near, again, far], 3.1311)?.merchant).toBe('Mamak Ali');
    });

    it('breaks a visit tie by the latest payment', () => {
      expect(suggest([near, far], 3.1311)?.merchant).toBe('Jaya Grocer');
      const later = paid('near-late', 9, NEAR, { merchant: 'Mamak Ali' });
      const earlier = paid('far-early', 1, FAR, { merchant: 'Jaya Grocer' });
      expect(suggest([later, earlier], 3.1311)?.merchant).toBe('Mamak Ali');
    });

    it('moves on when the nearest place names no merchant', () => {
      const nameless = paid('nameless', 1, NEAR, { merchant: null });
      expect(suggest([nameless, far], 3.1309)?.merchant).toBe('Jaya Grocer');
      expect(suggest([nameless], NEAR)).toBeNull();
    });
  });

  describe('only what counts', () => {
    it('uses the main currency only', () => {
      const sgd = paid('sgd', 1, NEAR, { currency: SGD, merchant: 'Ya Kun' });
      expect(suggest([sgd], NEAR)).toBeNull();
      expect(suggest([sgd], NEAR, { currency: SGD })?.merchant).toBe('Ya Kun');
      expect(suggest([sgd, paid('myr', 2, NEAR)], NEAR)?.merchant).toBe('Mamak Ali');
    });

    it('ignores income and rows left out of spending', () => {
      expect(suggest([paid('in', 1, NEAR, { type: 'income' })], NEAR)).toBeNull();
      expect(suggest([paid('debt', 1, NEAR, { analysisExcluded: true })], NEAR)).toBeNull();
    });

    it('ignores payments with no location', () => {
      expect(
        suggest([paid('none', 1, NEAR, { locationLatitude: null, locationLongitude: null })], NEAR),
      ).toBeNull();
    });

    it('learns nothing from a wallet whose app has location off', () => {
      const off = paid('off', 1, NEAR, { walletId: 'grab-wallet', merchant: 'Grab' });
      expect(
        suggest([off], NEAR, { locationOffWalletIds: new Set(['grab-wallet']) }),
      ).toBeNull();
      expect(
        suggest([off, paid('on', 2, NEAR)], NEAR, {
          locationOffWalletIds: new Set(['grab-wallet']),
        })?.merchant,
      ).toBe('Mamak Ali');
    });
  });

  describe('which merchant', () => {
    it('takes the most visited one', () => {
      expect(
        suggest(
          [
            paid('a', 1, NEAR, { merchant: 'Mamak Ali' }),
            paid('b', 2, NEAR, { merchant: 'Mamak Ali' }),
            paid('c', 3, NEAR, { merchant: 'Kopitiam' }),
          ],
          NEAR,
        )?.merchant,
      ).toBe('Mamak Ali');
    });

    it('takes the latest one on a tie', () => {
      expect(
        suggest(
          [
            paid('a', 1, NEAR, { merchant: 'Mamak Ali' }),
            paid('b', 2, NEAR, { merchant: 'Kopitiam' }),
          ],
          NEAR,
        )?.merchant,
      ).toBe('Kopitiam');
    });

    it('counts spellings of one merchant together and offers the newest', () => {
      expect(
        suggest(
          [
            paid('a', 1, NEAR, { merchant: 'GRAB*1234 KL' }),
            paid('b', 2, NEAR, { merchant: 'Kopitiam' }),
            paid('c', 3, NEAR, { merchant: 'Grab' }),
          ],
          NEAR,
        )?.merchant,
      ).toBe('Grab');
    });

    it('offers the name the user gave the merchant', () => {
      expect(
        suggest([paid('a', 1, NEAR, { merchant: 'RESTORAN ALI SDN' })], NEAR, {
          aliases: [{ rawKey: 'restoran ali sdn', displayName: 'Mamak Ali' }],
        })?.merchant,
      ).toBe('Mamak Ali');
    });

    it('keeps a name made of digits', () => {
      expect(suggest([paid('a', 1, NEAR, { merchant: '7-Eleven' })], NEAR)?.merchant).toBe(
        '7-Eleven',
      );
    });
  });

  describe('which category', () => {
    it('takes the merchant own usual one, not the place at large', () => {
      expect(
        suggest(
          [
            paid('a', 1, NEAR, { merchant: 'Mamak Ali', categoryId: 'food' }),
            paid('b', 2, NEAR, { merchant: 'Mamak Ali', categoryId: 'food' }),
            paid('c', 3, NEAR, { merchant: 'Mamak Ali', categoryId: 'groceries' }),
            paid('d', 4, NEAR, { merchant: 'Kopitiam', categoryId: 'groceries' }),
          ],
          NEAR,
        ),
      ).toEqual({ merchant: 'Mamak Ali', categoryId: 'food' });
    });

    it('takes the latest one on a tie', () => {
      expect(
        suggest(
          [
            paid('a', 1, NEAR, { categoryId: 'food' }),
            paid('b', 2, NEAR, { categoryId: 'groceries' }),
          ],
          NEAR,
        )?.categoryId,
      ).toBe('groceries');
    });

    it('skips a retired category', () => {
      expect(
        suggest(
          [
            paid('a', 1, NEAR, { categoryId: 'retired' }),
            paid('b', 2, NEAR, { categoryId: 'retired' }),
            paid('c', 3, NEAR, { categoryId: 'food' }),
          ],
          NEAR,
        )?.categoryId,
      ).toBe('food');
    });

    it('suggests the merchant alone when no category is left', () => {
      expect(
        suggest([paid('a', 1, NEAR, { categoryId: null })], NEAR),
      ).toEqual({ merchant: 'Mamak Ali', categoryId: null });
      expect(
        suggest([paid('a', 1, NEAR, { categoryId: 'retired' })], NEAR),
      ).toEqual({ merchant: 'Mamak Ali', categoryId: null });
    });
  });
});
