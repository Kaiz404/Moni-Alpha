# Supabase

Hosted Supabase project: Postgres, Auth, Storage, Realtime. Schema reference: [docs/DATABASE.md](../docs/DATABASE.md).

## Migrations

```bash
npx supabase link --project-ref <project-ref>
npx supabase migration new <name>
npx supabase db push
```

Migrations are append-only. Synced tables need `created_at`/`updated_at`, a `deleted` soft-delete flag, RLS, and realtime publication (see `20260707000000_legend_state_prep.sql`).

## Tests

`tests/*.sql` run as two users against a local database and roll themselves back. `owned_references.sql` proves a row can't reference another user's row (#121).

```bash
npx supabase db start      # local Postgres with every migration (Docker)
bash supabase/tests/run.sh
```

## API keys

Use the new key system (Dashboard → Settings → API Keys):

- `sb_publishable_...` → mobile (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) and web (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `sb_secret_...` → server-side scripts only (`SUPABASE_SECRET_KEY`); sent via the `apikey` header, never `Authorization: Bearer`

Legacy `anon` / `service_role` JWT keys should stay deactivated once nothing uses them (Dashboard → Settings → API Keys → legacy tab; reversible).

## JWT signing

Auth signs user access tokens with an **ES256 asymmetric key**. The Go backend verifies tokens against `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` — don't revert to the legacy HS256 shared secret or backend auth breaks.

## Custom Access Token Hook

`public.custom_access_token_hook` adds `ai_consent` (the user's master AI switch, from `ai_consents`) to every access token, and adds nothing for a user never asked. A migration cannot turn a hook on, so enable it once per project, in the dashboard (Authentication → Hooks) or with the Management API:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/<project-ref>/config/auth" \
  -H "Authorization: Bearer $(cat ~/.supabase/access-token)" -H "Content-Type: application/json" \
  -d '{"hook_custom_access_token_enabled":true,"hook_custom_access_token_uri":"pg-functions://postgres/public/custom_access_token_hook"}'
```

It is on for the dev project. `node scripts/verify/ai-consent-live.mjs` proves the claim and the backend's answer to it.

## Storage

Bucket `receipts` — receipt images at `{userId}/{proposalId}.jpg`, policies restrict access by `auth.uid()` prefix (`20260323000000_storage_receipts_bucket.sql`). If mobile logs `Bucket not found`, push migrations.

## Edge Functions

`functions/` holds the operations that need the secret key: `delete-account`, and `qr-start`, `qr-approve` and `qr-poll` for QR sign-in (contract: [docs/ARCHITECTURE.md § Auth](../docs/ARCHITECTURE.md#auth)). They read the key from the runtime's `SUPABASE_SECRET_KEYS`, so nothing needs setting. `config.toml` turns off the gateway's JWT check for each, because they check the caller themselves. Folders starting with `_` are not functions: `_shared/` holds the code they share.

```bash
npx supabase functions deploy delete-account qr-start qr-approve qr-poll --use-api
deno test supabase/functions/_shared/          # code rotation, expiry, single use, receipt deletion
node supabase/functions/_check/live-check.mjs  # the deployed functions on the dev project
```

The live check reads `apps/mobile/.env.e2e`. It creates a throwaway user with rows in every table and two receipts, deletes it through `delete-account`, and checks that nothing is left; then it runs a QR sign-in approved by the e2e user through to `verifyOtp`. It waits 61 s for a code to rotate; `--skip-rotation` skips that part.

## Seeded data

18 system categories (`user_id IS NULL`) from the initial schema; profile rows auto-created on signup by trigger.

The linked project `yucjcjquwpwkgowzthhn` is the dev project. It also holds the e2e user (`E2E_EMAIL` in `apps/mobile/.env.e2e`), whose rows `apps/mobile/scripts/e2e/seed.mjs` resets. See [apps/mobile/README.md § E2E data](../apps/mobile/README.md#e2e-data).
