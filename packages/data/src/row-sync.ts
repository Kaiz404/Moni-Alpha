import type { Row, RowResult } from './gateway';

/** This device's writes to one row: the last one queued, how many are still out, the server's stamp on the last that landed. */
type RowWrites = { tail: Promise<unknown>; out: number; landedAt: number };
/** A create still out, numbered in the order writes were handed over, settling once it has landed or failed. */
type Create = { order: number; settled: Promise<unknown> };

/**
 * One local change reaches sync as a write per table, each a few promise steps after the last, and in
 * no set order. A timer runs after them all, so by then every write of the change has been handed over.
 */
const afterHandOver = () => new Promise((resolve) => setTimeout(resolve, 0));

function stamp(value: unknown): number {
  const at = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isNaN(at) ? -Infinity : at;
}

/**
 * Sync can have several writes to one row out at once (a change, then its Undo a second later), and
 * the change feed echoes each one back after it lands. Writes to a row go out one at a time, in the
 * order they were made, so the server ends on the last. A write that points at a row still being
 * created (an Approve's capture and its new ledger row) waits for that create, or the foreign key
 * refuses it. An echo is set against the server's own `updated_at` on this device's last landed
 * write, never the device's clock, which can be far off.
 */
export function createRowSync() {
  const rows = new Map<string, RowWrites>();
  const creates = new Map<string, Create>();
  let handedOver = 0;

  /**
   * The creates a row's values point at. A create waits only for creates handed over before it, so
   * two new rows that point at each other (a restored transfer pair) can't wait on each other.
   */
  function pointedAt(version: Row, before: number): Promise<unknown>[] {
    return Object.values(version).flatMap((value) => {
      const create = typeof value === 'string' && value !== version.id ? creates.get(value) : undefined;
      return create && create.order < before ? [create.settled] : [];
    });
  }

  function send(table: string, version: Row, kind: 'create' | 'update', write: () => Promise<RowResult>): Promise<RowResult> {
    const id = String(version.id);
    const key = `${table}/${id}`;
    const order = (handedOver += 1);
    const row = rows.get(key) ?? { tail: Promise.resolve(), out: 0, landedAt: -Infinity };
    rows.set(key, row);
    row.out += 1;
    const sent = row.tail
      .then(afterHandOver)
      .then(() => Promise.all(pointedAt(version, kind === 'create' ? order : Infinity)))
      .then(write)
      .then((result) => {
        if (result.ok) row.landedAt = Math.max(row.landedAt, stamp(result.row?.updated_at));
        return result;
      })
      .finally(() => {
        row.out -= 1;
      });
    row.tail = sent.catch(() => undefined);
    if (kind === 'create') {
      const create = { order, settled: row.tail };
      creates.set(id, create);
      void create.settled.then(() => {
        if (creates.get(id) === create) creates.delete(id);
      });
    }
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
