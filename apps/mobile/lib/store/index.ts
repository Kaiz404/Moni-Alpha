/**
 * Legend-State synced observables (wallets, transactions, etc.).
 * Persistence is MMKV-backed via `@/lib/mmkv/legend-store` — not to be confused with
 * auth session storage (`lib/mmkv/auth`) or receipt upload queue (`lib/mmkv/image-uploads`).
 */
import { observable, syncState, type Observable } from '@legendapp/state';
import {
  configureSyncedSupabase,
  syncedSupabase,
} from '@legendapp/state/sync-plugins/supabase';
import { legendMMKV, legendPersistPlugin } from '@/lib/mmkv/legend-store';
import { supabase } from '@/lib/supabase/client';
import { randomUUID } from 'expo-crypto';

const persistPlugin = legendPersistPlugin;

const persistOptions = {
  plugin: persistPlugin,
  retrySync: true as const,
};

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
    ...extra,
  });
}

export const wallets$ = observable(syncTable('wallets'));
export const transactions$ = observable(syncTable('transactions'));
export const categories$ = observable(syncTable('categories'));
export const tags$ = observable(syncTable('tags'));
export const transactionTags$ = observable(syncTable('transaction_tags'));
export const categoryBudgets$ = observable(syncTable('category_budgets'));
export const aiInsights$ = observable(syncTable('ai_insights'));
export const proposedTransactions$ = observable(syncTable('proposed_transactions'));

const ALL_STORE_OBSERVABLES: Observable<any>[] = [
  wallets$,
  transactions$,
  categories$,
  tags$,
  transactionTags$,
  categoryBudgets$,
  aiInsights$,
  proposedTransactions$,
];

/** Wipe local Legend-State cache on sign-out. */
export async function clearStore(): Promise<void> {
  await Promise.all(ALL_STORE_OBSERVABLES.map((obs$) => syncState(obs$).clearPersist()));
  legendMMKV.clearAll();
  for (const obs$ of ALL_STORE_OBSERVABLES) {
    obs$.set({});
  }
}
