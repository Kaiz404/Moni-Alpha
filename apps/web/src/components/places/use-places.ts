'use client';

import {
  addMinor,
  type CurrencyCode,
  type MinorAmount,
} from '@repo/types';
import {
  groupPlaces,
  placeDays,
  placeRange,
  placesSpan,
  unplacedExpenses,
  type FinanceTransaction,
  type Place,
  type PlaceDay,
  type PlaceRange,
} from '@repo/core';
import { useMemo } from 'react';
import { readPlacesQuery, sortPlaces, type PlacesQuery } from '@/lib/places-view';
import type { Ledger } from '@/lib/ledger/use-ledger';

export type FilterOption = { id: string | null; label: string; icon: string | null; color: string | null; amountMinor: MinorAmount };

export type PlacesData = {
  query: PlacesQuery;
  range: PlaceRange;
  /** Every place the user has, any range or filter: the map's frame and Add a place's choices. */
  everywhere: Place[];
  /** The places the filters count, in the list's order. */
  places: Place[];
  selected: Place | null;
  loose: FinanceTransaction[];
  days: PlaceDay[];
  categoryOptions: FilterOption[];
  walletOptions: FilterOption[];
  /** Every live wallet records no location for new payments. */
  locationOff: boolean;
};

function totalsBy(places: readonly Place[], key: (transaction: FinanceTransaction) => string | null) {
  const totals = new Map<string | null, MinorAmount>();
  for (const place of places)
    for (const transaction of place.transactions)
      totals.set(key(transaction), addMinor(totals.get(key(transaction)) ?? 0, transaction.amountMinor));
  return totals;
}

/** Where you spend from the read model: the URL's filters over `groupPlaces` and the expenses with no place. */
export function usePlaces(ledger: Ledger, params: URLSearchParams): PlacesData {
  const { transactions, currency, calendar, now, projection, wallets } = ledger;
  const search = params.toString();
  return useMemo(() => {
    const query = readPlacesQuery(new URLSearchParams(search));
    const range = placeRange(query.range, now, calendar);
    const base = { currency: currency as CurrencyCode, range: range.span };
    const everywhere = groupPlaces(transactions, { currency }, calendar);
    const counted = groupPlaces(transactions, { ...base, categoryId: query.categoryId, walletId: query.walletId }, calendar);
    const places = sortPlaces(counted, query.sort);
    const byCategory = totalsBy(groupPlaces(transactions, { ...base, walletId: query.walletId }, calendar), (t) => t.categoryId);
    const byWallet = totalsBy(groupPlaces(transactions, { ...base, categoryId: query.categoryId }, calendar), (t) => t.walletId);
    const all = (totals: Map<string | null, MinorAmount>) => addMinor(0, ...totals.values());
    const categoryOptions: FilterOption[] = [
      { id: null, label: 'All categories', icon: 'shape-outline', color: null, amountMinor: all(byCategory) },
      ...[...byCategory.entries()]
        .filter((entry): entry is [string, MinorAmount] => entry[0] !== null)
        .sort((a, b) => b[1] - a[1])
        .map(([id, amountMinor]) => {
          const category = projection.categoriesById[id];
          return { id, label: category?.name ?? 'Other', icon: category?.icon ?? null, color: category?.color ?? null, amountMinor };
        }),
    ];
    const walletOptions: FilterOption[] = [
      { id: null, label: 'All wallets', icon: 'wallet-outline', color: null, amountMinor: all(byWallet) },
      ...wallets
        .filter((wallet) => byWallet.has(wallet.id))
        .map((wallet) => ({ id: wallet.id, label: wallet.name, icon: wallet.icon, color: wallet.color, amountMinor: byWallet.get(wallet.id)! })),
    ];
    return {
      query,
      range,
      everywhere,
      places,
      selected: places.find((place) => place.id === query.placeId) ?? null,
      loose: unplacedExpenses(transactions, { ...base, categoryId: query.categoryId, walletId: query.walletId }, calendar),
      days: placeDays(placesSpan(range, counted, calendar.dayKey(now), calendar)),
      categoryOptions,
      walletOptions,
      locationOff: wallets.length > 0 && wallets.every((wallet) => wallet.recordLocation === false),
    };
  }, [search, transactions, currency, calendar, now, projection, wallets]);
}
