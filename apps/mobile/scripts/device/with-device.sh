#!/usr/bin/env bash
set -euo pipefail
here=$(dirname "${BASH_SOURCE[0]}")
source "$here/env.sh"

usage() {
  echo "usage: with-device.sh [--pr <id>] [--lane <name>] [--skip-doctor] -- <command...>" >&2
  exit 2
}

pr=${MONI_PR_ID:--} lane=${MONI_LANE:--} doctor=true
while (($#)); do
  case $1 in
    --pr | --lane)
      (($# >= 2)) || usage
      [[ $1 == --pr ]] && pr=$2 || lane=$2
      shift 2
      ;;
    --skip-doctor)
      doctor=false
      shift
      ;;
    --)
      shift
      break
      ;;
    *) usage ;;
  esac
done
(($#)) || usage

if [[ -n ${MONI_DEVICE_LOCK_HOLDER:-} ]] && kill -0 "$MONI_DEVICE_LOCK_HOLDER" 2>/dev/null; then
  exec "$@"
fi

hold=$MONI_DEVICE_STATE_DIR/hold
lock=$MONI_DEVICE_STATE_DIR/redmi.lock
owner=$MONI_DEVICE_STATE_DIR/redmi.owner

operator_hold() {
  if [[ -e $hold ]]; then
    echo "operator hold, $hold exists" >&2
    exit 4
  fi
}

operator_hold
exec 9>"$lock"
if ! flock -n 9; then
  echo "waiting for device lock held by $(tail -n 1 "$owner" 2>/dev/null | cut -d' ' -f2-)" >&2
  if ! flock -w 2700 9; then
    echo "gave up after 2700 s waiting for the device lock" >&2
    exit 5
  fi
fi
{ tail -n 199 "$owner" 2>/dev/null; echo "$(date -Iseconds) $$ $pr $lane"; } >"$owner.tmp" && mv "$owner.tmp" "$owner"
operator_hold
echo "device lock taken by $$ $pr $lane" >&2

# The lane inherits fd 9, so the lock frees only when every lane process has
# exited. The adb server starts here, and bin/adb on PATH closes fd 9, so a
# server that restarts inside the lane never holds the lock.
if $doctor; then
  "$here/doctor.sh" 9>&- >&2 || exit 6
fi
adb start-server >&2 || echo "adb start-server failed" >&2
export ANDROID_SERIAL=$MONI_DEVICE_SERIAL MONI_DEVICE_LOCK_HOLDER=$$

child=""
stop() {
  if [[ -n $child ]]; then
    kill -TERM -- "-$child" 2>/dev/null || true
    for _ in {1..100}; do
      kill -0 -- "-$child" 2>/dev/null || exit "$1"
      sleep 0.1
    done
    kill -KILL -- "-$child" 2>/dev/null || true
  fi
  exit "$1"
}
trap 'stop 129' HUP
trap 'stop 130' INT
trap 'stop 143' TERM
{ exec 8<&0; } 2>/dev/null || exec 8</dev/null
setsid "$@" <&8 8<&- &
child=$!
rc=0
wait "$child" || rc=$?
exit "$rc"
