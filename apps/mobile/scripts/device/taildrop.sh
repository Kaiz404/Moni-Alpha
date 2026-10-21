#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

if (($# != 1)) || [[ ! -f $1 ]]; then
  echo "usage: taildrop.sh <file>" >&2
  exit 2
fi
"$MONI_TAILSCALE" file cp "$(wslpath -w "$1")" "$MONI_DEVICE_NAME:"
echo "sent $1 to $MONI_DEVICE_NAME"
