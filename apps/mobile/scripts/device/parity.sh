#!/usr/bin/env bash
# Proves a change leaves the phone app looking the same: builds Moni E2E at two commits with the
# boards' pinned clock, runs the same flow areas on the same seed with each, and compares every
# named screenshot. Exit 0 only when nothing changed or went missing.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

usage() {
  echo "usage: parity.sh --base <ref> [--head <ref>] [--out <dir>] [<area>...]" >&2
  exit 2
}

base_ref="" head_ref=HEAD out="" areas=()
while (($#)); do
  case $1 in
    --base) (($# >= 2)) || usage; base_ref=$2; shift 2 ;;
    --head) (($# >= 2)) || usage; head_ref=$2; shift 2 ;;
    --out) (($# >= 2)) || usage; out=$2; shift 2 ;;
    -*) usage ;;
    *) areas+=("$1"); shift ;;
  esac
done
[[ -n $base_ref ]] || usage
root=$(git -C "$here" rev-parse --show-toplevel)
base=$(git -C "$root" rev-parse --verify "$base_ref^{commit}")
head=$(git -C "$root" rev-parse --verify "$head_ref^{commit}")
out=${out:-$HOME/.local/share/moni-runs/parity/${base:0:8}-${head:0:8}}
cache=${MONI_PARITY_DIR:-$HOME/.cache/moni-parity}
mkdir -p "$out" "$cache"

export EXPO_PUBLIC_E2E_NOW=${EXPO_PUBLIC_E2E_NOW:-2026-10-14T14:06:00+08:00}
export EXPO_PUBLIC_E2E_TOAST_MS=${EXPO_PUBLIC_E2E_TOAST_MS:-15000}

# run_side <base|head> <sha>: a clean worktree at the commit, its own build and flows.
run_side() {
  local side=$1 sha=$2 wt=$cache/wt-$2 key
  if [[ ! -d $wt ]]; then
    git -C "$root" worktree add --detach "$wt" "$sha" >/dev/null
    (cd "$wt" && pnpm install --frozen-lockfile --prefer-offline >/dev/null)
  fi
  key=$("$wt/apps/mobile/scripts/device/build-apk.sh" | awk '/^(built|cached) /{print $2}' | tail -n 1)
  [[ -n $key ]] || { echo "parity: no build for $side $sha" >&2; exit 4; }
  echo "$side $sha key $key"
  rm -rf "${out:?}/$side"
  "$wt/apps/mobile/scripts/device/run-areas.sh" --sha "$key" --out "$out/$side" "${areas[@]}" || echo "$side: some flows failed, see above"
}

run_side base "$base"
run_side head "$head"

status=0
for dir in "$out/base"/*/; do
  label=$(basename "$dir")
  if [[ ! -d $out/head/$label ]]; then
    echo "$label: missing on head"
    status=1
    continue
  fi
  echo "== $label"
  node "$here/screens-diff.mjs" "$dir" "$out/head/$label" "$out/diff/$label" || status=1
done
echo "parity $([[ $status == 0 ]] && echo same || echo CHANGED) base ${base:0:8} head ${head:0:8}, evidence $out"
exit $status
