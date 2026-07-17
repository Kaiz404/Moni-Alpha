/**
 * Legend-State synced observables (wallets, transactions, etc.).
 * Persistence is MMKV-backed via `@/lib/mmkv/legend-store` — not to be confused with
 * auth session storage (`lib/mmkv/auth`) or receipt upload queue (`lib/mmkv/image-uploads`).
 */
import { observable, syncState, when, type Observable } from '@legendapp/state';
import {
  configureSyncedSupabase,
  syncedSupabase,
} from '@legendapp/state/sync-plugins/supabase';
import { legendMMKV, legendPersistPlugin } from '@/lib/mmkv/legend-store';
import { supabase } from '@/lib/supabase/client';
import { randomUUID } from 'expo-crypto';
import { authReady$ } from '@/lib/store/auth-sync';

const persistPlugin = legendPersistPlugin;

const persistOptions = {
  plugin: persistPlugin,
  retrySync: true as const,
};

const waitForAuth = () => authReady$.get();

const SYNC_CREATE_REPAIR_KEY = 'legend-sync-create-repair-v1';

configureSyncedSupabase({
  generateId: () => randomUUID(),
  changesSince: 'last-sync',
  fieldCreatedAt: 'created_at',
  fieldUpdatedAt: 'updated_at',
  fieldDeleted: 'deleted',
});

function syncTable(collection: string, extra?: Record<string, unknown>) {
  return syncedSupabase({
    supabase,
    collection,
    realtime: true,
    persist: { name: collection, ...persistOptions },
    waitFor: waitForAuth,
    waitForSet: waitForAuth,
    ...extra,
  });
}

export const wallets$ = observable(syncTable('wallets'));
export const transactions$ = observable(syncTable('transactions'));
export const categories$ = observable(syncTable('categories'));
export const tags$ = observable(syncTable('tags'));
export const transactionTags$ = observable(syncTable('transaction_tags'));
export const categoryBudgets$ = observable(syncTable('category_budgets'));
export const debts$ = observable(syncTable('debts'));
export const debtActivities$ = observable(syncTable('debt_activities'));
export const aiInsights$ = observable(syncTable('ai_insights'));
export const proposedTransactions$ = observable(syncTable('proposed_transactions'));

export const ALL_STORE_OBSERVABLES: Observable<any>[] = [
  wallets$,
  transactions$,
  categories$,
  tags$,
  transactionTags$,
  categoryBudgets$,
  debts$,
  debtActivities$,
  aiInsights$,
  proposedTransactions$,
];

/**
 * Legend-State treats rows with `created_at` as updates. Older app versions set
 * timestamps locally, so those rows never INSERTed — re-queue them once as creates.
 */
function requeueLocalCreates(obs$: Observable<any>): void {
  const snapshot = obs$.peek() as Record<string, Record<string, unknown>> | null;
  if (!snapshot || typeof snapshot !== 'object') return;

  for (const id of Object.keys(snapshot)) {
    const row = snapshot[id];
    if (!row || typeof row !== 'object' || row.deleted) continue;
    if (!row.created_at) continue;

    const payload = { ...row };
    delete payload.created_at;
    delete payload.updated_at;

    obs$[id].delete();
    obs$[id].set(payload);
  }
}

function runOneTimeCreateRepair(): void {
  if (legendMMKV.getBoolean(SYNC_CREATE_REPAIR_KEY)) return;

  for (const obs$ of ALL_STORE_OBSERVABLES) {
    requeueLocalCreates(obs$);
  }

  legendMMKV.set(SYNC_CREATE_REPAIR_KEY, true);
}

/** Re-enable sync and pull from Supabase (after sign-in or when roots become observed). */
export async function enableStoreSync(options: { fullReset?: boolean } = {}): Promise<void> {
  if (!authReady$.get()) return;

  runOneTimeCreateRepair();

  const forceFullPull = options.fullReset ?? false;

  for (const obs$ of ALL_STORE_OBSERVABLES) {
    const state$ = syncState(obs$);
    state$.assign({
      isSyncEnabled: true,
      isPersistEnabled: true,
      error: undefined,
    });

    await when(state$.isPersistLoaded);

    const needsFullPull = forceFullPull || !state$.isLoaded.peek();
    await state$.get().sync?.({ resetLastSync: needsFullPull });

    // Legend-State leaves lastSync unset after an empty pull; still mark success for UI.
    if (!state$.lastSync.peek() && !state$.error.peek()) {
      state$.lastSync.set(Date.now());
    }
  }
}

/** Wipe local Legend-State cache on sign-out (must reset sync metadata, not just MMKV). */
export async function clearStore(): Promise<void> {
  authReady$.set(false);

  for (const obs$ of ALL_STORE_OBSERVABLES) {
    const state$ = syncState(obs$);
    state$.isSyncEnabled.set(false);
    state$.isPersistEnabled.set(false);
  }

  await Promise.all(
    ALL_STORE_OBSERVABLES.map(async (obs$) => {
      const state$ = syncState(obs$);
      const { reset } = state$.get();
      if (reset) {
        await reset();
        return;
      }
      await state$.get().resetPersistence?.();
      obs$.set({});
    }),
  );

  legendMMKV.clearAll();
}
