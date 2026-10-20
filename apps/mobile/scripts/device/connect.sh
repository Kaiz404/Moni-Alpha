#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

if (($# > 1)) || [[ ${1:-} == -* ]]; then
  echo "usage: connect.sh [host:port]" >&2
  exit 2
fi
serial=${1:-$MONI_DEVICE_SERIAL}

state() { adb -s "$serial" get-state 2>/dev/null || true; }

ready() {
  local s
  for _ in 1 2 3 4; do
    s=$(state)
    [[ $s == device ]] && return 0
    [[ $s == offline ]] || return 1
    sleep 0.5
  done
  return 1
}

for attempt in 0 1 2 3; do
  if ready; then
    echo "$serial" >"$MONI_DEVICE_STATE_DIR/serial.tmp"
    mv "$MONI_DEVICE_STATE_DIR/serial.tmp" "$MONI_DEVICE_STATE_DIR/serial"
    echo "connected $serial"
    exit 0
  fi
  ((attempt < 3)) || break
  ((attempt == 0)) || sleep 1
  [[ $(state) == offline ]] && adb disconnect "$serial" >/dev/null 2>&1
  timeout 10 adb connect "$serial" >&2 || true
done

echo "adb down, run taildrop.sh or ask the operator for O2. If Wireless debugging shows a new port, run connect.sh ${serial%:*}:<port>." >&2
exit 3
