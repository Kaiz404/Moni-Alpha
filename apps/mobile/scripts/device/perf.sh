#!/usr/bin/env bash
set -euo pipefail
here=$(dirname "${BASH_SOURCE[0]}")
source "$here/env.sh"

usage() {
  echo "usage: perf.sh --sha <sha or build key> [--flow <flow.yaml>] [--out <perf.json>] [--runs <n>]" >&2
  exit 2
}

key="" flow="" out=perf.json runs=10
while (($#)); do
  (($# >= 2)) || usage
  case $1 in
    --sha) key=$2 ;;
    --flow) flow=$2 ;;
    --out) out=$2 ;;
    --runs) runs=$2 ;;
    *) usage ;;
  esac
  shift 2
done
[[ -n $key && $runs =~ ^[1-9][0-9]*$ ]] || usage

package=com.anonymous.moni.e2e
apk=${MONI_APK_CACHE:-$HOME/.cache/moni-apk}/$key/app-release.apk
adb() { command adb -s "$MONI_DEVICE_SERIAL" "$@"; }

tenths=$(adb shell dumpsys battery | sed -n 's/^ *temperature: *\([0-9]*\).*/\1/p' | head -n 1)
if [[ -z $tenths ]] || ((tenths > 400)); then
  echo "perf.sh measures only at 40 C or below, and the battery reads ${tenths:-no} tenths of a degree" >&2
  exit 7
fi
battery_c=$((tenths / 10)).$((tenths % 10))

"$here/install.sh" "$key" >&2

samples=()
for ((i = 0; i < runs; i++)); do
  adb shell am force-stop "$package"
  sleep 1
  total=$(adb shell am start -W -n "$package/.MainActivity" | sed -n 's/^TotalTime: *\([0-9]*\).*/\1/p' | tr -d '\r')
  [[ -n $total ]] && samples+=("$total")
  sleep 2
done
cold_ms=null
if ((${#samples[@]})); then
  cold_ms=$(printf '%s\n' "${samples[@]}" | sort -n | awk '{ v[NR] = $1 } END { print (NR % 2) ? v[(NR + 1) / 2] : int((v[NR / 2] + v[NR / 2 + 1]) / 2) }')
fi

apk_bytes=$(stat -c %s "$apk")
bundle_bytes=$(unzip -l "$apk" assets/index.android.bundle | awk '$4 == "assets/index.android.bundle" { print $1 }')

janky=null p50=null p90=null p95=null
if [[ -n $flow ]]; then
  adb shell dumpsys gfxinfo "$package" reset >/dev/null
  maestro --device "$MONI_DEVICE_SERIAL" test "$flow" >&2
  gfx=$(adb shell dumpsys gfxinfo "$package" | tr -d '\r')
  janky=$(sed -n 's/^Janky frames: [0-9]* (\([0-9.]*\)%).*/\1/p' <<<"$gfx" | head -n 1)
  pct() { sed -n "s/^$1th percentile: \([0-9]*\)ms.*/\1/p" <<<"$gfx" | head -n 1; }
  p50=$(pct 50) p90=$(pct 90) p95=$(pct 95)
fi

mkdir -p "$(dirname "$out")"
cat >"$out" <<JSON
{
  "key": "$key",
  "coldStartMs": $cold_ms,
  "coldStartSamplesMs": [$(IFS=,; echo "${samples[*]}")],
  "apkBytes": ${apk_bytes:-null},
  "bundleBytes": ${bundle_bytes:-null},
  "jankyPct": ${janky:-null},
  "p50Ms": ${p50:-null},
  "p90Ms": ${p90:-null},
  "p95Ms": ${p95:-null},
  "batteryC": $battery_c,
  "measuredAt": "$(date -Iseconds)"
}
JSON
cat "$out"
