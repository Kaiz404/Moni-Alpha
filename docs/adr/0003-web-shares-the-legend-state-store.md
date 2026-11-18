# 3. The web shares the phone's Legend-State store

Date: 19 Nov 2026. Status: accepted (owner's decision, Option C).

## Context

Many features compute over the whole ledger on the client: recurring bills, routine and duplicate matching, budgets, net-worth lines, import dedupe and the chat snapshot. The phone's store (`syncedSupabase` over Legend-State) already pages, pulls incrementally by `updated_at`, merges realtime, revives soft-deleted rows and retries.

## Decision

The store moves into `@repo/data` as `createMoniStore({ supabase, persist })`. The persistence plugin (MMKV on the phone, IndexedDB or memory on the web) and the Supabase client (MMKV auth storage on the phone, `@supabase/ssr` cookies on the web) are the two adapters.

## Consequences

No sync rule or ledger rule exists twice, and web edits reach the phone through the existing realtime and `last-sync` paths. Ledger data is not server-rendered. Option B (shared rules, a separate TanStack Query cache on the web) was rejected because it rebuilds incremental sync a second time and two caches can disagree on soft-delete and revive edge cases.
