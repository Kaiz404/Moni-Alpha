#!/usr/bin/env bash
# Leases one AWS Device Farm phone and attaches it to local adb through Device Connect.
#   devicefarm.sh start    adopt the project's live session or create one, wait for RUNNING, attach it
#   devicefarm.sh connect  attach the saved session to adb again (after a bridge restart)
#   devicefarm.sh prep     install the Moni E2E APK and set the phone up for clean recording
#   devicefarm.sh stop     detach and stop every RUNNING or PENDING session in the project
#   devicefarm.sh status   list the project's sessions; the last line counts the live ones
# Billing is per device minute until stop, so callers run stop in a trap.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/../../.." && pwd)

aws_df() { aws devicefarm --profile "${MONI_DF_PROFILE:-moni-devicefarm}" --region us-west-2 "$@"; }
project_name=${MONI_DF_PROJECT:-moni-marketing}
devices=(
  arn:aws:devicefarm:us-west-2::device:AC2E189FD1154D05BFCC187783715555
  arn:aws:devicefarm:us-west-2::device:A571183F1FF74A798C9C5DA2AEC820D8
)
state=${MONI_DF_STATE:-$HOME/.local/share/moni-devicefarm}
mkdir -p "$state"
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Android/Sdk}
adb_bin=$ANDROID_HOME/platform-tools/adb
connect_bin=${DEVICEFARM_CONNECT:-$HOME/.local/bin/devicefarm-connect}
package=com.anonymous.moni.e2e

project_arn() {
  local arn
  arn=$(aws_df list-projects --query "projects[?name=='$project_name'].arn | [0]" --output text)
  if [[ $arn == None || -z $arn ]]; then
    arn=$(aws_df create-project --name "$project_name" --query project.arn --output text)
  fi
  echo "$arn"
}

live_sessions() {
  aws_df list-remote-access-sessions --arn "$1" \
    --query "remoteAccessSessions[?status=='RUNNING' || status=='STOPPING' || status=='PENDING' || status=='PREPARING' || status=='SCHEDULING' || status=='PENDING_CONCURRENCY' || status=='PENDING_DEVICE' || status=='PROCESSING' || status=='INITIALIZING'].arn" \
    --output text | tr '\t' '\n' | grep -v '^None$' | grep . || true
}

wait_running() {
  local arn=$1 status deadline=$((SECONDS + 900))
  while ((SECONDS < deadline)); do
    status=$(aws_df get-remote-access-session --arn "$arn" --query remoteAccessSession.status --output text)
    case $status in
      RUNNING) return 0 ;;
      COMPLETED | STOPPING) echo "session ended while waiting: $status" >&2; return 1 ;;
    esac
    echo "session $status" >&2
    sleep 10
  done
  echo "session not RUNNING after 15 min" >&2
  return 1
}

cmd_connect() {
  local arn serial
  arn=$(cat "$state/session")
  # The bridge reads the credentials of the shell that starts it, so it starts under the Device Farm profile.
  AWS_PROFILE=${MONI_DF_PROFILE:-moni-devicefarm} AWS_REGION=us-west-2 "$connect_bin" bridge start --port 5037 >&2
  AWS_PROFILE=${MONI_DF_PROFILE:-moni-devicefarm} AWS_REGION=us-west-2 "$connect_bin" device add --session-arn "$arn" >&2
  for _ in $(seq 30); do
    serial=$("$adb_bin" devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')
    [[ -n $serial ]] && break
    sleep 2
  done
  [[ -n $serial ]] || { echo "no device in adb devices after attach" >&2; return 1; }
  echo "$serial" >"$state/serial"
  echo "attached $serial $("$adb_bin" -s "$serial" shell getprop ro.product.model | tr -d '\r') android $("$adb_bin" -s "$serial" shell getprop ro.build.version.release | tr -d '\r')"
}

cmd_start() {
  local project arn device
  project=$(project_arn)
  arn=$(live_sessions "$project" | head -n 1)
  if [[ -n $arn ]]; then
    echo "adopting live session $arn" >&2
  else
    for device in "${devices[@]}"; do
      arn=$(aws_df create-remote-access-session --project-arn "$project" --device-arn "$device" \
        --name "promo-$(date +%Y%m%dT%H%M%S)" --query remoteAccessSession.arn --output text) && break
      echo "could not lease $device, trying the next" >&2
      arn=
    done
    [[ -n $arn ]] || { echo "no device could be leased" >&2; return 1; }
  fi
  echo "$arn" >"$state/session"
  date +%s >"$state/started"
  wait_running "$arn"
  cmd_connect
}

cmd_prep() {
  local serial apk
  serial=$(cat "$state/serial")
  apk=${1:-${MONI_PROMO_APK:?pass the e2e APK path or set MONI_PROMO_APK}}
  adb() { "$adb_bin" -s "$serial" "$@"; }
  [[ $(adb shell pm path "$package" | tr -d '\r') == package:* ]] || adb install -r -d "$apk" >&2
  jar=$HOME/.maestro/lib/maestro-client.jar
  work=$(mktemp -d)
  for pair in maestro-app.apk:dev.mobile.maestro maestro-server.apk:dev.mobile.maestro.test; do
    if ! adb shell pm path "${pair##*:}" | grep -q '^package:'; then
      unzip -qo "$jar" "${pair%%:*}" -d "$work"
      adb install -r -d -g "$work/${pair%%:*}" >&2
    fi
  done
  rm -rf "$work"
  adb shell mkdir -p /sdcard/Pictures/moni-e2e
  adb push "$root/apps/mobile/.maestro/fixtures/receipt-mamak.png" /sdcard/Pictures/moni-e2e/ >/dev/null
  adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/moni-e2e/receipt-mamak.png >/dev/null 2>&1 || true

  # The seed's today is Malaysian, so the phone's clock reads the same day.
  adb shell settings put global auto_time_zone 0 >/dev/null 2>&1 || true
  adb shell service call alarm 3 s16 Asia/Kuala_Lumpur >/dev/null 2>&1 || true
  adb shell cmd uimode night no >/dev/null
  adb shell settings put system show_touches 0
  adb shell settings put system pointer_location 0
  adb shell settings put global zen_mode 2 >/dev/null 2>&1 || true
  adb shell cmd notification set_dnd priority >/dev/null 2>&1 || true
  adb shell settings put system screen_off_timeout 1800000
  adb shell svc power stayon true
  adb shell input keyevent KEYCODE_WAKEUP
  adb shell wm dismiss-keyguard >/dev/null 2>&1 || true
  adb shell cmd statusbar collapse >/dev/null 2>&1 || true
  adb shell settings put secure clock_seconds 0
  adb shell settings put global sysui_demo_allowed 1
  demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }
  demo enter
  demo clock -e hhmm 0941
  demo battery -e level 100 -e plugged false -e powersave false
  demo network -e wifi show -e level 4 -e fully true
  demo network -e mobile hide
  demo network -e airplane hide
  demo notifications -e visible false
  demo status -e volume hide -e bluetooth hide -e location hide -e alarm hide -e sync hide -e tty hide -e eri hide -e mute hide -e speakerphone hide -e managed_profile hide
  echo "prepped $serial: demo status bar, no touches, light, DND, Asia/Kuala_Lumpur $(adb shell date +%Y-%m-%dT%H:%M | tr -d '\r')"
}

cmd_stop() {
  local project arn
  "$connect_bin" device remove >/dev/null 2>&1 || true
  "$connect_bin" bridge stop >/dev/null 2>&1 || true
  project=$(project_arn)
  { cat "$state/session" 2>/dev/null; live_sessions "$project"; } | sort -u | while read -r arn; do
    [[ -n $arn ]] || continue
    aws_df stop-remote-access-session --arn "$arn" --query remoteAccessSession.status --output text >/dev/null 2>&1 || true
    echo "stop requested $arn"
  done
  rm -f "$state/serial"
}

cmd_status() {
  local project live
  project=$(project_arn)
  aws_df list-remote-access-sessions --arn "$project" \
    --query 'remoteAccessSessions[].[name,status,result,deviceMinutes.metered,created,stopped]' --output text
  live=$(live_sessions "$project" | wc -l)
  echo "live sessions in $project_name: $live"
}

case ${1:-} in
  start | connect | stop | status) "cmd_$1" ;;
  prep) shift; cmd_prep "$@" ;;
  *) echo "usage: devicefarm.sh start|connect|prep <apk>|stop|status" >&2; exit 2 ;;
esac
