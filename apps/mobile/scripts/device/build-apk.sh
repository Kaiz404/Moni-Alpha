#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$here/env.sh"

usage() {
  echo "usage: build-apk.sh [--allow-main] [--clean-prebuild]" >&2
  exit 2
}

allow_main=false clean_prebuild=false
while (($#)); do
  case $1 in
    --allow-main) allow_main=true ;;
    --clean-prebuild) clean_prebuild=true ;;
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

# Variables already set win over the files, as with Expo's own .env loading.
# .env.e2e comes first so the e2e build can point at its own Supabase project,
# and the AI URL defaults to empty so the e2e build uses the mock AI client.
env_assignments=()
load_env() {
  local file=$1 line key value
  [[ -f $file ]] || return 0
  while IFS= read -r line || [[ -n $line ]]; do
    line=${line%$'\r'}
    [[ $line =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key=${BASH_REMATCH[2]} value=${BASH_REMATCH[3]}
    [[ -v $key ]] && continue
    if [[ $value =~ ^\"(.*)\"[[:space:]]*$ || $value =~ ^\'(.*)\'[[:space:]]*$ ]]; then
      value=${BASH_REMATCH[1]}
    else
      value=${value%%[[:space:]]#*}
      value=${value%"${value##*[![:space:]]}"}
    fi
    export "$key=$value"
    env_assignments+=("$key=$value")
  done <"$file"
  echo "loaded $file" >&2
}
load_env "$mobile/.env.e2e"
load_env "$main_checkout/apps/mobile/.env.e2e"
[[ -v EXPO_PUBLIC_AI_API_URL ]] || export EXPO_PUBLIC_AI_API_URL=
load_env "$mobile/.env"
load_env "$main_checkout/apps/mobile/.env"
export APP_VARIANT=e2e
env_hash=$(printf '%s\n' "APP_VARIANT=$APP_VARIANT" "EXPO_PUBLIC_AI_API_URL=$EXPO_PUBLIC_AI_API_URL" "${env_assignments[@]}" | sort | sha256sum | cut -c1-16)

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
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --build-cache)
seconds=$((SECONDS - start))

apk=android/app/build/outputs/apk/release/app-release.apk
mkdir -p "$cache"
staging=$(mktemp -d "$cache/.staging.XXXXXX")
cp "$apk" "$staging/app-release.apk"
bytes=$(stat -c %s "$staging/app-release.apk")
cat >"$staging/build.json" <<JSON
{
  "key": "$key",
  "sha": "$sha",
  "package": "com.anonymous.moni.e2e",
  "bytes": $bytes,
  "buildSeconds": $seconds,
  "prebuild": $prebuild,
  "envHash": "$env_hash",
  "builtAt": "$(date -Iseconds)"
}
JSON
rm -rf "$out"
mv "$staging" "$out"
echo "built $key $out/app-release.apk in $seconds s"
