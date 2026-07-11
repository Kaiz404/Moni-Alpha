# Setup Guide

## Prerequisites

- Node.js >= 18, pnpm 9 (`corepack enable`)
- Go >= 1.26 (for `apps/backend`)
- Supabase CLI (`npx supabase`) logged in and linked to the project
- Android Studio / Xcode for native mobile builds (the app uses native modules — Expo Go is not enough; use a dev client: `pnpm --filter moni android`)

## Install

```bash
pnpm install
```

## Supabase

The project uses the hosted Supabase instance (`supabase/config.toml` holds local CLI config).

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push          # apply migrations in supabase/migrations
```

API keys: use the **new key system** (Dashboard → Settings → API Keys):

- Publishable key (`sb_publishable_...`) — mobile and web clients
- Secret key (`sb_secret_...`) — server-side scripts only, never in client code

JWT signing must be on the **ES256 asymmetric key** (Dashboard → Settings → JWT Keys) so the Go backend can verify tokens via JWKS.

## Environment files

### `apps/mobile/.env`

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
# AI backend; empty disables AI features (mock client).
# Android emulator: http://10.0.2.2:8080 — physical device: http://<LAN-IP>:8080
EXPO_PUBLIC_AI_API_URL=http://localhost:8080
```

### `apps/web/.env`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...   # server-side scripts only
```

### `apps/backend/.env`

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
GROQ_API_KEY=gsk_...                # console.groq.com/keys
```

## Run

```bash
pnpm dev                        # everything via turbo
pnpm --filter moni dev          # mobile (Expo)
pnpm --filter backend dev       # Go AI backend on :8080
pnpm --filter web dev           # Next.js dashboard on :3000
```

Useful checks:

```bash
turbo run lint check-types                      # whole repo
pnpm --filter backend test                      # Go tests
pnpm --filter moni test:notification-detection  # notification prefilter suite
```

## Google Maps (heatmap feature)

The mobile heatmap (`apps/mobile/app/heatmap.tsx`) renders transaction locations on Google Maps.

1. In [Google Cloud Console](https://console.cloud.google.com/), enable **Maps SDK for Android** and **Maps SDK for iOS**; create one API key per platform, restricted to the app's package name / bundle ID.
2. Add the keys to the `react-native-maps` plugin config in `apps/mobile/app.json`:

```json
["react-native-maps", {
  "iosGoogleMapsApiKey": "<ios-key>",
  "androidGoogleMapsApiKey": "<android-key>"
}]
```

3. Rebuild the dev client (`pnpm --filter moni android`). A grey/blank map means a missing or wrongly restricted key.

Location capture itself is handled by `expo-location` (permissions configured via the plugin); transactions store `location_latitude` / `location_longitude` / `location_name`.

## Android notification listener

The transaction-from-notification feature requires the user to grant Notification Access (the app links to the system settings screen). The headless listener is registered in `apps/mobile/index.js` and only runs on Android.

## Deploying the backend

See [apps/backend/README.md](../apps/backend/README.md) for Cloud Run deployment.
