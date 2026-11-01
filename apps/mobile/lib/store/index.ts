/**
 * Legend-State synced observables (wallets, transactions, etc.).
 * Persistence is MMKV-backed via `@/lib/mmkv/legend-store` — not to be confused with
 * auth session storage (`lib/mmkv/auth`) or receipt upload queue (`lib/mmkv/image-uploads`).
 */
import { observable, syncState, when, type Observable } from '@legendapp/state';
import { synced } from '@legendapp/state/sync';
import { configureSyncedSupabase, syncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import type { UserPreferences } from '@repo/types';
import { legendMMKV, legendPersistPlugin } from '@/lib/mmkv/legend-store';
import { supabase } from '@/lib/supabase/client';
import { getProfilePreferences } from '@/lib/supabase/profile';
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

type CreateParams = { onError: (error: Error, params: Record<string, unknown>) => void };

/**
 * A pull never brings a soft-deleted row to this phone, so a restore can create a row whose id the
 * server still holds. Insert as usual; on the key clash, bring a soft-deleted row back, or adopt
 * the row already live, which a create must never overwrite.
 */
function createOrRevive(collection: string) {
  return async (input: Record<string, unknown>, params: CreateParams) => {
    const fail = (message: string) => {
      params.onError(new Error(message), {
        setParams: params,
        source: 'create',
        type: 'set',
        retry: params,
        input,
      });
      return { data: undefined };
    };
    const inserted = await supabase.from(collection).insert(input).select();
    if (inserted.error?.code !== '23505') {
      return inserted.error ? fail(inserted.error.message) : { data: inserted.data?.[0] };
    }
    const revived = await supabase
      .from(collection)
      .update(input)
      .eq('id', input.id as string)
      .eq('deleted', true)
      .select();
    if (revived.error) return fail(revived.error.message);
    if (revived.data?.length) return { data: revived.data[0] };
    const live = await supabase
      .from(collection)
      .select()
      .eq('id', input.id as string);
    // Nothing under this id means another unique key clashed, which is a real failure.
    return live.data?.length ? { data: live.data[0] } : fail(inserted.error.message);
  };
}

const PULL_PAGE = 1000;

/**
 * PostgREST cuts a response at the server's `max_rows` and reports no error, so the plugin's own
 * one-request list leaves a larger table short on the phone. Pages run in id order, which an edit
 * never changes, so no row moves between pages. Only an empty page ends the pull: a page shorter
 * than asked may just mean the server's cap is lower than `PULL_PAGE`.
 */
function pagedList(collection: string) {
  return async ({ lastSync }: { lastSync?: number }) => {
    const data: Record<string, unknown>[] = [];
    while (true) {
      const changed = lastSync
        ? supabase
            .from(collection)
            .select()
            .gt('updated_at', new Date(lastSync).toISOString())
        : supabase.from(collection).select();
      const page = await changed.order('id').range(data.length, data.length + PULL_PAGE - 1);
      // The plugin's own list rethrows this one so its retry can run.
      if (page.error?.message?.includes('Failed to fetch')) throw page.error;
      if (page.error) return { data: null, error: page.error };
      if (!page.data.length) return { data, error: null };
      data.push(...page.data);
    }
  };
}

function syncTable(collection: string, extra?: Record<string, unknown>) {
  return syncedSupabase({
    supabase,
    collection,
    list: pagedList(collection) as never,
    create: createOrRevive(collection) as never,
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
export const proposedTransactions$ = observable(syncTable('proposed_transactions'));
export const recurringOverrides$ = observable(syncTable('recurring_overrides'));

/**
 * Migrations the operator can push after the build that needs them, each with a table it
 * creates. Finding that table proves the whole migration ran.
 */
const GATED_MIGRATIONS = {
  review_later_and_auto_add_rules: 'auto_add_rules',
  merchant_aliases_and_wallet_location: 'merchant_aliases',
} as const;
/** Migrations that only add columns, each with one column that proves it ran. */
const GATED_COLUMNS = {
  recurring_override_bills: 'recurring_overrides.skip_period',
  review_history: 'proposed_transactions.reviewed_at',
  capture_pairing: 'proposed_transactions.pairing',
} as const;
export type GatedMigration = keyof typeof GATED_MIGRATIONS | keyof typeof GATED_COLUMNS;
const migrationFound$ = observable<Partial<Record<GatedMigration, boolean>>>({});
const TABLE_FOUND_KEY_PREFIX = 'table-found:';

/**
 * Writers check this first: a row written while its table is gated never reaches the server and
 * is gone once the gate opens (migration-gate.test.ts).
 */
export function assertMigrated(migration: GatedMigration): void {
  if (!isMigrated(migration)) {
    throw new Error('Moni needs a server update before it can save this. Try again later.');
  }
}

/** For a writer that has an older way to save while its migration is not pushed yet. */
export function isMigrated(migration: GatedMigration): boolean {
  return migrationFound$[migration].peek() === true;
}

function syncTableOnceMigrated(migration: keyof typeof GATED_MIGRATIONS) {
  const ready$ = observable(() => authReady$.get() && migrationFound$[migration].get() === true);
  return syncTable(GATED_MIGRATIONS[migration], { waitFor: ready$, waitForSet: () => ready$ });
}

async function probeGatedMigrations(): Promise<void> {
  await Promise.all(
    Object.entries({ ...GATED_MIGRATIONS, ...GATED_COLUMNS }).map(async ([migration, probe]) => {
      const found$ = migrationFound$[migration as GatedMigration];
      if (found$.peek()) return;
      const key = TABLE_FOUND_KEY_PREFIX + probe;
      if (!legendMMKV.getBoolean(key)) {
        const [table, column = 'id'] = probe.split('.');
        const { error } = await supabase.from(table).select(column).limit(1);
        if (error) return;
        legendMMKV.set(key, true);
      }
      found$.set(true);
    }),
  );
}

export const autoAddRules$ = observable(syncTableOnceMigrated('review_later_and_auto_add_rules'));
export const merchantAliases$ = observable(
  syncTableOnceMigrated('merchant_aliases_and_wallet_location'),
);

export const profilePreferences$ = observable<UserPreferences | undefined>(
  synced({
    get: getProfilePreferences,
    persist: { name: 'profile_preferences', ...persistOptions },
    waitFor: waitForAuth,
  }),
);

export const ALL_STORE_OBSERVABLES: Observable<any>[] = [
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
  await probeGatedMigrations();

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
