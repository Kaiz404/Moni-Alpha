#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

if (($# > 1)) || [[ -n ${1:-} && $1 != ?*:[0-9]* ]]; then
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

remember() {
  local previous tmp
  previous=$(cat "$MONI_DEVICE_STATE_DIR/serial" 2>/dev/null || true)
  if [[ -n $previous && $previous != "$serial" ]]; then
    timeout 10 adb disconnect "$previous" >/dev/null 2>&1 || true
  fi
  tmp=$(mktemp "$MONI_DEVICE_STATE_DIR/serial.XXXXXX")
  echo "$serial" >"$tmp"
  mv "$tmp" "$MONI_DEVICE_STATE_DIR/serial"
}

for attempt in 0 1 2 3; do
  if ready; then
    remember
    echo "connected $serial"
    exit 0
  fi
  ((attempt < 3)) || break
  ((attempt == 0)) || sleep 1
  if [[ $(state) == offline ]]; then
    timeout 10 adb disconnect "$serial" >/dev/null 2>&1 || true
  fi
  timeout 10 adb connect "$serial" >&2 || true
done

final=$(state)
echo "adb down, run taildrop.sh or ask the operator for O2. $serial is ${final:-not connected}. If Wireless debugging shows a new port, run connect.sh ${serial%:*}:<port>." >&2
exit 3
