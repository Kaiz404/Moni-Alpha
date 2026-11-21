# @repo/data

The synced ledger both apps hold (ADR [0003](../../docs/adr/0003-web-shares-the-legend-state-store.md)): Legend-State observables over Supabase, built by one factory with the platform's client and persistence handed in. Raw TypeScript, no build step.

| Module | What it does |
| --- | --- |
| `store.ts` | `createMoniStore({ supabase, persist, uuid })` returns one observable per synced table plus `profilePreferences$` and `aiConsent$`, and `enableStoreSync`, `whenStoreSynced`, `clearStore`, `isMigrated`, `assertMigrated`, `watchSession` and `signOutEverywhere(effects)`. It pulls by `updated_at` since the last sync, merges realtime, sends each row's writes through `row-sync.ts`, retries a request that never arrived (not one Supabase refused), probes the gated migrations before their tables sync, and re-queues rows an old app version never inserted. |
| `row-sync.ts` | `createRowSync()`: `send` puts one row's writes out one at a time, in the order sync made them, holds a write that points at a row still being created until that create lands or is refused for good, and keeps the server's `updated_at` on the last that landed; `isNewer` tells the realtime handler whether a version is newer than the device's own, judged by that stamp for a row the device wrote, so an echo of an older write never puts an old version back. |
| `gateway.ts` | `createRowGateway(supabase)`: `createOrRevive` (a key clash revives a soft-deleted row or adopts the live one), `update` (sends today's colour for a legacy hex), `softDelete`, and `list`, which pages in id order around PostgREST's `max_rows`. Results say whether a failure is worth retrying: a lost request, a server error or timeout, an expired session or a row not inserted yet is; row-level security, a check or a missing table is not. |
| `apply.ts` | `applyWrites(store, writes)` carries a `@repo/core` write plan out in one Legend batch, all or nothing: a patch or soft delete whose row is missing throws before anything is written. `src/__tests__/apply.test.ts` holds it and core's `applyToTables` to one contract. |
| `backup.ts` | Import data and Export data on the store: `readStoreSnapshot(store)` (every table an export or import reads, soft-deleted rows included), `storeRows`, `storeHasPulled(store)` (every such table has pulled since the app opened, so an import can tell new rows from missing ones), and `applyPlan(store, plan, { newId, onProgress })`, which writes a `@repo/core` import plan in chunks, parents first, waits for each table's sets to reach the server, and applies `planDebtStatus` to each debt a restore added activity to. |
| `persist.ts` | `MoniPersist` is a Legend persistence plugin plus a small flag store. `memoryPersist()` keeps both in memory for the web and tests. |
| `profile.ts` | Reads the profile preferences and the AI consent for the signed-in user, merges a patch into the preferences (`updateProfilePreferences`), and appends the consent rows a change records (`recordAiConsent`). |
| `receipts.ts` | `receiptPhotos(supabase)` returns the reader both apps show receipt photos through: it takes what a capture or transaction stores (`receiptPath` in `@repo/core`), signs a link for an hour (`createSignedUrl`, the bucket is private) and keeps it until five minutes before it expires; nothing for a photo not uploaded yet or one storage refuses. |

## Adapters

| | Phone | Web |
| --- | --- | --- |
| `supabase` | `createClient<Database>` with MMKV session storage (`apps/mobile/lib/supabase/client.ts`) | `createBrowserClient<Database>` from `@supabase/ssr` (`apps/web/src/lib/supabase/client.ts`) |
| `persist` | `observablePersistMMKV` and the `legend-store` MMKV (`apps/mobile/lib/store/index.ts`) | `memoryPersist()`; IndexedDB later |
| `uuid` | `expo-crypto`'s `randomUUID` | `crypto.randomUUID` |

A table syncs only while `authReady$` is true and something observes it. The app observes every table, sets `authReady$` once a user is signed in, and calls `enableStoreSync`; `signOutEverywhere` turns sync off, runs the platform's clean-up, clears every table and its sync metadata, then signs out of Supabase.

The shared lint bans `@legendapp/*`; this package's `eslint.config.js` allows Legend's platform-free entry points, because the store is this package's subject, and keeps its React bindings and platform persistence plugins banned. The package imports no React; React is a peer dependency so both apps' Legend React bindings and this store resolve the one React each app pins.

```bash
pnpm --filter @repo/data test         # Vitest, against memoryPersist() and a stand-in for PostgREST with latency, server times and a change feed
pnpm --filter @repo/data check-types
pnpm --filter @repo/data lint
```
