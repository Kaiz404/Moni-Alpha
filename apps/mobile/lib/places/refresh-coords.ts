import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { preferencesMMKV } from '@/lib/mmkv/preferences';
import { isMigrated, transactions$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import { setPlaceCoords, type PlaceCoordsUpdate } from '@/lib/supabase/transactions';

import { getPlacesClient } from './client';
import type { DetailsResult } from './types';

const DAY_MS = 86_400_000;
/** Google's coordinates are refreshed from this age, leaving five days of daily retries. */
export const REFRESH_AFTER_DAYS = 25;
/** Google allows keeping Places coordinates this long. */
export const KEEP_DAYS = 30;
export const RUN_LIMIT = 20;
const REFRESHED_ON_KEY = 'place-coords-refreshed-on';

export type GoogleCoordsRow = { id: string; placeId: string; placeCoordsAt: string };

type StoredRow = {
  id: string;
  deleted?: boolean;
  place_id?: string | null;
  place_coords_at?: string | null;
};

const ageDays = (row: GoogleCoordsRow, now: Date) =>
  (now.getTime() - Date.parse(row.placeCoordsAt)) / DAY_MS;

/** Rows holding Google's coordinates for 25 days or more, oldest first, at most `limit`. */
export function dueForRefresh(
  rows: readonly GoogleCoordsRow[],
  now: Date,
  limit = RUN_LIMIT,
): GoogleCoordsRow[] {
  return rows
    .filter((row) => ageDays(row, now) >= REFRESH_AFTER_DAYS)
    .sort((a, b) => a.placeCoordsAt.localeCompare(b.placeCoordsAt))
    .slice(0, limit);
}

/**
 * What a refresh writes: Google's fresh coordinates, or, once the old ones pass 30 days and Google
 * still cannot answer, no coordinates (the place ID and the user's name for it stay). Null keeps
 * the row as it is for tomorrow's run.
 */
export function refreshedCoords(
  row: GoogleCoordsRow,
  result: DetailsResult,
  now: Date,
): PlaceCoordsUpdate | null {
  if (result.status === 'ok')
    return {
      latitude: result.place.latitude,
      longitude: result.place.longitude,
      placeCoordsAt: now.toISOString(),
    };
  if (ageDays(row, now) >= KEEP_DAYS)
    return { latitude: null, longitude: null, placeCoordsAt: null };
  return null;
}

function googleRows(): GoogleCoordsRow[] {
  return getRecordValues<StoredRow>(transactions$).flatMap((row) =>
    !row.deleted && row.place_id && row.place_coords_at
      ? [{ id: row.id, placeId: row.place_id, placeCoordsAt: row.place_coords_at }]
      : [],
  );
}

let running = false;

/** Once a day, on foreground: refresh or drop Google coordinates that are getting old. */
export async function refreshPlaceCoordsDaily(now = new Date()): Promise<void> {
  const today = toLocalDateInput(now);
  if (running || !isMigrated('transaction_place_ids')) return;
  if (preferencesMMKV.getString(REFRESHED_ON_KEY) === today) return;
  running = true;
  try {
    const client = getPlacesClient();
    for (const row of dueForRefresh(googleRows(), now)) {
      const result = await client.details({ placeId: row.placeId, sessionToken: null });
      const update = refreshedCoords(row, result, now);
      if (update) setPlaceCoords(row.id, update);
    }
    preferencesMMKV.set(REFRESHED_ON_KEY, today);
  } finally {
    running = false;
  }
}
