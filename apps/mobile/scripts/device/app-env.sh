# shellcheck shell=bash
# Sourced: app-env.sh <mobile dir> <main checkout> [--real-ai | --preview]. Sets the build's
# environment. Variables already set win over the files, as with Expo's own .env loading.
# For the e2e app, .env.e2e comes first so it can point at its own Supabase project, and the AI URL
# defaults to empty so it uses the mock AI client; --real-ai takes the real backend from .env.
# --preview is the owner's daily app: .env only, no APP_VARIANT.
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
mode=${3:-}
if [[ $mode != --preview ]]; then
  load_env "$1/.env.e2e"
  load_env "$2/apps/mobile/.env.e2e"
fi
if [[ $mode == --real-ai ]]; then
  [[ -n ${EXPO_PUBLIC_AI_API_URL:-} ]] || unset EXPO_PUBLIC_AI_API_URL
elif [[ $mode != --preview ]]; then
  [[ -v EXPO_PUBLIC_AI_API_URL ]] || export EXPO_PUBLIC_AI_API_URL=
fi
load_env "$1/.env"
load_env "$2/apps/mobile/.env"
if [[ $mode == --preview ]]; then
  unset APP_VARIANT
else
  export APP_VARIANT=e2e
fi
