#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: review-pair.sh <slug> <Board> <device.png> [--out <dir>]" >&2
  exit 2
}

(($# == 3 || $# == 5)) || usage
slug=$1 board=$2 device=$3
out=${MONI_REVIEW_DIR:-$HOME/.local/share/moni-runs/review}
if (($# == 5)); then
  [[ $4 == --out ]] || usage
  out=$5
fi
[[ $slug =~ ^[a-z0-9-]+$ ]] || usage
renders=${MONI_BOARD_RENDERS:-$HOME/.local/share/moni-canvas/renders/r6/all}
render=$renders/$board.png
if [[ ! -f $render ]]; then
  echo "no board render at $render. Boards: $(cd "$renders" 2>/dev/null && ls -- *.png 2>/dev/null | sed 's/\.png$//' | tr '\n' ' ')" >&2
  exit 3
fi
if [[ $(head -c 4 "$device" 2>/dev/null | od -An -tx1 | tr -d ' ') != 89504e47 ]]; then
  echo "$device is not a PNG" >&2
  exit 3
fi
mkdir -p "$out"
cp "$render" "$out/$slug-board.png"
cp "$device" "$out/$slug-device.png"
echo "$out/$slug-board.png"
echo "$out/$slug-device.png"
