#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$here/env.sh"

usage() {
  echo "usage: build-apk.sh [--allow-main] [--clean-prebuild] [--dev | --preview]" >&2
  exit 2
}

allow_main=false clean_prebuild=false dev=false preview=false
while (($#)); do
  case $1 in
    --allow-main) allow_main=true ;;
    --clean-prebuild) clean_prebuild=true ;;
    --dev) dev=true ;;
    --preview) preview=true ;;
    *) usage ;;
  esac
  shift
done

root=$(git -C "$here" rev-parse --show-toplevel)
mobile=$root/apps/mobile
git_dir=$(git -C "$root" rev-parse --absolute-git-dir)
common_dir=$(git -C "$root" rev-parse --path-format=absolute --git-common-dir)
main_checkout=$(git -C "$root" worktree list --porcelain | sed -n '1s/^worktree //p')
if [[ $git_dir == "$common_dir" ]] && ! $allow_main; then
  echo "build-apk.sh refuses to run in the main checkout $root, because prebuild --clean rewrites apps/mobile/android. Run it in a git worktree, or pass --allow-main." >&2
  exit 3
fi

exec 7>"$git_dir/moni-build-apk.lock"
flock 7

! $dev || ! $preview || usage
# --dev is Moni E2E as a dev client on the real AI backend, loading its code from Metro.
# --preview is the owner's daily Moni (com.anonymous.moni): a release build from .env, signed with
# the EAS key so it installs over the daily app and keeps its data.
dev_flag=$($dev && echo --real-ai || true)
$preview && dev_flag=--preview
package=com.anonymous.moni.e2e
$preview && package=com.anonymous.moni
signing=${MONI_SIGNING:-$HOME/.config/moni/signing/signing.properties}
if $preview && [[ ! -f $signing ]]; then
  echo "build-apk.sh --preview needs the EAS signing key at $signing, see apps/mobile/README.md" >&2
  exit 5
fi
# shellcheck disable=SC2086
source "$here/app-env.sh" "$mobile" "$main_checkout" $dev_flag
e2e_now=${EXPO_PUBLIC_E2E_NOW:-}
# Maestro outlasts a 4 s toast: it waits up to 9 s for the screen to settle around each tap while one
# shows, so an e2e build keeps them 30 s. Set it empty for a build a person tries.
$preview || export EXPO_PUBLIC_E2E_TOAST_MS=${EXPO_PUBLIC_E2E_TOAST_MS-30000}
env_hash=$(printf '%s\n' "APP_VARIANT=${APP_VARIANT:-}" "EXPO_PUBLIC_AI_API_URL=$EXPO_PUBLIC_AI_API_URL" "EXPO_PUBLIC_E2E_NOW=$e2e_now" "EXPO_PUBLIC_E2E_TOAST_MS=${EXPO_PUBLIC_E2E_TOAST_MS:-}" "${env_assignments[@]}" | sort | sha256sum | cut -c1-16)

inputs=(apps/mobile packages package.json pnpm-lock.yaml pnpm-workspace.yaml)
sha=$(git -C "$root" rev-parse HEAD)
key=$sha
if [[ -n $(git -C "$root" status --porcelain --untracked-files=all -- "${inputs[@]}") ]]; then
  diff_hash=$(
    cd "$root"
    git diff --binary HEAD -- "${inputs[@]}"
    git ls-files -z --others --exclude-standard -- "${inputs[@]}" | sort -z | xargs -0 -r sha256sum
  )
  key=$sha-dirty-$(sha256sum <<<"$diff_hash" | cut -c1-12)
fi

[[ -z $e2e_now ]] || key=$key-clock
! $dev || key=$key-dev
! $preview || key=$key-preview
cache=${MONI_APK_CACHE:-$HOME/.cache/moni-apk}
out=$cache/$key
if [[ -f $out/app-release.apk ]] && grep -q "\"envHash\": \"$env_hash\"" "$out/build.json" 2>/dev/null; then
  echo "cached $key $out/app-release.apk"
  exit 0
fi

start=$SECONDS
cd "$mobile"
native_fingerprint() {
  node -e '
    const expo = require.resolve("expo/package.json", { paths: [process.argv[1]] });
    const { createFingerprintAsync } = require(require.resolve("@expo/fingerprint", { paths: [expo] }));
    createFingerprintAsync(process.argv[1], { platforms: ["android"] }).then((f) => console.log(f.hash));
  ' "$mobile"
}
prebuild=false
# The fingerprint changes when android/ first appears, so it is saved after prebuild.
if $clean_prebuild || [[ $(cat android/.moni-fingerprint 2>/dev/null) != "$(native_fingerprint)" ]]; then
  prebuild=true
  npx expo prebuild --platform android --clean --no-install
  native_fingerprint >android/.moni-fingerprint
fi
if $dev; then
  gradle_task=assembleDebug apk=android/app/build/outputs/apk/debug/app-debug.apk
else
  gradle_task=assembleRelease apk=android/app/build/outputs/apk/release/app-release.apk
fi
# EXPO_PUBLIC_* values are inlined into the JS bundle, but Gradle doesn't see env as an input, so an
# env-only change (toast length, privacy URL) reused the old bundle. Drop the bundle so it is made again.
rm -rf android/app/build/generated/assets/react android/app/build/generated/res/react android/app/build/intermediates/assets
(cd android && ./gradlew "$gradle_task" -PreactNativeArchitectures=arm64-v8a --build-cache)
if $preview; then
  # shellcheck disable=SC1090
  source "$signing"
  apksigner=${MONI_APKSIGNER:-$(compgen -G "$ANDROID_HOME/build-tools/*/apksigner" | sort -V | tail -n 1)}
  MONI_STORE_PASSWORD=$MONI_STORE_PASSWORD MONI_KEY_PASSWORD=$MONI_KEY_PASSWORD "$apksigner" sign \
    --ks "$MONI_STORE_FILE" --ks-key-alias "$MONI_KEY_ALIAS" \
    --ks-pass env:MONI_STORE_PASSWORD --key-pass env:MONI_KEY_PASSWORD "$apk"
fi
seconds=$((SECONDS - start))

mkdir -p "$cache"
staging=$(mktemp -d "$cache/.staging.XXXXXX")
cp "$apk" "$staging/app-release.apk"
bytes=$(stat -c %s "$staging/app-release.apk")
cat >"$staging/build.json" <<JSON
{
  "key": "$key",
  "sha": "$sha",
  "package": "$package",
  "bytes": $bytes,
  "buildSeconds": $seconds,
  "prebuild": $prebuild,
  "envHash": "$env_hash",
  "e2eNow": "$e2e_now",
  "builtAt": "$(date -Iseconds)"
}
JSON
rm -rf "$out"
mv "$staging" "$out"
echo "built $key $out/app-release.apk in $seconds s"
