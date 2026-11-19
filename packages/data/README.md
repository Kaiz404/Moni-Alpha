# @repo/data

The synced ledger both apps hold (ADR [0003](../../docs/adr/0003-web-shares-the-legend-state-store.md)): Legend-State observables over Supabase, built by one factory with the platform's client and persistence handed in. Raw TypeScript, no build step.

| Module | What it does |
| --- | --- |
| `store.ts` | `createMoniStore({ supabase, persist, uuid })` returns one observable per synced table plus `profilePreferences$` and `aiConsent$`, and `enableStoreSync`, `whenStoreSynced`, `clearStore`, `isMigrated`, `assertMigrated`, `watchSession` and `signOutEverywhere(effects)`. It pulls by `updated_at` since the last sync, merges realtime, retries a request that never arrived (not one Supabase refused), probes the gated migrations before their tables sync, and re-queues rows an old app version never inserted. |
| `gateway.ts` | `createRowGateway(supabase)`: `createOrRevive` (a key clash revives a soft-deleted row or adopts the live one), `update` (sends today's colour for a legacy hex), `softDelete`, and `list`, which pages in id order around PostgREST's `max_rows`. Results say whether a failure is worth retrying. |
| `persist.ts` | `MoniPersist` is a Legend persistence plugin plus a small flag store. `memoryPersist()` keeps both in memory for the web and tests. |
| `profile.ts` | Reads the profile preferences and the AI consent for the signed-in user. |

## Adapters

| | Phone | Web |
| --- | --- | --- |
| `supabase` | `createClient<Database>` with MMKV session storage (`apps/mobile/lib/supabase/client.ts`) | `createBrowserClient<Database>` from `@supabase/ssr` (`apps/web/src/lib/supabase/client.ts`) |
| `persist` | `observablePersistMMKV` and the `legend-store` MMKV (`apps/mobile/lib/store/index.ts`) | `memoryPersist()`; IndexedDB later |
| `uuid` | `expo-crypto`'s `randomUUID` | `crypto.randomUUID` |

A table syncs only while `authReady$` is true and something observes it. The app observes every table, sets `authReady$` once a user is signed in, and calls `enableStoreSync`; `signOutEverywhere` turns sync off, runs the platform's clean-up, clears every table and its sync metadata, then signs out of Supabase.

The shared lint bans `@legendapp/*`; this package's `eslint.config.js` allows Legend's platform-free entry points, because the store is this package's subject, and keeps its React bindings and platform persistence plugins banned. The package imports no React; React is a peer dependency so both apps' Legend React bindings and this store resolve the one React each app pins.

```bash
pnpm --filter @repo/data test         # Vitest, against memoryPersist() and a stand-in for PostgREST
pnpm --filter @repo/data check-types
pnpm --filter @repo/data lint
```
