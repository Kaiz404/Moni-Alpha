import type { CurrencyCode, MerchantAlias } from '@repo/types';

import { merchantKey } from '@/lib/ai/routine';
import { merchantName } from '@/lib/finance/merchant-name';
import { distanceM, groupPlaces, type LatLng, type Place } from '@/lib/finance/places';
import type { FinanceTransaction } from '@/lib/finance/types';
import type { PlaceCoords } from '@/lib/places/coords';
import type { GoogleSearch } from '@/lib/places/place-search';
import type { PlacePrediction } from '@/lib/places/types';

/**
 * A row in the place sheet that is already a place: one of the user's own, or the geocoder's.
 * `shop` names the shop a pick fills into Shop or note; `categoryId` picks the row's bubble.
 */
export type PlaceOption = LatLng & {
  id: string;
  title: string;
  meta: string | null;
  shop: string | null;
  categoryId: string | null;
  coords: PlaceCoords;
};

export type PastPlaceInput = {
  transactions: readonly FinanceTransaction[];
  currency: CurrencyCode;
  aliases: readonly Pick<MerchantAlias, 'rawKey' | 'displayName'>[];
};

const LIMIT = 5;
/** "Near you" reaches about a short walk from the map's centre. */
export const NEAR_M = 500;

/**
 * Where a past place's position came from. The anchor (its earliest row) may hold Google's
 * coordinates, which keep their fetch time so reusing them never extends Google's 30 days.
 */
function coordsOf(place: Place): PlaceCoords {
  const anchor = place.transactions[place.transactions.length - 1];
  if (anchor.placeId && anchor.placeCoordsAt)
    return { source: 'google', placeId: anchor.placeId, fetchedAt: anchor.placeCoordsAt };
  return {
    source: 'own',
    placeId: place.transactions.find((row) => row.placeId)?.placeId ?? null,
  };
}

/** The shops paid at a place under their known names, most visited first. */
function shopsAt(
  place: Place,
  aliases: PastPlaceInput['aliases'],
  matches: (name: string) => boolean = () => true,
) {
  const shops = new Map<string, { key: string; name: string; visits: number }>();
  for (const row of place.transactions) {
    const name = merchantName(row.merchant, aliases)?.trim();
    if (!name || !matches(name)) continue;
    const key = merchantKey(name) ?? name.toLowerCase();
    const shop = shops.get(key);
    if (shop) shop.visits += 1;
    else shops.set(key, { key, name, visits: 1 });
  }
  return [...shops.values()].sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name));
}

function placeBase(place: Place) {
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    categoryId: place.categories[0]?.categoryId ?? null,
    coords: coordsOf(place),
  };
}

/**
 * The user's own places that match the query: a shop they paid at a place, by the name they
 * know it by, or a place by its name or area. Most visited first. Nothing leaves the phone.
 */
export function searchPastPlaces(query: string, input: PastPlaceInput): PlaceOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const found: { option: PlaceOption; visits: number }[] = [];
  for (const place of groupPlaces(input.transactions, { currency: input.currency })) {
    const base = placeBase(place);
    const shops = shopsAt(place, input.aliases, (name) => name.toLowerCase().includes(q));
    for (const shop of shops)
      found.push({
        option: {
          ...base,
          id: `${place.id}:${shop.key}`,
          title: shop.name,
          meta: place.name === shop.name ? place.area : place.name,
          shop: shop.name,
        },
        visits: shop.visits,
      });
    if (!shops.length && [place.name, place.area].some((part) => part?.toLowerCase().includes(q)))
      found.push({
        option: { ...base, id: place.id, title: place.name, meta: place.area, shop: null },
        visits: place.count,
      });
  }
  return found
    .sort((a, b) => b.visits - a.visits || a.option.title.localeCompare(b.option.title))
    .slice(0, LIMIT)
    .map((row) => row.option);
}

/** "120 m", or nothing under 5 m. Google asks that a missing or 0 distance is never shown. */
export function distanceWords(metres: number | null): string | null {
  if (!metres || metres < 5) return null;
  if (metres < 1000) return `${Math.max(10, Math.round(metres / 10) * 10)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/**
 * "Near you": the user's own places within `NEAR_M` of the map's centre, nearest first, each
 * under its most visited shop with "120 m · 4 visits". Free, and the likeliest answers.
 */
export function nearPlaces(centre: LatLng | null, input: PastPlaceInput): PlaceOption[] {
  if (!centre) return [];
  return groupPlaces(input.transactions, { currency: input.currency })
    .map((place) => ({ place, metres: distanceM(centre, place) }))
    .filter(({ metres }) => metres <= NEAR_M)
    .sort((a, b) => a.metres - b.metres || b.place.count - a.place.count)
    .slice(0, LIMIT)
    .map(({ place, metres }) => {
      const shop = shopsAt(place, input.aliases)[0] ?? null;
      const count = shop?.visits ?? place.count;
      const visits = `${count} ${count === 1 ? 'visit' : 'visits'}`;
      return {
        ...placeBase(place),
        id: place.id,
        title: shop?.name ?? place.name,
        meta: [distanceWords(metres), visits].filter(Boolean).join(' · '),
        shop: shop?.name ?? null,
      };
    });
}

export type PlaceRow =
  | { kind: 'own'; option: PlaceOption }
  | { kind: 'google'; prediction: PlacePrediction }
  | { kind: 'address'; option: PlaceOption };

/**
 * The search list: the user's own places first, then Google's predictions (minus places the
 * user already has), then the geocoder's addresses only when Google is unavailable or finds
 * nothing.
 */
export function searchRows({
  own,
  google,
  addresses,
}: {
  own: readonly PlaceOption[];
  google: GoogleSearch;
  addresses: readonly PlaceOption[];
}): PlaceRow[] {
  const known = new Set(own.map((option) => option.coords.placeId));
  const predictions = google.status === 'done' ? google.predictions : [];
  const fallback =
    google.status === 'unavailable' || (google.status === 'done' && !predictions.length);
  return [
    ...own.map((option) => ({ kind: 'own' as const, option })),
    ...predictions
      .filter((prediction) => !known.has(prediction.placeId))
      .map((prediction) => ({ kind: 'google' as const, prediction })),
    ...(fallback ? addresses.map((option) => ({ kind: 'address' as const, option })) : []),
  ];
}
