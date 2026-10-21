# Database

Single PostgreSQL database on Supabase. Migrations live in `supabase/migrations/` and are the source of truth — this doc is the map, not the territory.

## Tables

| Table                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                  | RLS                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `profiles`              | User profile, auto-created on signup (trigger). `preferences` JSONB: `currency` (main currency, default `MYR`), `theme`, `notifications_enabled`, optional `default_wallet_id` (AI wallet fallback), and `finance_timezone` (budget/debt calendar)                                                                                                                                       | Own row only                              |
| `wallets`               | Financial accounts (bank, cash, e-wallet, …). `card_style_id` selects a gradient card preset (registry lives client-side in `apps/mobile/constants/wallet-card-styles.ts`, default `emerald-grain`); `color` stores that preset's flat hex for charts/legends. Optional `notification_package` / `notification_app_label` / `notification_account_hint` for Android notification routing | Own rows                                  |
| `categories`            | Fixed system categories (`user_id IS NULL`, 18 seeded) plus user-owned custom categories. The database accepts only the curated Material Design icon and pastel-color catalogues; category names are unique per active type/user scope, and subcategories are unsupported.                                                                                                               | System readable by all; own rows writable |
| `tags`                  | User-defined tags                                                                                                                                                                                                                                                                                                                                                                        | Own rows                                  |
| `transactions`          | The cash ledger. Snapshots the source wallet's currency at creation/update; debt-linked records can be excluded from spending analysis. Includes optional location fields for the heatmap. `metadata` JSONB carries `source` (`manual` / `voice` / `moni` / `notification` / `camera`; rows without one read as manual) and `kind: balance_correction` on wallet balance fixes           | Own rows                                  |
| `transaction_tags`      | Transaction ↔ tag junction (has own `id` PK for sync)                                                                                                                                                                                                                                                                                                                                    | Via transaction ownership                 |
| `proposed_transactions` | AI-extracted candidates awaiting user review (soft-deleted on approve/decline). Carries source metadata (`source_type` text/image/notification, `source_text`, `source_image_uri`, notification fields) and AI metadata (`ai_reasoning`, `ai_confidence`, `wallet_hint`, `category_hint`, `transfer_to_wallet_hint`). For transfers: `transfer_to_wallet_id` (resolved destination)      | Own rows                                  |
| `category_budgets`      | Monthly cap per category and currency                                                                                                                                                                                                                                                                                                                                                    | Own rows                                  |
| `debts`                 | Person-to-person receivable/payable records                                                                                                                                                                                                                                                                                                                                              | Own rows                                  |
| `debt_activities`       | Principal, repayment, and write-off events; cash events mirror to transactions                                                                                                                                                                                                                                                                                                           | Own rows                                  |
| `recurring_overrides`   | The user's confirm/dismiss verdict (optional `kind`, `expected_amount`, `expected_day`) on a recurring series detected on-device, keyed by `series_key` (`CUR\|type\|merchant`; not unique, the newest `updated_at` wins). Detected series are never stored                                                                                                                              | Own rows                                  |

**View:** `wallet_balances` — computed balance per wallet (initial balance + transaction deltas).

## Sync-related columns

The Legend-State ↔ Supabase sync (`supabase/migrations/20260707000000_legend_state_prep.sql`) requires on every synced table:

- `created_at` / `updated_at` timestamps (auto-set by trigger)
- `deleted boolean` — soft delete; clients filter `deleted = false`, hard deletes never happen from the app
- Realtime publication enabled (postgres_changes)

When adding a synced table: add those columns, enable RLS + realtime, then register a new observable in `apps/mobile/lib/store/index.ts`.

## Conventions

- UUID primary keys (`gen_random_uuid()`)
- Postgres stores money as `DECIMAL(12,2)` and currency as `CHAR(3)` ISO code. Client/domain contracts use integer minor units (`amountMinor` and balance/budget variants); adapters convert exactly at the database boundary.
- `transaction_type` enum: `income` | `expense` | `transfer` — transfers store source in `wallet_id`, destination in `transfer_to_wallet_id` (same currency only in the app); net worth unchanged across wallets
- All user tables reference `auth.users(id) ON DELETE CASCADE`
- Category archiving sets `is_active = false`: it removes a custom category from new selections while preserving linked financial history. System presets remain read-only through RLS.
- `20260721000000_refresh_category_catalog.sql` is a development reset: it removes prior category/budget rows, clears transaction category links, drops `parent_id`, and reseeds the fixed icon/pastel catalogue.
- `20261012000000_drop_ai_insights.sql` drops the unused `ai_insights` cache (and its realtime publication entry). Ship the app build without `aiInsights$` first, then apply it, so installed builds never sync a missing table.
- `20261013000000_recurring_overrides.sql` adds `recurring_overrides` (synced) and `wallets.balance_confirmed_at` (stamped by the app on wallet create and each save of the wallet screen, which shows the balance; backfilled from `created_at`, no default so server-side inserts never count), which gates the chat forecast. Apply it before shipping the build that syncs `recurringOverrides$`.
- `20261021000000_main_currency_myr.sql` moves the `profiles.preferences` default currency to `MYR` and rewrites stored `USD`, which was only ever the column default (no client offered a choice).
- Transaction `currency` is a ledger snapshot derived from the source wallet. The mobile command layer and web API enforce a matching-currency transfer destination, including when a transaction's wallet changes.
- RLS on everything; policies scope to `auth.uid()`. Clients use the publishable key + user JWT, so RLS is always in force.

## Storage

Bucket `receipts` (`supabase/migrations/20260323000000_storage_receipts_bucket.sql`): receipt images uploaded as `{userId}/{proposalId}.jpg`. Mobile saves locally first, uploads via a background queue (`apps/mobile/lib/receipts/upload-queue.ts`), then updates the proposal's `source_image_uri` to the remote URL.

## Applying changes

```bash
npx supabase migration new <name>   # create a migration
npx supabase db push                # apply to linked project
```

Keep migrations append-only. After schema changes, update `@repo/types` schemas and (if synced) the Legend-State store.
