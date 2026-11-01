#!/usr/bin/env bash
# Keeps Maestro's two driver apps on the phone. By default `maestro test` installs them at the start
# of a run and removes them at the end, so every run asks the operator to answer the HyperOS install
# prompts. run-flows.sh passes --no-reinstall-driver and calls this first.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

jar=${MONI_MAESTRO_CLIENT_JAR:-$HOME/.maestro/lib/maestro-client.jar}
if [[ ! -f $jar ]]; then
  echo "no Maestro client jar at $jar" >&2
  exit 3
fi

adb() { command adb -s "$MONI_DEVICE_SERIAL" "$@"; }
key=$(sha256sum "$jar" | cut -c1-16)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
limit=${MONI_INSTALL_TIMEOUT:-300}
# Each app keeps its own marker, so a prompt that timed out on the second app does not repeat the first.
for pair in maestro-app.apk:dev.mobile.maestro maestro-server.apk:dev.mobile.maestro.test; do
  apk=${pair%%:*} package=${pair##*:}
  marker=/data/local/tmp/moni-$apk.sha
  if [[ $(adb shell cat "$marker" 2>/dev/null | tr -d '\r') == "$key" ]] && adb shell pm path "$package" | grep -q '^package:'; then
    echo "skipped $apk, $key is already on the phone"
    continue
  fi
  unzip -qo "$jar" "$apk" -d "$work"
  echo "installing $apk, the phone may show an install prompt" >&2
  if ! timeout "$limit" adb -s "$MONI_DEVICE_SERIAL" install -r -d -g "$work/$apk"; then
    echo "adb install of $apk failed or waited more than $limit s. Check the phone for a Google Play Protect or Install via USB prompt, which only the operator can answer." >&2
    exit 4
  fi
  adb shell "echo $key >$marker"
  echo "installed $apk $key"
done
