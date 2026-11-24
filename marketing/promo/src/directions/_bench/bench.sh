#!/usr/bin/env bash
# usage: bench.sh <label> <composition> <frames> [extra remotion render args...]
# Renders from the prebundle in $BUNDLE. Appends label, comp, frames, wall s, cpu s (user+sys of the whole tree), load1 before, load1 after to $LOG.
set -uo pipefail
label=$1; comp=$2; frames=$3; shift 3
cd "$(dirname "$0")/../../.."
out="$SCRATCH/bench-$label.mp4"
l0=$(cut -d' ' -f1 /proc/loadavg)
if /usr/bin/time -f '%e %U %S' -o "$SCRATCH/bench-$label.time" npx remotion render "$BUNDLE" "$comp" "$out" --frames="$frames" --log=error --timeout=120000 "$@" >/dev/null 2>"$SCRATCH/bench-$label.err"; then
  read -r wall user sys <"$SCRATCH/bench-$label.time"
  printf '%s\t%s\t%s\t%s\t%.0f\t%s\t%s\n' "$label" "$comp" "$frames" "$wall" "$(echo "$user+$sys" | bc)" "$l0" "$(cut -d' ' -f1 /proc/loadavg)" >>"$LOG"
else
  echo "$label FAILED" >>"$LOG"
fi
