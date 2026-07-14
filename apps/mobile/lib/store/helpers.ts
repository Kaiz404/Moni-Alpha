import type { Observable } from '@legendapp/state';

/** Active flag from Postgres (boolean or 0/1 integer). */
export function isActive(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

export function getRecordValues<T extends Record<string, unknown>>(
  obs$: Observable<any>,
): T[] {
  const raw = obs$.get();
  if (!raw || typeof raw !== 'object') return [];
  return Object.values(raw).filter(
    (row): row is T => row != null && typeof row === 'object' && !(row as { deleted?: boolean }).deleted,
  );
}

/** True when the table snapshot already has a non-deleted row for `id`. */
export function hasRow(table$: Observable<any>, id: string): boolean {
  const snapshot = table$.peek() as Record<string, { deleted?: boolean } | undefined> | null;
  const row = snapshot?.[id];
  return row != null && typeof row === 'object' && !row.deleted;
}

/** Patch a synced row by id (Legend-State child observable). */
export function patchRow(
  table$: Observable<any>,
  id: string,
  patch: Record<string, unknown>,
): void {
  if (!hasRow(table$, id)) {
    throw new Error(`Cannot patch missing row: ${id}`);
  }
  const row$ = table$[id] as { assign?: (value: Record<string, unknown>) => void } | undefined;
  if (!row$?.assign) {
    throw new Error(`Cannot patch missing row: ${id}`);
  }
  row$.assign(patch);
}
