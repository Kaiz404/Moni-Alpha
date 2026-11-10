# shellcheck shell=bash
# Sourced: app-env.sh <mobile dir> <main checkout> [--dev]. Sets the build's environment for the
# e2e app. Variables already set win over the files, as with Expo's own .env loading.
# .env.e2e comes first so the e2e build can point at its own Supabase project. The AI URL defaults
# to empty so the e2e build uses the mock AI client; --dev takes the real backend from .env.
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
load_env "$1/.env.e2e"
load_env "$2/apps/mobile/.env.e2e"
if [[ ${3:-} == --dev ]]; then
  [[ -n ${EXPO_PUBLIC_AI_API_URL:-} ]] || unset EXPO_PUBLIC_AI_API_URL
else
  [[ -v EXPO_PUBLIC_AI_API_URL ]] || export EXPO_PUBLIC_AI_API_URL=
fi
load_env "$1/.env"
load_env "$2/apps/mobile/.env"
export APP_VARIANT=e2e
