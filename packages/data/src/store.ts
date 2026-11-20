import { observable, syncState, when, type Observable } from '@legendapp/state';
import { synced } from '@legendapp/state/sync';
import { configureSyncedSupabase, syncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import type { AiConsent } from '@repo/core';
import type { UserPreferences } from '@repo/types';

import { createRowGateway, type Failure, type Row } from './gateway';
import type { MoniPersist } from './persist';
import { fetchAiConsent, fetchProfilePreferences } from './profile';
import type { StoredRow, SyncedTable } from '@repo/core';

import type { MoniSupabase } from './supabase';

type WriteParams = {
  onError: (error: Error, params: Record<string, unknown>) => void;
  cancelRetry?: boolean;
};

const RETRY = { infinite: true, backoff: 'exponential', delay: 1_000, maxDelay: 5 * 60_000 } as const;

/**
 * Migrations the operator can push after the build that needs them, each with a table it creates.
 * Finding that table proves the whole migration ran.
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
  transaction_place_ids: 'transactions.place_id',
} as const;
export type GatedMigration = keyof typeof GATED_MIGRATIONS | keyof typeof GATED_COLUMNS;

const TABLE_FOUND_KEY_PREFIX = 'table-found:';
const SYNC_CREATE_REPAIR_KEY = 'legend-sync-create-repair-v1';

/** What signing out does on one platform besides clearing the store, such as the phone's capture queue. */
export type SignOutEffects = {
  beforeClear?: () => void | Promise<void>;
  afterClear?: () => void | Promise<void>;
};

export type CreateMoniStoreOptions = {
  supabase: MoniSupabase;
  persist: MoniPersist;
  uuid: () => string;
};

/**
 * The synced ledger both apps hold: one Legend observable per table, pulled in pages, merged with
 * realtime, persisted by the platform's plugin, and written back with revive and retry rules.
 */
export function createMoniStore({ supabase, persist, uuid }: CreateMoniStoreOptions) {
  const gateway = createRowGateway(supabase);
  const persistOptions = { plugin: persist.plugin, retrySync: true as const };

  /** True when Supabase has a signed-in user and the app has started observing the tables. */
  const authReady$ = observable(false);
  const waitForAuth = () => authReady$.get();

  configureSyncedSupabase({
    generateId: uuid,
    changesSince: 'last-sync',
    fieldCreatedAt: 'created_at',
    fieldUpdatedAt: 'updated_at',
    fieldDeleted: 'deleted',
  });

  /** Stops Legend-State retrying a write Supabase refused rather than one that never arrived. */
  function failWrite(params: WriteParams, failed: Failure, source: string, input: unknown) {
    if (!failed.retryable) params.cancelRetry = true;
    params.onError(new Error(failed.message), { setParams: params, source, type: 'set', retry: params, input });
    return { data: undefined };
  }

  const create = (table: SyncedTable) => async (input: Row, params: WriteParams) => {
    const result = await gateway.createOrRevive(table, input);
    return result.ok ? { data: result.row } : failWrite(params, result, 'create', input);
  };

  const update = (table: SyncedTable) => async (input: Row, params: WriteParams) => {
    const result = await gateway.update(table, input);
    return result.ok ? { data: result.row } : failWrite(params, result, 'update', input);
  };

  const list = (table: SyncedTable) => async (params: { lastSync?: number; cancelRetry?: boolean }) => {
    const result = await gateway.list(table, params.lastSync);
    if (result.ok) return { data: result.rows, error: null };
    // Thrown, so Legend-State's retry runs it again.
    if (result.retryable) throw new Error(result.message);
    params.cancelRetry = true;
    return { data: null, error: { message: result.message } };
  };

  function syncTable<T extends SyncedTable>(table: T, gate?: Observable<boolean>): Record<string, StoredRow<T>> {
    // Inferring the row type from the client's schema over a union of tables never finishes; StoredRow names it.
    const sync = syncedSupabase as (props: object) => Record<string, StoredRow<T>>;
    return sync({
      supabase,
      collection: table,
      list: list(table) as never,
      create: create(table) as never,
      ...(table === 'categories' || table === 'wallets' ? { update: update(table) as never } : {}),
      realtime: true,
      retry: RETRY,
      persist: { name: table, ...persistOptions },
      waitFor: gate ?? waitForAuth,
      waitForSet: gate ? () => gate : waitForAuth,
    });
  }

  const migrationFound$ = observable<Partial<Record<GatedMigration, boolean>>>({});

  /** For a writer that has an older way to save while its migration is not pushed yet. */
  function isMigrated(migration: GatedMigration): boolean {
    return migrationFound$[migration].peek() === true;
  }

  /**
   * Writers check this first: a row written while its table is gated never reaches the server and
   * is gone once the gate opens.
   */
  function assertMigrated(migration: GatedMigration): void {
    if (!isMigrated(migration)) {
      throw new Error('Moni needs a server update before it can save this. Try again later.');
    }
  }

  function syncTableOnceMigrated<M extends keyof typeof GATED_MIGRATIONS>(migration: M) {
    const ready$ = observable(() => authReady$.get() && migrationFound$[migration].get() === true);
    return syncTable(GATED_MIGRATIONS[migration], ready$);
  }

  async function probeGatedMigrations(): Promise<void> {
    await Promise.all(
      Object.entries({ ...GATED_MIGRATIONS, ...GATED_COLUMNS }).map(async ([migration, probe]) => {
        const found$ = migrationFound$[migration as GatedMigration];
        if (found$.peek()) return;
        const key = TABLE_FOUND_KEY_PREFIX + probe;
        if (!persist.flags.getBoolean(key)) {
          const [table, column = 'id'] = probe.split('.') as [SyncedTable, string?];
          const { error } = await supabase.from(table).select(column).limit(1);
          if (error) return;
          persist.flags.set(key, true);
        }
        found$.set(true);
      }),
    );
  }

  const tables = {
    wallets: observable(syncTable('wallets')),
    transactions: observable(syncTable('transactions')),
    categories: observable(syncTable('categories')),
    tags: observable(syncTable('tags')),
    transaction_tags: observable(syncTable('transaction_tags')),
    category_budgets: observable(syncTable('category_budgets')),
    debts: observable(syncTable('debts')),
    debt_activities: observable(syncTable('debt_activities')),
    proposed_transactions: observable(syncTable('proposed_transactions')),
    recurring_overrides: observable(syncTable('recurring_overrides')),
    auto_add_rules: observable(syncTableOnceMigrated('review_later_and_auto_add_rules')),
    merchant_aliases: observable(syncTableOnceMigrated('merchant_aliases_and_wallet_location')),
  } satisfies Record<SyncedTable, Observable<unknown>>;

  const profilePreferences$ = observable<UserPreferences | undefined>(
    synced({
      get: () => fetchProfilePreferences(supabase),
      persist: { name: 'profile_preferences', ...persistOptions },
      waitFor: waitForAuth,
    }),
  );

  /** The user's choice about Moni's AI (`ai_consents`). Undefined until the first fetch lands. */
  const aiConsent$ = observable<AiConsent | undefined>(
    synced({
      get: () => fetchAiConsent(supabase),
      persist: { name: 'ai_consent', ...persistOptions },
      waitFor: waitForAuth,
    }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each table's row type differs; callers that walk them all only sync or clear.
  const all: Observable<any>[] = [...Object.values(tables), profilePreferences$, aiConsent$];

  /**
   * Legend-State treats rows with `created_at` as updates. Older app versions set timestamps
   * locally, so those rows never INSERTed: re-queue them once as creates.
   */
  function requeueLocalCreates(obs$: (typeof all)[number]): void {
    const snapshot = obs$.peek() as Record<string, Row> | null;
    if (!snapshot || typeof snapshot !== 'object') return;
    for (const id of Object.keys(snapshot)) {
      const row = snapshot[id];
      if (!row || typeof row !== 'object' || row.deleted || !row.created_at) continue;
      const payload = { ...row };
      delete payload.created_at;
      delete payload.updated_at;
      obs$[id].delete();
      obs$[id].set(payload);
    }
  }

  function runOneTimeCreateRepair(): void {
    if (persist.flags.getBoolean(SYNC_CREATE_REPAIR_KEY)) return;
    for (const obs$ of all) requeueLocalCreates(obs$);
    persist.flags.set(SYNC_CREATE_REPAIR_KEY, true);
  }

  let syncing: Promise<void> | null = null;

  /**
   * Resolves once the pull in flight, if any, has finished. A full pull replaces each table, so a
   * row written while it runs can vanish before it uploads.
   */
  function whenStoreSynced(): Promise<void> {
    return syncing ?? Promise.resolve();
  }

  async function pullAll(options: { fullReset?: boolean }): Promise<void> {
    if (!authReady$.get()) return;
    runOneTimeCreateRepair();
    await probeGatedMigrations();
    for (const obs$ of all) {
      const state$ = syncState(obs$);
      state$.assign({ isSyncEnabled: true, isPersistEnabled: true, error: undefined });
      await when(state$.isPersistLoaded);
      const needsFullPull = (options.fullReset ?? false) || !state$.isLoaded.peek();
      await state$.get().sync?.({ resetLastSync: needsFullPull });
      // Legend-State leaves lastSync unset after an empty pull; still mark success for the UI.
      if (!state$.lastSync.peek() && !state$.error.peek()) state$.lastSync.set(Date.now());
    }
  }

  /** Turn sync on and pull from Supabase, after sign-in or when the tables become observed. */
  function enableStoreSync(options: { fullReset?: boolean } = {}): Promise<void> {
    const run = pullAll(options).finally(() => {
      if (syncing === run) syncing = null;
    });
    syncing = run;
    return run;
  }

  /** Wipes the local copy and its sync metadata, not just the persisted rows. */
  async function clearStore(): Promise<void> {
    authReady$.set(false);
    for (const obs$ of all) {
      const state$ = syncState(obs$);
      state$.isSyncEnabled.set(false);
      state$.isPersistEnabled.set(false);
    }
    await Promise.all(
      all.map(async (obs$) => {
        const state$ = syncState(obs$);
        const { reset } = state$.get();
        if (reset) return reset();
        await state$.get().resetPersistence?.();
        obs$.set({});
      }),
    );
    persist.flags.clearAll();
  }

  /** Ends sync the moment the session ends, wherever it ended (another tab, a revoked token). */
  function watchSession(): () => void {
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) authReady$.set(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) authReady$.set(false);
    });
    return () => data.subscription.unsubscribe();
  }

  /** Stops sync, runs the platform's own clean-up, clears the store, then ends the Supabase session. */
  async function signOutEverywhere(effects: SignOutEffects = {}): Promise<void> {
    authReady$.set(false);
    await effects.beforeClear?.();
    await clearStore();
    await effects.afterClear?.();
    // Offline, or with the user already deleted, the server can't end the session; this device still forgets it.
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: 'local' });
  }

  return {
    supabase,
    tables,
    all,
    authReady$,
    wallets$: tables.wallets,
    transactions$: tables.transactions,
    categories$: tables.categories,
    tags$: tables.tags,
    transactionTags$: tables.transaction_tags,
    categoryBudgets$: tables.category_budgets,
    debts$: tables.debts,
    debtActivities$: tables.debt_activities,
    proposedTransactions$: tables.proposed_transactions,
    recurringOverrides$: tables.recurring_overrides,
    autoAddRules$: tables.auto_add_rules,
    merchantAliases$: tables.merchant_aliases,
    profilePreferences$,
    aiConsent$,
    enableStoreSync,
    whenStoreSynced,
    clearStore,
    isMigrated,
    assertMigrated,
    watchSession,
    signOutEverywhere,
  };
}

export type MoniStore = ReturnType<typeof createMoniStore>;
