import type { Row, RowResult } from './gateway';

/** This device's writes to one row: the last one queued, how many are still out, the server's stamp on the last that landed. */
type RowWrites = { tail: Promise<unknown>; out: number; landedAt: number };

function stamp(value: unknown): number {
  const at = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isNaN(at) ? -Infinity : at;
}

/**
 * Sync can have several writes to one row out at once (a change, then its Undo a second later), and
 * the change feed echoes each one back after it lands. Writes to a row go out one at a time, in the
 * order they were made, so the server ends on the last. An echo is set against the server's own
 * `updated_at` on this device's last landed write, never the device's clock, which can be far off.
 */
export function createRowSync() {
  const rows = new Map<string, RowWrites>();

  function send(key: string, write: () => Promise<RowResult>): Promise<RowResult> {
    const row = rows.get(key) ?? { tail: Promise.resolve(), out: 0, landedAt: -Infinity };
    rows.set(key, row);
    row.out += 1;
    const sent = row.tail
      .then(write)
      .then((result) => {
        if (result.ok) row.landedAt = Math.max(row.landedAt, stamp(result.row?.updated_at));
        return result;
      })
      .finally(() => {
        row.out -= 1;
      });
    row.tail = sent.catch(() => undefined);
    return sent;
  }

  /**
   * Whether the change feed's version of a row is newer than the one the device holds. For a row this
   * device wrote, the server's answer is the measure: while a write is out its answer brings the row
   * back, and a version no newer than the last answer is that write's echo.
   */
  function isNewer(key: string, version: Row, held: Row | undefined): boolean {
    const row = rows.get(key);
    if (!row) return !held || stamp(version.updated_at) > stamp(held.updated_at ?? held.created_at);
    if (row.out > 0 || stamp(version.updated_at) <= row.landedAt) return false;
    rows.delete(key);
    return true;
  }

  return { send, isNewer };
}
