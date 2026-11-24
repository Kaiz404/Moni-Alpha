#!/usr/bin/env bash
# Records one marketing take on the attached Device Farm phone.
#   record-take.sh <feature> [--no-reset]
# Resets the e2e seed and the app's data, signs in and walks to the take's first screen through
# takes/<feature>.pre.yaml (or takes/_pre/home.yaml) unrecorded, then screenrecords takes/<feature>.yaml
# and hands the raw video to finish-take.py, which trims it and writes the clip, contact sheet and
# manifest entry. Rerunning a feature replaces its clip.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
promo=$(cd "$here/.." && pwd)
root=$(cd "$promo/../.." && pwd)
mobile=$root/apps/mobile

(($# >= 1)) || { echo "usage: record-take.sh <feature> [--no-reset]" >&2; exit 2; }
feature=$1 reset=true
[[ ${2:-} == --no-reset ]] && reset=false
take=$promo/takes/$feature.yaml
[[ -f $take ]] || { echo "no take at $take" >&2; exit 2; }
pre=$promo/takes/$feature.pre.yaml
[[ -f $pre ]] || pre=$promo/takes/_pre/home.yaml

state=${MONI_DF_STATE:-$HOME/.local/share/moni-devicefarm}
serial=$(cat "$state/serial")
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Android/Sdk}
adb() { "$ANDROID_HOME/platform-tools/adb" -s "$serial" "$@"; }
maestro() { "$HOME/.maestro/bin/maestro" --device "$serial" "$@"; }
package=com.anonymous.moni.e2e
node_bin=$(compgen -G "${NVM_DIR:-$HOME/.nvm}/versions/node/v22.*/bin" | sort -V | tail -n 1)
export PATH=$HOME/.local/opt/ffmpeg-static/bin:$node_bin:$PATH

env_value() {
  local line
  line=$(grep -m 1 "^$1=" "$mobile/.env.e2e")
  line=${line#*=}
  line=${line%$'\r'}
  line=${line#[\"\']}
  echo "${line%[\"\']}"
}

work=${MONI_PROMO_WORK:-$HOME/.local/share/moni-promo}/$feature/$(date +%Y%m%dT%H%M%S)
mkdir -p "$work"
echo "work $work" >&2

if $reset; then
  node "$mobile/scripts/e2e/seed.mjs" --reset --profile full >"$work/seed.log"
  adb shell pm clear "$package" >/dev/null
  for permission in CAMERA RECORD_AUDIO ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION POST_NOTIFICATIONS; do
    adb shell pm grant "$package" "android.permission.$permission" 2>/dev/null || true
  done
  adb shell cmd notification allow_listener "$package/com.lesimoes.androidnotificationlistener.RNAndroidNotificationListener" >/dev/null 2>&1 || true
fi
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941 >/dev/null
adb shell input keyevent KEYCODE_WAKEUP

# The pre phase types the e2e password; its output stays in $work and is never printed.
maestro test --no-reinstall-driver -e "E2E_EMAIL=$(env_value E2E_EMAIL)" -e "E2E_PASSWORD=$(env_value E2E_PASSWORD)" \
  --test-output-dir "$work/pre" "$pre" >"$work/pre.log" 2>&1 || {
  echo "pre flow failed, see $work/pre.log" >&2
  exit 1
}

remote=/data/local/tmp/moni-take.mp4
adb shell rm -f "$remote"
adb shell screenrecord --bit-rate 20000000 --time-limit 180 "$remote" &
recorder=$!
rec_ms=$(date +%s%3N)
echo "$rec_ms" >"$work/rec_ms"
sleep 1
rc=0
maestro test --no-reinstall-driver --debug-output "$work/debug" --flatten-debug-output \
  --test-output-dir "$work/take" "$take" >"$work/take.log" 2>&1 || rc=$?
sleep 1
adb shell pkill -INT screenrecord || true
wait "$recorder" || true
sleep 1
mkdir -p "$promo/clips/raw"
adb pull "$remote" "$promo/clips/raw/$feature.mp4" >/dev/null
if ((rc != 0)); then
  tail -n 15 "$work/take.log" >&2
  echo "take flow failed (rc $rc), raw video kept at $promo/clips/raw/$feature.mp4" >&2
  exit "$rc"
fi
python3 "$here/finish-take.py" "$feature" "$promo/clips/raw/$feature.mp4" "$work/debug" "$rec_ms" "$take"
