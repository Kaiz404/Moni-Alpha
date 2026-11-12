import type { CurrencyCode, MerchantAlias } from '@repo/types';

import { merchantKey } from '@/lib/ai/routine';
import { merchantName } from '@/lib/finance/merchant-name';
import { groupPlaces, type LatLng } from '@/lib/finance/places';
import type { FinanceTransaction } from '@/lib/finance/types';

/** A row in the place sheet's search. `shop` names the shop a pick fills into Shop or note. */
export type PlaceOption = LatLng & {
  id: string;
  title: string;
  meta: string | null;
  shop: string | null;
};

export type PastPlaceInput = {
  transactions: readonly FinanceTransaction[];
  currency: CurrencyCode;
  aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[];
};

const LIMIT = 5;

/**
 * The user's own places that match the query: a shop they paid at a place, by the name they
 * know it by, or a place by its name or area. Most visited first. Nothing leaves the phone.
 */
export function searchPastPlaces(
  query: string,
  input: PastPlaceInput,
): PlaceOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const found: { option: PlaceOption; visits: number }[] = [];
  for (const place of groupPlaces(input.transactions, { currency: input.currency })) {
    const shops = new Map<string, { name: string; visits: number }>();
    for (const row of place.transactions) {
      const name = merchantName(row.merchant, input.aliases)?.trim();
      if (!name || !name.toLowerCase().includes(q)) continue;
      const key = merchantKey(name) ?? name.toLowerCase();
      const shop = shops.get(key);
      if (shop) shop.visits += 1;
      else shops.set(key, { name, visits: 1 });
    }
    const at = { latitude: place.latitude, longitude: place.longitude };
    for (const [key, shop] of shops)
      found.push({
        option: {
          ...at,
          id: `${place.id}:${key}`,
          title: shop.name,
          meta: place.name === shop.name ? place.area : place.name,
          shop: shop.name,
        },
        visits: shop.visits,
      });
    if (
      !shops.size &&
      [place.name, place.area].some((part) => part?.toLowerCase().includes(q))
    )
      found.push({
        option: { ...at, id: place.id, title: place.name, meta: place.area, shop: null },
        visits: place.count,
      });
  }
  return found
    .sort((a, b) => b.visits - a.visits || a.option.title.localeCompare(b.option.title))
    .slice(0, LIMIT)
    .map((row) => row.option);
}
