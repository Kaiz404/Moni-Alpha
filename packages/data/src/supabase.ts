import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@repo/types/database';

/** The Supabase client both apps hand in: the Expo client on the phone, `@supabase/ssr`'s on the web. */
export type MoniSupabase = SupabaseClient<Database>;

/** Tables the store mirrors, each with `id`, `created_at`, `updated_at` and `deleted`. */
export const SYNCED_TABLES = [
  'wallets',
  'transactions',
  'categories',
  'tags',
  'transaction_tags',
  'category_budgets',
  'debts',
  'debt_activities',
  'proposed_transactions',
  'recurring_overrides',
  'auto_add_rules',
  'merchant_aliases',
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

/** Offline, or the request never got an answer: the browser says "Failed to fetch", React Native "Network request failed". */
export function isNetworkError(message: string | undefined): boolean {
  return !!message && /Failed to fetch|Network request failed/.test(message);
}
