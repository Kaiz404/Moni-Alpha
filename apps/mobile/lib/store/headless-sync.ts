/**
 * Sync for code that runs with the app killed: the background processor and the review
 * notification's actions. Normally the React tree's StoreSyncActivator turns sync on; headless,
 * nothing has, so a write would sit in MMKV until the next app open, or never leave at all.
 */
import { observe, syncState, type Observable } from '@legendapp/state';

import { authReady$, enableStoreSync, store, whenStoreSynced } from '@/lib/store';
import { supabase } from '@/lib/supabase/client';

/** Bounds the wait for Supabase to accept the writes before a headless task ends. */
export const SYNC_WAIT_MS = 10_000;
const POLL_MS = 100;

let starting: Promise<boolean> | null = null;

async function start(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return false;
  // Legend-State skips remote I/O for a root no one observes. These last as long as the process.
  for (const obs$ of store.all) observe(() => obs$.get());
  authReady$.set(true);
  await enableStoreSync();
  return true;
}

/**
 * Turns sync on for a signed-in user if nothing has yet, and waits out a pull in flight, such as
 * the one the app runs as it opens. False when no one is signed in.
 */
export async function ensureStoreSync(): Promise<boolean> {
  if (!starting && authReady$.peek()) {
    await whenStoreSynced();
    return true;
  }
  starting ??= start().finally(() => {
    starting = null;
  });
  return starting;
}

/** Row ids with a write Supabase has not accepted yet. `''` stands for the whole table. */
function unsyncedRowIds(table$: Observable<unknown>): string[] {
  const pending = syncState(table$).peek().getPendingChanges?.() ?? {};
  return Object.keys(pending).map((path) => path.split('/')[0] ?? '');
}

function hasRow(tables: Observable<unknown>[], id: string): boolean {
  return tables.some((table$) => {
    const rows = table$.peek() as Record<string, unknown> | null | undefined;
    return rows?.[id] != null;
  });
}

function isSynced(tables: Observable<unknown>[], rowIds: readonly string[] | undefined): boolean {
  if (rowIds && !rowIds.every((id) => hasRow(tables, id))) return false;
  return tables.every((table$) => {
    const unsynced = unsyncedRowIds(table$);
    if (!rowIds) return unsynced.length === 0;
    return !unsynced.some((id) => id === '' || rowIds.includes(id));
  });
}

/**
 * True once Supabase has accepted every write to `rowIds` in `tables`, or to anything in them
 * when no ids are given. False when `timeoutMs` runs out first, or when a row is gone.
 */
export async function waitForSync(
  tables: Observable<unknown>[],
  { rowIds, timeoutMs = SYNC_WAIT_MS }: { rowIds?: readonly string[]; timeoutMs?: number } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  // Legend-State records a write as pending a few microtasks after the set.
  await new Promise((resolve) => setTimeout(resolve, 0));
  while (!isSynced(tables, rowIds)) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return true;
}

/** Runs `run` with sync on, then waits for Supabase to accept what it wrote to `tables`. */
export async function withStore(
  tables: Observable<unknown>[],
  run: () => Promise<void>,
): Promise<void> {
  if (!(await ensureStoreSync())) return;
  await run();
  await waitForSync(tables);
}
