import { observable, syncState, type Observable } from '@legendapp/state';
import { createMMKV } from 'react-native-mmkv';
import { observablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv';
import {
  configureSyncedSupabase,
  syncedSupabase,
} from '@legendapp/state/sync-plugins/supabase';
import { supabase } from '@/lib/supabase/client';
import { randomUUID } from 'expo-crypto';

/** Separate MMKV instance from supabase-auth (session tokens). */
export const legendMMKV = createMMKV({ id: 'legend-store' });

const persistPlugin = observablePersistMMKV({ id: 'legend-store' });

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
