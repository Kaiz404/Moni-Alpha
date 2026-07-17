# Database

Single PostgreSQL database on Supabase. Migrations live in `supabase/migrations/` and are the source of truth — this doc is the map, not the territory.

## Tables

| Table                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                  | RLS                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `profiles`              | User profile, auto-created on signup (trigger). `preferences` JSONB: `currency`, `theme`, `notifications_enabled`, optional `default_wallet_id` (AI wallet fallback), and `finance_timezone` (budget/debt calendar)                                                                                                                                                                      | Own row only                              |
| `wallets`               | Financial accounts (bank, cash, e-wallet, …). `card_style_id` selects a gradient card preset (registry lives client-side in `apps/mobile/constants/wallet-card-styles.ts`, default `emerald-grain`); `color` stores that preset's flat hex for charts/legends. Optional `notification_package` / `notification_app_label` / `notification_account_hint` for Android notification routing | Own rows                                  |
| `categories`            | System categories (`user_id IS NULL`, 18 seeded) + user categories                                                                                                                                                                                                                                                                                                                       | System readable by all; own rows writable |
| `tags`                  | User-defined tags                                                                                                                                                                                                                                                                                                                                                                        | Own rows                                  |
| `transactions`          | The cash ledger. Snapshots wallet currency; debt-linked records can be excluded from spending analysis. Includes optional location fields for the heatmap                                                                                                                                                                                                                                | Own rows                                  |
| `transaction_tags`      | Transaction ↔ tag junction (has own `id` PK for sync)                                                                                                                                                                                                                                                                                                                                    | Via transaction ownership                 |
| `proposed_transactions` | AI-extracted candidates awaiting user review (soft-deleted on approve/decline). Carries source metadata (`source_type` text/image/notification, `source_text`, `source_image_uri`, notification fields) and AI metadata (`ai_reasoning`, `ai_confidence`, `wallet_hint`, `category_hint`, `transfer_to_wallet_hint`). For transfers: `transfer_to_wallet_id` (resolved destination)      | Own rows                                  |
| `ai_insights`           | Cached insight payloads (`feature_key`, `context_key`, `status`, `result` JSONB validated against `@repo/types` schemas)                                                                                                                                                                                                                                                                 | Own rows                                  |
| `category_budgets`      | Monthly cap per category and currency                                                                                                                                                                                                                                                                                                                                                    | Own rows                                  |
| `debts`                 | Person-to-person receivable/payable records                                                                                                                                                                                                                                                                                                                                              | Own rows                                  |
| `debt_activities`       | Principal, repayment, and write-off events; cash events mirror to transactions                                                                                                                                                                                                                                                                                                           | Own rows                                  |

**View:** `wallet_balances` — computed balance per wallet (initial balance + transaction deltas).

## Sync-related columns

The Legend-State ↔ Supabase sync (`supabase/migrations/20260707000000_legend_state_prep.sql`) requires on every synced table:

- `created_at` / `updated_at` timestamps (auto-set by trigger)
- `deleted boolean` — soft delete; clients filter `deleted = false`, hard deletes never happen from the app
- Realtime publication enabled (postgres_changes)

When adding a synced table: add those columns, enable RLS + realtime, then register a new observable in `apps/mobile/lib/store/index.ts`.

## Conventions

- UUID primary keys (`gen_random_uuid()`)
- Money as `DECIMAL(12,2)`; currency as `CHAR(3)` ISO code
- `transaction_type` enum: `income` | `expense` | `transfer` — transfers store source in `wallet_id`, destination in `transfer_to_wallet_id` (same currency only in the app); net worth unchanged across wallets
- All user tables reference `auth.users(id) ON DELETE CASCADE`
- RLS on everything; policies scope to `auth.uid()`. Clients use the publishable key + user JWT, so RLS is always in force.

## Storage

Bucket `receipts` (`supabase/migrations/20260323000000_storage_receipts_bucket.sql`): receipt images uploaded as `{userId}/{proposalId}.jpg`. Mobile saves locally first, uploads via a background queue (`apps/mobile/lib/receipts/upload-queue.ts`), then updates the proposal's `source_image_uri` to the remote URL.

## Applying changes

```bash
npx supabase migration new <name>   # create a migration
npx supabase db push                # apply to linked project
```

Keep migrations append-only. After schema changes, update `@repo/types` schemas and (if synced) the Legend-State store.
