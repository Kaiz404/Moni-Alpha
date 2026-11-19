/**
 * The phone's copy of the shared store (`@repo/data`): MMKV `legend-store` keeps the rows, not to be
 * confused with auth session storage (`lib/mmkv/auth`) or the receipt upload queue
 * (`lib/mmkv/image-uploads`).
 */
import { createMoniStore } from '@repo/data';
import { randomUUID } from 'expo-crypto';

import { legendMMKV, legendPersistPlugin } from '@/lib/mmkv/legend-store';
import { supabase } from '@/lib/supabase/client';

export const store = createMoniStore({
  supabase,
  persist: { plugin: legendPersistPlugin, flags: legendMMKV },
  uuid: randomUUID,
});

export const {
  authReady$,
  wallets$,
  transactions$,
  categories$,
  tags$,
  transactionTags$,
  categoryBudgets$,
  debts$,
  debtActivities$,
  proposedTransactions$,
  recurringOverrides$,
  autoAddRules$,
  merchantAliases$,
  profilePreferences$,
  aiConsent$,
  enableStoreSync,
  whenStoreSynced,
  clearStore,
  isMigrated,
  assertMigrated,
} = store;

