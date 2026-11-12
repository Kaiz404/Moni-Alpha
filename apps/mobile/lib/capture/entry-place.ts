import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { placeLabel } from '@/lib/finance/places';
import { placeColumns, type PlaceColumns } from '@/lib/places/coords';
import type {
  EntryLocation,
  TransactionLocationSnapshot,
} from '@/lib/transactions/prefetch-location';

/**
 * Where a new entry says it happened. `auto` follows the phone's position where the wallet's
 * app allows it; `chosen` is a place picked on the map or a suggestion the user accepted;
 * `off` saves no place.
 */
export type EntryPlace =
  | { kind: 'auto' }
  | { kind: 'chosen'; place: TransactionLocationSnapshot }
  | { kind: 'off' };

export const AUTO_PLACE: EntryPlace = { kind: 'auto' };

/** What the place sheet resolves to. `shop` names a shop the user picked, not a street. */
export type PlacePick =
  | { kind: 'chosen'; place: TransactionLocationSnapshot; shop: string | null }
  | { kind: 'off' };

export type EntryPlaceInput = {
  place: EntryPlace;
  /** The phone's position for this entry. */
  here: EntryLocation;
  /** False for a wallet whose app has location off: the phone's position is never saved. */
  phoneAllowed: boolean;
};

/**
 * Whether the phone's position may stand for this entry: the wallet's app allows location and the
 * entry is dated today, so a receipt scanned at home for last week's dinner is not pinned at home.
 */
export function phoneMayLocate(
  wallet: { recordLocation?: boolean } | null | undefined,
  localDate: string,
  today: string = toLocalDateInput(new Date()),
): boolean {
  return wallet?.recordLocation !== false && localDate === today;
}

/** The one place saved with the entry, or null. */
export function savedLocation({
  place,
  here,
  phoneAllowed,
}: EntryPlaceInput): TransactionLocationSnapshot | null {
  switch (place.kind) {
    case 'off':
      return null;
    case 'chosen':
      return place.place;
    case 'auto':
      return phoneAllowed && here.status === 'found' ? here.location : null;
  }
}

/** The transaction columns for the entry's place, given Shop or note at save time. */
export function locationColumns(
  input: EntryPlaceInput,
  note: string,
  placeIdsReady: boolean,
): PlaceColumns {
  return placeColumns(savedLocation(input), {
    phone: input.phoneAllowed && input.here.status === 'found' ? input.here.location : null,
    note,
    placeIdsReady,
  });
}

/** What the Location field reads. */
export type LocationFieldState =
  | { kind: 'finding' }
  | { kind: 'place'; name: string }
  /** Nothing to save yet: no permission, the wallet's app has location off, or no position. */
  | { kind: 'empty' }
  | { kind: 'off' };

export function locationFieldState(input: EntryPlaceInput): LocationFieldState {
  if (input.place.kind === 'off') return { kind: 'off' };
  if (
    input.place.kind === 'auto' &&
    input.phoneAllowed &&
    input.here.status === 'finding'
  )
    return { kind: 'finding' };
  const location = savedLocation(input);
  return location
    ? { kind: 'place', name: placeLabel(location.name)?.name ?? 'Pinned place' }
    : { kind: 'empty' };
}

/**
 * The phone's position a place suggestion may read: only while the entry follows the phone,
 * so a place the user picked or turned off is never second-guessed.
 */
export function suggestionSpot(
  input: EntryPlaceInput,
): TransactionLocationSnapshot | null {
  return input.place.kind === 'auto' ? savedLocation(input) : null;
}

/** A pick from the sheet: the new place, and the shop name for an empty Shop or note. */
export function applyPlacePick(
  pick: PlacePick,
  note: string,
): { place: EntryPlace; note: string } {
  if (pick.kind === 'off') return { place: { kind: 'off' }, note };
  return {
    place: { kind: 'chosen', place: pick.place },
    note: !note.trim() && pick.shop ? pick.shop : note,
  };
}
