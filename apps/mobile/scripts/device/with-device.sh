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
    --pr) pr=${2:?} && shift 2 ;;
    --lane) lane=${2:?} && shift 2 ;;
    --skip-doctor) doctor=false && shift ;;
    --) shift && break ;;
    *) usage ;;
  esac
done
(($#)) || usage

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
operator_hold
echo "$(date -Iseconds) $$ $pr $lane" >>"$owner"
echo "device lock taken by $$ $pr $lane" >&2

# Children must not inherit fd 9: a daemon they spawn, such as the adb
# server, would otherwise keep the lock after this script exits.
if $doctor; then
  "$here/doctor.sh" 9>&- >&2 || exit 6
fi
"$@" 9>&-
