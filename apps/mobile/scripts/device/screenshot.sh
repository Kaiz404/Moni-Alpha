#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

if (($# != 1)); then
  echo "usage: screenshot.sh <out.png>" >&2
  exit 2
fi
out=$1
mkdir -p "$(dirname "$out")"
timeout 20 adb -s "$MONI_DEVICE_SERIAL" exec-out screencap -p >"$out.tmp" || true
if [[ $(head -c 4 "$out.tmp" | od -An -tx1 | tr -d ' ') != 89504e47 ]]; then
  rm -f "$out.tmp"
  echo "screencap from $MONI_DEVICE_SERIAL returned no PNG" >&2
  exit 1
fi
mv "$out.tmp" "$out"
echo "$out"
