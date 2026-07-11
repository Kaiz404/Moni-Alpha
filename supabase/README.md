# Supabase

Hosted Supabase project: Postgres, Auth, Storage, Realtime. Schema reference: [docs/DATABASE.md](../docs/DATABASE.md).

## Migrations

```bash
npx supabase link --project-ref <project-ref>
npx supabase migration new <name>
npx supabase db push
```

Migrations are append-only. Synced tables need `created_at`/`updated_at`, a `deleted` soft-delete flag, RLS, and realtime publication (see `20260707000000_legend_state_prep.sql`).

## API keys

Use the new key system (Dashboard → Settings → API Keys):

- `sb_publishable_...` → mobile (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and web (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `sb_secret_...` → server-side scripts only (`SUPABASE_SECRET_KEY`); sent via the `apikey` header, never `Authorization: Bearer`

Legacy `anon` / `service_role` JWT keys should stay deactivated once nothing uses them (Dashboard → Settings → API Keys → legacy tab; reversible).

## JWT signing

Auth signs user access tokens with an **ES256 asymmetric key**. The Go backend verifies tokens against `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` — don't revert to the legacy HS256 shared secret or backend auth breaks.

## Storage

Bucket `receipts` — receipt images at `{userId}/{proposalId}.jpg`, policies restrict access by `auth.uid()` prefix (`20260323000000_storage_receipts_bucket.sql`). If mobile logs `Bucket not found`, push migrations.

## Seeded data

18 system categories (`user_id IS NULL`) from the initial schema; profile rows auto-created on signup by trigger.
