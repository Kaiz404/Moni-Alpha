#!/usr/bin/env bash
# Runs each area of flows on its own fresh seed, so one area's edits cannot fail the next. On a -clock
# build it also keeps sign-ins short: the pinned clock never refreshes a session, which expires in 1 h.
# Areas in per_flow_areas get a fresh seed per flow.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mobile=$(cd "$here/../.." && pwd)
source "$here/manual-tags.sh"
# The seed holds four captures, and each of these flows spends them. A shared seed leaves the next
# one with an empty deck.
per_flow_areas=(review)

usage() {
  echo "usage: run-areas.sh --sha <key> [--out <dir>] [<area>...]" >&2
  exit 2
}

key="" out="" areas=()
while (($#)); do
  case $1 in
    --sha) (($# >= 2)) || usage; key=$2; shift 2 ;;
    --out) (($# >= 2)) || usage; out=$2; shift 2 ;;
    -*) usage ;;
    *) areas+=("$1"); shift ;;
  esac
done
[[ -n $key ]] || usage
if ((!${#areas[@]})); then
  while IFS= read -r area; do
    # perf holds only perf-tagged flows, which perf.sh runs.
    [[ $area == perf ]] || areas+=("$area")
  done < <(cd "$mobile/.maestro/flows" && ls -d */ | tr -d /)
fi

is_manual() {
  local tag
  for tag in "${manual_tags[@]}"; do
    grep -qx "  - $tag" "$1" && return 0
  done
  return 1
}

failed=0
# run_one <label>, then run-flows.sh's arguments for it.
run_one() {
  local label=$1 summary
  shift
  local args=(--sha "$key" "$@")
  [[ -z $out ]] || args+=(--out "$out/$label")
  summary=$("$here/run-flows.sh" "${args[@]}" 2>&1 | tail -n 1) || failed=1
  echo "$label: $summary"
}

for area in "${areas[@]}"; do
  if [[ " ${per_flow_areas[*]} " == *" $area "* ]]; then
    for flow in "$mobile/.maestro/flows/$area"/*.yaml; do
      is_manual "$flow" || run_one "$area/$(basename "$flow" .yaml)" "$flow"
    done
  else
    run_one "$area" --area "$area"
  fi
done
exit "$failed"
