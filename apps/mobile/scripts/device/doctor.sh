#!/usr/bin/env bash
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

toolchain=false
case ${1:-} in
  "") ;;
  --toolchain) toolchain=true ;;
  *)
    echo "usage: doctor.sh [--toolchain]" >&2
    exit 2
    ;;
esac

failures=0
verdict() {
  local rc=$1
  shift
  if ((rc == 0)); then
    echo "ok   $*"
  else
    echo "FAIL $*"
    failures=$((failures + 1))
  fi
}

maestro_out=$(mktemp)
trap 'rm -f "$maestro_out"' EXIT
timeout 30 maestro --version >"$maestro_out" 2>/dev/null &
maestro_pid=$!

if [[ -e $MONI_DEVICE_STATE_DIR/hold ]]; then
  verdict 1 "hold $MONI_DEVICE_STATE_DIR/hold exists, operator hold"
else
  verdict 0 "hold none"
fi

adb_version=$(adb version 2>/dev/null | sed -n 's/^Version \([0-9.]*\).*/\1/p')
[[ $adb_version == 37.* ]]
verdict $? "adb ${adb_version:-missing}"

java_major=$(java -version 2>&1 | sed -n 's/.*version "\([0-9]*\).*/\1/p' | head -n 1)
((${java_major:-0} >= 17))
verdict $? "java ${java_major:-missing}"

if $toolchain; then
  for tool in node pnpm adb maestro java; do
    path=$(command -v "$tool" || echo missing)
    [[ $path != missing && $path != /mnt/[a-z]/* ]]
    verdict $? "$tool $path"
  done
  [[ -x $MONI_TAILSCALE ]]
  verdict $? "tailscale $MONI_TAILSCALE"
fi

netstat=$(timeout 10 "$MONI_NETSTAT" -ano -p tcp 2>&1)
netstat_rc=$?
windows_adb=$(tr -d '\r' <<<"$netstat" | awk '$2 ~ /:5037$/ && $4 == "LISTENING" { print $5; exit }')
if ((netstat_rc != 0)); then
  windows_adb=unknown
  verdict 1 "port-5037 netstat.exe failed with $netstat_rc"
elif [[ -n $windows_adb ]]; then
  verdict 1 "port-5037 held by Windows pid $windows_adb, stop it with: adb.exe kill-server"
else
  verdict 0 "port-5037 no Windows adb server"
fi

# A phone on the same Wi-Fi is reached by its LAN address, so Tailscale has nothing to say about it;
# the device check below proves adb reaches it.
if [[ $MONI_DEVICE_HOST =~ ^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.) ]]; then
  verdict 0 "tailscale skipped, $MONI_DEVICE_HOST is a LAN address"
else
  peer=$(timeout 10 "$MONI_TAILSCALE" status 2>/dev/null | tr -d '\r' | awk -v ip="$MONI_DEVICE_HOST" '$1 == ip { $1 = $1; print }')
  [[ -n $peer && $peer != *offline* ]]
  verdict $? "tailscale-status ${peer:-$MONI_DEVICE_HOST not in tailscale status}"

  "$MONI_TAILSCALE" ping --c 1 --timeout 5s "$MONI_DEVICE_HOST" >/dev/null 2>&1
  verdict $? "tailscale-ping $MONI_DEVICE_HOST"
fi

dev() { timeout 10 adb -s "$MONI_DEVICE_SERIAL" "$@"; }
release="" hyperos=""
if [[ -n $windows_adb ]]; then
  verdict 1 "device not checked while Windows adb holds port 5037"
else
  device_state=$(adb -s "$MONI_DEVICE_SERIAL" get-state 2>/dev/null)
  if [[ $device_state != device ]]; then
    verdict 1 "device $MONI_DEVICE_SERIAL ${device_state:-not connected}, run connect.sh"
  else
    verdict 0 "device $MONI_DEVICE_SERIAL"
    wake=$(dev shell input keyevent KEYCODE_WAKEUP 2>&1)
    (($? == 0)) && [[ $wake != *SecurityException* ]]
    verdict $? "wake ${wake:-no SecurityException}"
    battery_info=$(dev shell dumpsys battery | tr -d '\r')
    battery=$(awk '$1 == "level:" { print $2 }' <<<"$battery_info")
    # A run must not drain the phone flat; on a charger it can't, so a lower level is enough.
    if grep -Eq '(AC|USB|Wireless) powered: true' <<<"$battery_info"; then
      ((${battery:-0} > 15))
      verdict $? "battery ${battery:-unknown}%, charging"
    else
      ((${battery:-0} > 30))
      verdict $? "battery ${battery:-unknown}%"
    fi
    # A picture-in-picture window (a video call) sits over the app and takes the taps under it.
    floating=$(dev shell dumpsys activity activities | tr -d '\r' | awk '/^ *\* Task\{/ && /mode=pinned/ { if (match($0, /A=[0-9]+:[^ ]+/)) print substr($0, RSTART + 2, RLENGTH - 2) }' | sed 's/^[0-9]*://' | head -n 1)
    [[ -z $floating ]]
    verdict $? "floating ${floating:+window from $floating covers the screen, close it or end the call}${floating:-none}"
    if [[ $(dev shell dumpsys window policy) == *"showing=true"* ]]; then
      echo "note keyguard showing, unlock the phone before a lane drives an app"
    fi
    release=$(dev shell getprop ro.build.version.release | tr -d '\r')
    hyperos=$(dev shell getprop ro.mi.os.version.name | tr -d '\r')
  fi
fi

wait "$maestro_pid"
maestro_version=$(grep -xE '[0-9]+\.[0-9]+\.[0-9]+' "$maestro_out" | head -n 1)
[[ $maestro_version == 2.11.0 ]]
verdict $? "maestro ${maestro_version:-missing}"

if ((failures > 0)); then
  echo "FAIL $failures checks for $MONI_DEVICE_SERIAL"
  exit 1
fi
echo "OK device $MONI_DEVICE_SERIAL android $release hyperos $hyperos"
