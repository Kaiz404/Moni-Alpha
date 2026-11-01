import type { CurrencyCode, MerchantAlias } from '@repo/types';

import { merchantKey } from '@/lib/ai/routine';
import { merchantName } from '@/lib/finance/merchant-name';
import {
  distanceM,
  groupPlaces,
  isAtPlace,
  type LatLng,
  type Place,
} from '@/lib/finance/places';
import type { FinanceTransaction } from '@/lib/finance/types';

export type PlaceSuggestion = {
  merchant: string;
  categoryId: string | null;
};

export type PlaceSuggestionInput = {
  transactions: readonly FinanceTransaction[];
  here: LatLng;
  /** The main currency: a place paid only in another currency never suggests. */
  currency: CurrencyCode;
  /** The categories this entry can use; a retired one is never suggested. */
  activeCategoryIds: ReadonlySet<string>;
  /** Wallets whose app has location off: their payments teach nothing. */
  locationOffWalletIds: ReadonlySet<string>;
  aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[];
};

/** Phone positions closer than this say nothing about which place is nearer. */
const SAME_DISTANCE_M = 10;

/** The most common value; on a tie, the one that comes first. */
function usual<T>(values: readonly T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Newest first, as `Place.transactions` holds them. */
function suggestionFrom(
  place: Place,
  input: PlaceSuggestionInput,
): PlaceSuggestion | null {
  const visits = place.transactions.flatMap((row) => {
    const name = merchantName(row.merchant, input.aliases)?.trim();
    if (!name) return [];
    return [
      {
        name,
        key: merchantKey(name) ?? name.toLowerCase(),
        categoryId: row.categoryId,
      },
    ];
  });
  const key = usual(visits.map((visit) => visit.key));
  const atMerchant = visits.filter((visit) => visit.key === key);
  if (!atMerchant.length) return null;
  return {
    merchant: atMerchant[0].name,
    categoryId:
      usual(
        atMerchant
          .map((visit) => visit.categoryId)
          .filter((id): id is string => !!id && input.activeCategoryIds.has(id)),
      ) ?? null,
  };
}

/**
 * What Type it offers at a place the user has paid before: the nearest place within the place
 * radius that names a merchant, its most visited merchant, and that merchant's usual category.
 * Places about the same distance away go to the one with more visits, then the latest payment.
 */
export function placeSuggestion(
  input: PlaceSuggestionInput,
): PlaceSuggestion | null {
  const rows = input.transactions.filter(
    (row) => !input.locationOffWalletIds.has(row.walletId),
  );
  const nearby = groupPlaces(rows, { currency: input.currency })
    .filter((place) => isAtPlace(place, input.here))
    .map((place) => ({
      place,
      band: Math.round(distanceM(place, input.here) / SAME_DISTANCE_M),
    }))
    .sort(
      (a, b) =>
        a.band - b.band ||
        b.place.count - a.place.count ||
        b.place.transactions[0].transactionDate.localeCompare(
          a.place.transactions[0].transactionDate,
        ) ||
        a.place.id.localeCompare(b.place.id),
    );
  for (const { place } of nearby) {
    const suggestion = suggestionFrom(place, input);
    if (suggestion) return suggestion;
  }
  return null;
}
