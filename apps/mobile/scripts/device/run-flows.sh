#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$here/env.sh"
mobile=$(cd "$here/../.." && pwd)
maestro_dir=$mobile/.maestro
package=com.anonymous.moni.e2e
source "$here/manual-tags.sh"

usage() {
  echo "usage: run-flows.sh [--sha <key>] [--seed full|empty] [--out <dir>] [--tag <tag>]... [--area <area>]... [<flow.yaml or dir>...]" >&2
  echo "areas: $(cd "$maestro_dir/flows" && ls -d */ | tr -d / | tr '\n' ' ')" >&2
  exit 2
}

argv=("$@") key="" seed=full out="" tags=() paths=()
while (($#)); do
  case $1 in
    --sha | --seed | --out | --tag | --area)
      (($# >= 2)) || usage
      case $1 in
        --sha) key=$2 ;;
        --seed) seed=$2 ;;
        --out) out=$2 ;;
        --tag) tags+=("$2") ;;
        --area)
          [[ $2 =~ ^[a-z0-9-]+$ && -d $maestro_dir/flows/$2 ]] || {
            echo "no area $2 under .maestro/flows" >&2
            usage
          }
          paths+=("$maestro_dir/flows/$2")
          ;;
      esac
      shift 2
      ;;
    -*) usage ;;
    *)
      if [[ -e $1 ]]; then
        paths+=("$(realpath "$1")")
      elif [[ -e $mobile/$1 ]]; then
        paths+=("$mobile/$1")
      else
        echo "no flow at $1" >&2
        usage
      fi
      shift
      ;;
  esac
done
case $seed in
  full) other_seed=seed-empty ;;
  empty) other_seed=seed-full ;;
  *)
    echo "--seed is full or empty, got $seed" >&2
    usage
    ;;
esac
((${#paths[@]})) || paths=("$maestro_dir")
key=${key:-$(git -C "$mobile" rev-parse HEAD)}

if [[ -z ${MONI_DEVICE_LOCK_HOLDER:-} ]] || ! kill -0 "$MONI_DEVICE_LOCK_HOLDER" 2>/dev/null; then
  exec "$here/with-device.sh" --lane "${MONI_LANE:-run-flows}" -- "$here/run-flows.sh" "${argv[@]}"
fi

e2e_value() {
  local name=$1 main file line
  if [[ -n ${!name:-} ]]; then
    echo "${!name}"
    return
  fi
  main=$(git -C "$mobile" worktree list --porcelain | sed -n '1s/^worktree //p')
  for file in "$mobile/.env.e2e" "$main/apps/mobile/.env.e2e"; do
    [[ -f $file ]] || continue
    line=$(grep -m 1 "^$name=" "$file" || true)
    if [[ -n $line ]]; then
      line=${line#*=}
      line=${line%$'\r'}
      line=${line#[\"\']}
      echo "${line%[\"\']}"
      return
    fi
  done
  echo "set $name in apps/mobile/.env.e2e, see .env.e2e.example" >&2
  exit 3
}
email=$(e2e_value E2E_EMAIL)
password=$(e2e_value E2E_PASSWORD)

adb() { command adb -s "$MONI_DEVICE_SERIAL" "$@"; }

run=${MONI_RUNS_DIR:-$HOME/.local/share/moni-runs}/$key/$(date +%Y%m%dT%H%M%S)
mkdir -p "$run"
echo "run $run" >&2

"$here/install-driver.sh" >&2
"$here/install.sh" "$key" >&2
# A -clock build pins JS time, so the seed moves its dates to that same day.
build_json=${MONI_APK_CACHE:-$HOME/.cache/moni-apk}/$key/build.json
e2e_now=$(sed -n 's/.*"e2eNow": "\(.*\)".*/\1/p' "$build_json" 2>/dev/null || true)
seed_args=(--reset --profile "$seed")
[[ -z $e2e_now ]] || seed_args+=(--today "${e2e_now:0:10}")
node "$mobile/scripts/e2e/seed.mjs" "${seed_args[@]}" >"$run/seed.log"
tail -n 2 "$run/seed.log" | head -n 1 >&2
# A fresh app reads the new seed; a cached Legend-State store would keep deleted rows.
adb shell pm clear "$package" >/dev/null
"$here/install.sh" "$key" >/dev/null
adb shell mkdir -p /sdcard/Pictures/moni-e2e
for fixture in "$maestro_dir"/fixtures/*.png; do
  adb push "$fixture" /sdcard/Pictures/moni-e2e/ >/dev/null
  adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d "file:///sdcard/Pictures/moni-e2e/$(basename "$fixture")" >/dev/null 2>&1 || true
done

exclude=("$other_seed")
for tag in "${manual_tags[@]}"; do
  [[ " ${tags[*]-} " == *" $tag "* ]] || exclude+=("$tag")
done
include=()
((${#tags[@]})) && include=(--include-tags "$(IFS=,; echo "${tags[*]}")")

# Notification access only for the run: Home draws its access card without it, and the phone is the
# operator's, so Moni E2E does not keep reading its notifications afterwards.
# A needs-access-off run keeps it off, for the disclosure sheet that asks for it.
listener=$package/com.lesimoes.androidnotificationlistener.RNAndroidNotificationListener
if [[ " ${tags[*]-} " == *" needs-access-off "* ]]; then
  adb shell cmd notification disallow_listener "$listener" >/dev/null 2>&1 || true
else
  adb shell cmd notification allow_listener "$listener" >/dev/null 2>&1 || true
fi
trap 'adb shell cmd notification disallow_listener "$listener" >/dev/null 2>&1 || true' EXIT

pinned() { adb shell dumpsys activity activities 2>/dev/null | node "$here/overlays.mjs" parse; }
pinned >"$run/overlays.txt" || true
# A floating window can appear mid-run (a call comes in), so look every few seconds.
( while true; do pinned >>"$run/overlays.txt" 2>/dev/null; sleep 3; done ) 9>&- &
poller=$!

# The screen must stay on for the whole run; a phone that sleeps mid-run records black frames.
adb shell svc power stayon true >/dev/null 2>&1 || true
adb shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true

rc=0
maestro test --device "$MONI_DEVICE_SERIAL" --no-reinstall-driver "${include[@]}" --exclude-tags "$(IFS=,; echo "${exclude[*]}")" \
  --format junit --output "$run/report.xml" --test-output-dir "$run/maestro" \
  -e "E2E_EMAIL=$email" -e "E2E_PASSWORD=$password" "${paths[@]}" >"$run/maestro.log" 2>&1 || rc=$?
tail -n 20 "$run/maestro.log" >&2
kill "$poller" 2>/dev/null || true
# A caller running many areas (parity.sh) keeps the screen on across them and restores it itself.
[[ -n ${MONI_KEEP_AWAKE:-} ]] || adb shell svc power stayon false >/dev/null 2>&1 || true
pinned >>"$run/overlays.txt" || true
sort -u -o "$run/overlays.txt" "$run/overlays.txt"
if [[ -s $run/overlays.txt ]]; then
  echo "blacked out another app's floating window in the screenshots: $(tr '\n' ';' <"$run/overlays.txt")" >&2
  echo "UNRELIABLE run: a floating window covered part of the screen and takes taps there" >&2
  node "$here/overlays.mjs" mask "$run/overlays.txt" "$run/maestro" || echo "masking the floating window failed" >&2
fi

if [[ -n $out ]]; then
  mkdir -p "$out"
  find "$run/maestro" -name '*.png' -exec cp {} "$out/" \; 2>/dev/null || true
  cat "$run/overlays.txt" >>"$out/overlays.txt"
fi
cases=$(grep -o '<testcase ' "$run/report.xml" 2>/dev/null | wc -l || true)
# grep exits 1 when no flow failed, which pipefail would turn into this script's exit.
failed=$(grep -o '<failure' "$run/report.xml" 2>/dev/null | wc -l || true)
echo "$((cases - failed))/$cases flows passed, report $run/report.xml"
# No flow ran (the phone dropped off adb, or the tags matched nothing): that proves nothing, so it fails.
if ((cases == 0)); then
  echo "NO FLOWS RAN: $(grep -v '^$' "$run/maestro.log" 2>/dev/null | tail -n 1)" >&2
  exit 1
fi
exit "$rc"
