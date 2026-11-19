#!/usr/bin/env bash
# Proves a change leaves the phone app looking the same: builds Moni E2E at two commits with the
# boards' pinned clock, runs the same flow areas on the same seed with each, and compares every
# named screenshot. Exit 0 only when nothing changed or went missing.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

usage() {
  echo "usage: parity.sh --base <ref> [--head <ref>] [--out <dir>] [--affected | <area>...]" >&2
  exit 2
}

base_ref="" head_ref=HEAD out="" affected=false areas=()
while (($#)); do
  case $1 in
    --base) (($# >= 2)) || usage; base_ref=$2; shift 2 ;;
    --head) (($# >= 2)) || usage; head_ref=$2; shift 2 ;;
    --out) (($# >= 2)) || usage; out=$2; shift 2 ;;
    --affected) affected=true; shift ;;
    -*) usage ;;
    *) areas+=("$1"); shift ;;
  esac
done
[[ -n $base_ref ]] || usage
! $affected || ((!${#areas[@]})) || usage
root=$(git -C "$here" rev-parse --show-toplevel)
# Refs such as HEAD mean the checkout the caller stands in, which may be a worktree of this repo.
refs_repo=$(git rev-parse --show-toplevel 2>/dev/null || echo "$root")
base=$(git -C "$refs_repo" rev-parse --verify "$base_ref^{commit}")
head=$(git -C "$refs_repo" rev-parse --verify "$head_ref^{commit}")
out=${out:-$HOME/.local/share/moni-runs/parity/${base:0:8}-${head:0:8}}
cache=${MONI_PARITY_DIR:-$HOME/.cache/moni-parity}
mkdir -p "$out" "$cache"

export EXPO_PUBLIC_E2E_NOW=${EXPO_PUBLIC_E2E_NOW:-2026-10-14T14:06:00+08:00}
export EXPO_PUBLIC_E2E_TOAST_MS=${EXPO_PUBLIC_E2E_TOAST_MS:-15000}

if $affected; then
  # Its own line, so a failing affected.mjs stops the run instead of reading as no areas.
  list=$(node "$root/scripts/verify/affected.mjs" --base "$base" --head "$head" --list)
  read -ra areas <<<"$list"
  if ((!${#areas[@]})); then
    echo "parity skipped: no phone screen reached"
    exit 0
  fi
  echo "affected areas: ${areas[*]}"
elif ((!${#areas[@]})); then
  while IFS= read -r area; do
    [[ $area == perf ]] || areas+=("$area")
  done < <(git -C "$root" ls-tree --name-only -d "$head:apps/mobile/.maestro/flows")
fi

# Two commits whose app, flows, packages and lockfile match draw the same screens, whatever else
# changed, so their build and their screenshots are shared. Device scripts don't change the app.
inputs_key() {
  git -C "$root" ls-tree -r "$1" -- apps/mobile packages pnpm-lock.yaml pnpm-workspace.yaml package.json |
    grep -v $'\tapps/mobile/scripts/' | sha256sum | cut -c1-16
}

# lacks_base_shots <area> <head dir>: true when the base run has a named screenshot the head lacks.
lacks_base_shots() {
  local name
  [[ -d $out/base/$1 ]] || return 1
  while IFS= read -r name; do
    [[ -n $(find "$2" -name "$name" -print -quit 2>/dev/null) ]] || return 0
  done < <(find "$out/base/$1" -name '*.png' ! -name 'step-*' -printf '%f\n')
  return 1
}

# run_side <base|head> <sha>: a build and a flow run per area for the commit's inputs, each reused
# from an earlier parity run with the same inputs (any lane, any commit) when one exists.
run_side() {
  local side=$1 sha=$2 wt=$cache/wt-$2 ikey key runs missing=() area
  ikey=$(inputs_key "$sha")-${EXPO_PUBLIC_E2E_NOW//[^0-9]/}
  runs=$cache/runs/$ikey
  [[ $side == base ]] || runs=$cache/runs/head-$$/$ikey
  for area in "${areas[@]}"; do
    [[ -f $runs/$area/.done ]] || missing+=("$area")
  done
  rm -rf "${out:?}/$side"
  mkdir -p "$out/$side"
  if ((${#missing[@]})); then
    key=$(cat "$cache/apk/$ikey" 2>/dev/null || true)
    if [[ -z $key || ! -f $HOME/.cache/moni-apk/$key/app-release.apk ]]; then
      if [[ ! -d $wt ]]; then
        git -C "$root" worktree add --detach "$wt" "$sha" >/dev/null
        (cd "$wt" && pnpm install --frozen-lockfile --prefer-offline >/dev/null)
      fi
      key=$("$wt/apps/mobile/scripts/device/build-apk.sh" | awk '/^(built|cached) /{print $2}' | tail -n 1)
      [[ -n $key ]] || { echo "parity: no build for $side $sha" >&2; exit 4; }
      mkdir -p "$cache/apk" && echo "$key" >"$cache/apk/$ikey"
    fi
    echo "$side $sha key $key, running ${missing[*]}"
    [[ -d $wt ]] || git -C "$root" worktree add --detach "$wt" "$sha" >/dev/null
    # The commit's app and flows, driven by this checkout's device scripts, so a fix to the doctor
    # or the lock reaches an old base too. Restored after, so the worktree's next build key is clean.
    rsync -a --delete "$here/" "$wt/apps/mobile/scripts/device/"
    # The base is cached whatever its flows did: a flow that fails there fails the same way for every
    # lane, and its missing screenshots simply aren't compared. The head is never cached. A head area
    # runs once more only when it lacks a screenshot the base has, so a flaky flow doesn't read as a
    # change, while a flow that fails on both sides costs one run.
    for area in "${missing[@]}"; do
      rm -rf "${runs:?}/$area"
      "$wt/apps/mobile/scripts/device/run-areas.sh" --sha "$key" --out "$runs" "$area" || true
      if [[ $side == head ]] && lacks_base_shots "$area" "$runs/$area"; then
        echo "head: $area lacks screenshots the base has, running it once more"
        rm -rf "${runs:?}/$area"
        "$wt/apps/mobile/scripts/device/run-areas.sh" --sha "$key" --out "$runs" "$area" || true
      fi
      # A run the doctor stopped before any flow leaves no folder; that is no result to cache.
      # Cache a base area only if a flow got far enough to take a named screenshot: a run that never
      # reached the app (locked or sleeping phone) is no base to compare against.
      if [[ $side == base && -n $(find "$runs/$area" -name '*.png' ! -name 'step-*' -print -quit 2>/dev/null) ]]; then
        touch "$runs/$area/.done"
      fi
    done
    git -C "$wt" checkout -q -- apps/mobile/scripts/device
    git -C "$wt" clean -qfd -- apps/mobile/scripts/device
  else
    echo "$side $sha reuses every area from $runs"
  fi
  for area in "${areas[@]}"; do
    [[ -d $runs/$area ]] && cp -r "$runs/$area" "$out/$side/$area"
  done
  if [[ $side == head ]]; then
    # A head area that ran becomes a base for the next parity whose base is this commit.
    for area in "${areas[@]}"; do
      local keep=$cache/runs/$ikey/$area
      [[ -d $runs/$area && ! -f $keep/.done ]] || continue
      rm -rf "$keep" && mkdir -p "$(dirname "$keep")" && cp -r "$runs/$area" "$keep" && touch "$keep/.done"
    done
    rm -rf "$cache/runs/head-$$"
  fi
}

run_side base "$base"
run_side head "$head"

status=0 compared=0
while IFS= read -r dir; do
  compared=$((compared + 1))
  label=${dir#"$out/base/"}
  if [[ ! -d $out/head/$label ]]; then
    echo "$label: missing on head"
    status=1
    continue
  fi
  echo "== $label"
  node "$here/screens-diff.mjs" "$dir" "$out/head/$label" "$out/diff/$label" || status=1
done < <(find "$out/base" -name '*.png' -printf '%h\n' | sort -u)
if ((compared == 0)); then
  echo "parity: base produced no screenshots, nothing was compared"
  status=1
fi
echo "parity $([[ $status == 0 ]] && echo same || echo CHANGED) base ${base:0:8} head ${head:0:8}, evidence $out"
exit $status
