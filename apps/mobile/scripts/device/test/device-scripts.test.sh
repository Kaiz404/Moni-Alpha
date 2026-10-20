#!/usr/bin/env bash
set -uo pipefail
dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
tmp=$(mktemp -d)
wintmp=$(mktemp -d /mnt/c/Users/Public/moni-device-test.XXXXXX) || {
  echo "the tests need WSL with /mnt/c mounted"
  exit 1
}
holder=""
cleanup() {
  [[ -n $holder ]] && kill -9 -- "-$holder" 2>/dev/null
  rm -rf "$tmp" "$wintmp"
}
trap cleanup EXIT

failures=0
pass() { echo "PASS $*"; }
fail() {
  echo "FAIL $*"
  failures=$((failures + 1))
}
expect() {
  local name=$1 want=$2 got=$3
  if [[ $got == "$want" ]]; then pass "$name"; else fail "$name: want '$want', got '$got'"; fi
}
now_ms() { echo $(($(date +%s%N) / 1000000)); }

export MONI_DEVICE_STATE_DIR=$tmp/state

resolve_serial() { bash -c 'source "$1/env.sh" 2>/dev/null; echo "$MONI_DEVICE_SERIAL"' _ "$dir"; }
unset MONI_DEVICE_SERIAL
expect "serial falls back to the default" 100.127.128.74:5555 "$(resolve_serial)"
mkdir -p "$MONI_DEVICE_STATE_DIR"
echo 100.64.0.1:40001 >"$MONI_DEVICE_STATE_DIR/serial"
expect "serial comes from the state file" 100.64.0.1:40001 "$(resolve_serial)"
expect "an exported serial overrides the state file" 100.64.0.2:5 "$(MONI_DEVICE_SERIAL=100.64.0.2:5 resolve_serial)"
expect "a re-sourced env.sh re-reads a rotated port" 100.64.0.1:40002 "$(
  source "$dir/env.sh" 2>/dev/null
  echo 100.64.0.1:40002 >"$MONI_DEVICE_STATE_DIR/serial"
  source "$dir/env.sh" 2>/dev/null
  echo "$MONI_DEVICE_SERIAL"
)"

mkdir -p "$tmp/fake-sdk/platform-tools"
printf '#!/bin/sh\ncase "$*" in *get-state*) echo device ;; *screencap*) cat "$FAKE_SCREENCAP" ;; esac\n' >"$tmp/fake-sdk/platform-tools/adb"
chmod +x "$tmp/fake-sdk/platform-tools/adb"
printf '\211PNG\r\n\032\nrest' >"$tmp/screen.png"
echo "error: closed" >"$tmp/screen.bad"
NVM_DIR=$tmp/no-nvm ANDROID_HOME=$tmp/fake-sdk "$dir/connect.sh" 100.64.0.3:41000 >/dev/null 2>&1
expect "connect.sh <host:port> exits 0 when adb reports device, even with no node 22" 0 $?
expect "connect.sh remembers the serial it reached" 100.64.0.3:41000 "$(resolve_serial)"

out=$("$dir/connect.sh" 127.0.0.1:1 2>&1)
expect "connect.sh exits 3 for an unreachable serial" 3 $?
[[ $out == *"adb down, run taildrop.sh or ask the operator for O2"* ]] && pass "connect.sh prints the fallback" || fail "connect.sh fallback message missing: $out"
expect "a failed connect.sh keeps the last good serial" 100.64.0.3:41000 "$(resolve_serial)"

setsid "$dir/with-device.sh" --skip-doctor --pr t1 --lane holder -- sleep 3 >/dev/null 2>&1 &
holder=$!
disown
for _ in $(seq 50); do
  grep -q " $holder t1 holder$" "$MONI_DEVICE_STATE_DIR/redmi.owner" 2>/dev/null && break
  sleep 0.1
done
waiting=$(timeout 1 "$dir/with-device.sh" --skip-doctor -- true 2>&1)
[[ $waiting == *"waiting for device lock held by $holder t1 holder"* ]] && pass "a second caller names the holder" || fail "waiting message: $waiting"
kill -9 "$holder"
start=$(now_ms)
timeout 5 "$dir/with-device.sh" --skip-doctor --lane after-kill -- true 2>/dev/null
rc=$?
elapsed=$(($(now_ms) - start))
expect "with-device.sh runs after the holder is killed" 0 "$rc"
((elapsed < 2000)) && pass "kill -9 frees the lock in ${elapsed} ms" || fail "lock took ${elapsed} ms to free"

"$dir/with-device.sh" --skip-doctor --lane term -- bash -c "echo \$\$ >$tmp/term.pid; exec sleep 30" >/dev/null 2>&1 &
wrapper=$!
for _ in $(seq 50); do
  [[ -s $tmp/term.pid ]] && break
  sleep 0.1
done
kill -TERM "$wrapper"
wait "$wrapper" 2>/dev/null
kill -0 "$(cat "$tmp/term.pid")" 2>/dev/null && fail "SIGTERM left the lane command running" || pass "SIGTERM stops the lane command"
timeout 2 "$dir/with-device.sh" --skip-doctor -- true 2>/dev/null
expect "the lock is free after SIGTERM" 0 $?
expect "the lane command sees ANDROID_SERIAL" 100.64.0.3:41000 "$("$dir/with-device.sh" --skip-doctor -- bash -c 'echo "$ANDROID_SERIAL"' 2>/dev/null)"

"$dir/with-device.sh" --skip-doctor --lane daemon -- bash -c "sleep 30 >/dev/null 2>&1 & echo \$! >$tmp/daemon.pid" >/dev/null 2>&1
timeout 2 "$dir/with-device.sh" --skip-doctor -- true 2>/dev/null
expect "a daemon the command leaves behind does not keep the lock" 0 $?
kill "$(cat "$tmp/daemon.pid")" 2>/dev/null

FAKE_SCREENCAP=$tmp/screen.png ANDROID_HOME=$tmp/fake-sdk "$dir/screenshot.sh" "$tmp/shots/ok.png" >/dev/null 2>&1
expect "screenshot.sh saves the PNG adb returns" "$(cat "$tmp/screen.png")" "$(cat "$tmp/shots/ok.png" 2>/dev/null)"
FAKE_SCREENCAP=$tmp/screen.bad ANDROID_HOME=$tmp/fake-sdk "$dir/screenshot.sh" "$tmp/shots/bad.png" >/dev/null 2>&1
expect "screenshot.sh exits 1 when adb returns no PNG" 1 $?
expect "screenshot.sh leaves no file for a failed capture" "" "$(ls "$tmp/shots" | grep bad)"

expect "a nested with-device.sh runs inside the outer lock" inner-ran "$(timeout 5 "$dir/with-device.sh" --skip-doctor --lane outer -- "$dir/with-device.sh" --skip-doctor --lane inner -- echo inner-ran 2>/dev/null)"

MONI_TAILSCALE=/bin/false ANDROID_HOME=$tmp/fake-sdk "$dir/with-device.sh" --lane doctor-fails -- true >/dev/null 2>&1
expect "with-device.sh exits 6 when doctor.sh fails" 6 $?

touch "$MONI_DEVICE_STATE_DIR/hold"
out=$("$dir/with-device.sh" --skip-doctor -- true 2>&1)
expect "the hold file makes with-device.sh exit 4" 4 $?
[[ $out == *"operator hold"* ]] && pass "with-device.sh names the operator hold" || fail "hold message: $out"
rm "$MONI_DEVICE_STATE_DIR/hold"

toolchain_pnpm() {
  local bin=$1
  printf '#!/bin/sh\necho 9.0.0\n' >"$bin/pnpm"
  chmod +x "$bin/pnpm"
  env NVM_DIR="$tmp/no-nvm" MONI_TAILSCALE=/bin/false MONI_DEVICE_SERIAL=127.0.0.1:1 \
    PATH="$bin:/usr/bin:/bin" "$dir/doctor.sh" --toolchain 2>/dev/null
}
mkdir -p "$tmp/wsl-bin"
out=$(toolchain_pnpm "$wintmp")
rc=$?
((rc != 0)) && [[ $out == *"FAIL pnpm $wintmp/pnpm"* ]] && pass "doctor --toolchain fails on a /mnt/c pnpm" || fail "doctor --toolchain on /mnt/c pnpm, rc $rc: $(grep pnpm <<<"$out")"
out=$(toolchain_pnpm "$tmp/wsl-bin")
[[ $out == *"ok   pnpm $tmp/wsl-bin/pnpm"* ]] && pass "doctor --toolchain accepts a WSL pnpm" || fail "doctor --toolchain on WSL pnpm: $(grep pnpm <<<"$out")"

echo "$failures failed"
((failures == 0))
