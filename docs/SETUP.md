# Setup Guide

## Prerequisites

- Node.js >= 18, pnpm 9 (`corepack enable`)
- Go >= 1.26 (for `apps/backend`)
- Supabase CLI (`npx supabase`) logged in and linked to the project
- **Android dev client** — native modules (camera, notifications, Google Sign-In); Expo Go is not enough. Local build: `cd apps/mobile && npx expo run:android`. GitHub Actions builds debug APKs in CI. On Windows, use **WSL2** for local Android builds ([toolchain below](#wsl-android-toolchain); day-to-day workflow in [apps/mobile/README.md](../apps/mobile/README.md)).

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
# Android emulator: http://10.0.2.2:8080 — physical device: use ngrok URL from `pnpm --filter backend dev`
EXPO_PUBLIC_AI_API_URL=https://slang-compound-landmass.ngrok-free.dev
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
# Native Maps SDK keys. Do not commit real values.
ANDROID_GOOGLE_MAPS_API_KEY=<android-maps-key>
# IOS_GOOGLE_MAPS_API_KEY=<ios-maps-key>
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

## WSL Android toolchain

For local Android builds on Windows, clone the repo into the WSL filesystem (`~/Moni`, not `/mnt/c/...`) and run all install/prebuild/Gradle commands from WSL.

```bash
# packages (Ubuntu)
sudo apt install -y build-essential openjdk-17-jdk unzip wget git curl usbutils

# Android command-line tools → ~/Android/Sdk (see Expo prebuild output for platform/NDK versions)
mkdir -p ~/Android/Sdk/cmdline-tools
# download + unzip google commandlinetools-linux zip → ~/Android/Sdk/cmdline-tools/latest

# ~/.bashrc
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.31.6"
```

**USB phone:** install [usbipd-win](https://learn.microsoft.com/en-us/windows/wsl/connect-usb) on Windows; each session: `usbipd attach --wsl --busid <ID>`. One-time udev rule in WSL:

```bash
sudo tee /etc/udev/rules.d/51-android.rules << 'EOF'
SUBSYSTEM=="usb", ENV{DEVTYPE}=="usb_device", MODE="0666", GROUP="plugdev"
EOF
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Verify with `adb devices` (`device`, not `no permissions`). Some OEMs (e.g. Xiaomi) also need **Install via USB** in Developer options.

## Run

```bash
pnpm dev                        # everything via turbo
pnpm --filter moni dev          # mobile Metro (terminal 1)
cd apps/mobile && npx expo run:android   # local dev client install/rebuild (terminal 2, when needed)
pnpm --filter backend dev       # Go AI backend on :8080
pnpm --filter web dev           # Next.js dashboard on :3000
```

Useful checks:

```bash
turbo run lint check-types                      # whole repo
pnpm format:check                               # Prettier (run `pnpm format` to fix)
pnpm --filter backend test                      # Go tests
pnpm --filter moni test:notification-detection  # notification prefilter suite
```

## Google Maps (heatmap feature)

The mobile heatmap (`apps/mobile/app/heatmap.tsx`) renders transaction locations on Google Maps.

1. In [Google Cloud Console](https://console.cloud.google.com/), enable **Maps SDK for Android** and **Maps SDK for iOS**; create one API key per platform, restricted to the app's package name / bundle ID.
2. Put `ANDROID_GOOGLE_MAPS_API_KEY` (and, when needed, `IOS_GOOGLE_MAPS_API_KEY`) in `apps/mobile/.env`. `app.config.ts` injects the keys into the native `react-native-maps` configuration during prebuild.
3. Rebuild the dev client (`npx expo run:android` locally). A grey/blank map means a missing or wrongly restricted key.

The Android key is recoverable from an installed APK, so protect it with Google Cloud restrictions: enable only Maps SDK for Android, restrict to package `com.anonymous.moni`, and add the SHA-1 fingerprints for every signing certificate used to build the app.

Location capture itself is handled by `expo-location` (permissions configured via the plugin); transactions store `location_latitude` / `location_longitude` / `location_name`.

## Google Sign-In (mobile)

Native Google auth uses `@react-native-google-signin/google-signin` + `supabase.auth.signInWithIdToken`. Requires a dev client rebuild — not Expo Go.

### GCP credentials

1. **OAuth consent screen** — External, with test users while in Testing.
2. **Web application** OAuth client — client ID + secret go in **Supabase Dashboard → Auth → Providers → Google** (same as web app).
3. **Android** OAuth client — package `com.anonymous.moni`, SHA-1 from the keystore that signed the installed build:
   - Local `npx expo run:android`: `apps/mobile/android/app/debug.keystore`
   - **GitHub Actions debug builds**: generated in CI (use the debug certificate SHA-1 once the workflow has produced its first APK)

4. **iOS** OAuth client (when building iOS) — bundle ID `com.anonymous.moni`; set `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` to the reversed client ID.

### Supabase

- Enable Google provider with the **Web** client ID and secret.
- For native mobile sign-in, enable **Skip nonce check** on the hosted project (Dashboard → Auth → Google). Local `supabase/config.toml` has `skip_nonce_check = false` — change to `true` if you test Google auth against local Supabase.

### Mobile env (`apps/mobile/.env`)

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
# Optional for iOS prebuild:
# EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<ios-client-prefix>
```

After changing native config or env, rebuild: `npx expo run:android` locally or trigger GitHub Actions for a CI APK.

## GitHub Actions Android CI

The repository workflow is intentionally advisory: it runs lint and typechecks for the monorepo, then generates the Expo Android project and runs Gradle `assembleDebug` on every PR and `main` push. A failed check does not block merging, but resolve it before the next release.

Successful `main` and manually dispatched runs upload `app-debug.apk` as a seven-day Actions artifact. PR builds verify compilation but do not publish an APK. This is a development APK, so it needs Metro; a standalone tester build is deferred until the signed Google Play Internal Testing AAB exists.

### GitHub configuration

In **Repository → Settings → Secrets and variables → Actions**, add:

| Kind | Name | Purpose |
| --- | --- | --- |
| Secret | `ANDROID_GOOGLE_MAPS_API_KEY` | Injected into every Android CI build. Restrict it in Google Cloud; it is embedded in the APK. |
| Secret | `ANDROID_DEBUG_KEYSTORE_BASE64` | A stable debug keystore so CI APKs have a stable SHA-1 for Maps restrictions. |
| Variable | `EXPO_PUBLIC_SUPABASE_URL` | Mobile client configuration, when CI needs it. |
| Variable | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Mobile client configuration, when CI needs it. |
| Variable | `EXPO_PUBLIC_AI_API_URL` | Mobile client configuration, when CI needs it. |
| Variable | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Mobile client configuration, when CI needs it. |

`EXPO_PUBLIC_*` values are compiled into the client app and must never contain private credentials. The Android workflow injects the listed variables so its generated app configuration matches local development.

Create the CI debug keystore once, then upload its Base64 text as `ANDROID_DEBUG_KEYSTORE_BASE64`. Keep the source keystore outside the repository and record its SHA-1 in Google Cloud alongside the local debug SHA-1:

```powershell
keytool -genkeypair -keystore moni-ci-debug.keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
keytool -list -v -keystore moni-ci-debug.keystore -alias androiddebugkey -storepass android
[Convert]::ToBase64String([IO.File]::ReadAllBytes("moni-ci-debug.keystore")) | Set-Clipboard
```

Paste the clipboard content into **New repository secret**. GitHub does not provide repository secrets to forked PRs, so Android CI for a fork must be run after merging or from a trusted branch.

### Repository policy

In **Repository → Settings → General → Pull Requests**, enable merge commits and disable squash and rebase merging. Do not add a `main` branch protection rule: direct pushes and advisory CI are intentional while the project is solo-maintained.

Do not add release keystores or Play credentials yet. When external testing begins, store them as secrets in a protected GitHub `production` environment and build a signed AAB for Google Play Internal Testing.

## Android notification listener

The transaction-from-notification feature requires the user to grant Notification Access (the app links to the system settings screen). The headless listener is registered in `apps/mobile/index.js` and only runs on Android.

## Deploying the backend

See [apps/backend/README.md](../apps/backend/README.md) for Cloud Run deployment.
