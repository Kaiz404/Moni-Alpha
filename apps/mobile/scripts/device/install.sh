#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

if (($# != 1)); then
  echo "usage: install.sh <sha or build key>" >&2
  exit 2
fi
key=$1
package=com.anonymous.moni.e2e
marker=/data/local/tmp/moni-e2e.sha
apk=${MONI_APK_CACHE:-$HOME/.cache/moni-apk}/$key/app-release.apk
if [[ ! -f $apk ]]; then
  echo "no APK at $apk, run build-apk.sh first" >&2
  exit 2
fi

aapt2=${MONI_AAPT2:-$(compgen -G "$ANDROID_HOME/build-tools/*/aapt2" | sort -V | tail -n 1)}
apk_package=$("$aapt2" dump packagename "$apk")
if [[ $apk_package != "$package" ]]; then
  echo "install.sh installs only $package, and $apk is $apk_package" >&2
  exit 3
fi

adb() { command adb -s "$MONI_DEVICE_SERIAL" "$@"; }
if [[ $(adb shell cat "$marker" 2>/dev/null | tr -d '\r') == "$key" ]] && adb shell pm path "$package" | grep -q '^package:'; then
  echo "skipped install, $key is already on the phone"
else
  adb install -r -d "$apk"
  adb shell "echo $key >$marker"
  echo "installed $key"
fi
requested=$("$aapt2" dump permissions "$apk")
for permission in CAMERA RECORD_AUDIO ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION POST_NOTIFICATIONS; do
  if [[ $requested == *"name='android.permission.$permission'"* ]]; then
    adb shell pm grant "$package" "android.permission.$permission"
  else
    echo "skipped $permission, the APK does not request it"
  fi
done
