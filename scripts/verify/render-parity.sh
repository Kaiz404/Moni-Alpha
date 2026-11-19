#!/usr/bin/env bash
# Proves a change leaves what every route renders the same, without the phone: mounts each route in
# apps/mobile/__tests__/routes.test.tsx at two commits (full and empty seed, light and dark, the
# pinned clock), dumps the text, testIDs, labels, classes and colours each showed, and diffs them.
# Exit 0 only when no route changed.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

usage() {
  echo "usage: render-parity.sh --base <ref> [--head <ref>]   (commits only; commit your change first)" >&2
  exit 2
}

base_ref="" head_ref=HEAD
while (($#)); do
  case $1 in
    --base) (($# >= 2)) || usage; base_ref=$2; shift 2 ;;
    --head) (($# >= 2)) || usage; head_ref=$2; shift 2 ;;
    *) usage ;;
  esac
done
[[ -n $base_ref ]] || usage
[[ -d $HOME/.nvm/versions/node/v22.23.3/bin ]] && export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"
root=$(git -C "$here" rev-parse --show-toplevel)
base=$(git -C "$root" rev-parse --verify "$base_ref^{commit}")
head=$(git -C "$root" rev-parse --verify "$head_ref^{commit}")
worktrees=${MONI_PARITY_DIR:-$HOME/.cache/moni-parity}
dumps=${MONI_RENDER_DIR:-$HOME/.cache/moni-render}
mkdir -p "$worktrees" "$dumps"
harness=$(cat "$here"/render-dump/*.cjs | sha256sum | cut -c1-8)

# Two commits whose app, packages and lockfile match render the same, whatever else changed, so
# they share one dump. Device scripts, Maestro flows and docs don't change what a route renders.
inputs_key() {
  git -C "$root" ls-tree -r "$1" -- apps/mobile packages pnpm-lock.yaml pnpm-workspace.yaml package.json |
    grep -v -e $'\tapps/mobile/scripts/' -e $'\tapps/mobile/.maestro/' -e '\.md$' | sha256sum | cut -c1-16
}

# dump_side <base|head> <sha>: prints the commit's dump folder, made once per app inputs. The
# worktree is the one parity.sh builds the APK in, so a commit is checked out and installed once.
dump_side() {
  local side=$1 sha=$2 dir wt=$worktrees/wt-$2 tmp log start
  dir=$dumps/$(inputs_key "$sha")-$harness
  if [[ -f $dir/.done ]]; then
    echo "$side ${sha:0:8} cached $dir" >&2
    echo "$dir"
    return
  fi
  start=$SECONDS
  (
    flock 9
    [[ -d $wt ]] || git -C "$root" worktree add -q --detach "$wt" "$sha"
    # parity.sh skips the install when the commit's APK is cached.
    [[ -d $wt/apps/mobile/node_modules ]] || (cd "$wt" && pnpm install --frozen-lockfile --prefer-offline >/dev/null)
  ) 9>"$wt.lock"
  tmp=$dir.tmp-$$ log=$dir.log
  rm -rf "$tmp"
  if (cd "$wt/apps/mobile" && RENDER_DUMP=$tmp pnpm exec jest __tests__/routes.test.tsx --runInBand \
    --setupFilesAfterEnv "$here/render-dump/setup.cjs" -t '(seeded: rows land|empty first run)') >"$log" 2>&1; then
    rm -rf "$dir" && mv "$tmp" "$dir" && touch "$dir/.done"
  else
    # A failing visit still dumps what it showed. Not cached, so a flaky run is tried again.
    echo "render-parity: routes test failed on $side ${sha:0:8}, log $log" >&2
    grep -E '^\s+● ' "$log" | sort -u | head -n 10 >&2 || true
    mkdir -p "$tmp" && rm -rf "$dir" && mv "$tmp" "$dir"
  fi
  echo "$side ${sha:0:8} dumped in $((SECONDS - start)) s, $dir" >&2
  echo "$dir"
}

base_dir=$(dump_side base "$base")
head_dir=$(dump_side head "$head")
status=0
node "$here/render-dump/diff.mjs" "$base_dir" "$head_dir" || status=$?
echo "render-parity $([[ $status == 0 ]] && echo same || echo CHANGED) base ${base:0:8} head ${head:0:8}, dumps $base_dir $head_dir"
exit $status
