#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

if (($# != 2)) || [[ ! $1 =~ ^[1-9][0-9]*$ ]] || (($1 > 180)); then
  echo "usage: screenrecord.sh <seconds, 1 to 180> <out.mp4>" >&2
  exit 2
fi
seconds=$1 out=$2
remote=/data/local/tmp/moni-screenrecord.mp4
mkdir -p "$(dirname "$out")"
adb -s "$MONI_DEVICE_SERIAL" shell screenrecord --time-limit "$seconds" "$remote"
adb -s "$MONI_DEVICE_SERIAL" pull "$remote" "$out" >/dev/null
adb -s "$MONI_DEVICE_SERIAL" shell rm -f "$remote"
echo "$out"
