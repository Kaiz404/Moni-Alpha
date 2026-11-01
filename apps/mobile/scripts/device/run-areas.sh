#!/usr/bin/env bash
# Runs each area of flows on its own fresh seed, so one area's edits cannot fail the next. On a -clock
# build it also keeps sign-ins short: the pinned clock never refreshes a session, which expires in 1 h.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mobile=$(cd "$here/../.." && pwd)

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

failed=0
for area in "${areas[@]}"; do
  args=(--sha "$key" --area "$area")
  [[ -z $out ]] || args+=(--out "$out/$area")
  summary=$("$here/run-flows.sh" "${args[@]}" 2>/dev/null | tail -n 1) || failed=1
  echo "$area: $summary"
done
exit "$failed"
