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

mkdir -p "$tmp/fake-sdk/platform-tools" "$tmp/stub-bin" "$tmp/home/.maestro/bin"
cat >"$tmp/fake-sdk/platform-tools/adb" <<'ADB'
#!/bin/sh
[ "$1" = -s ] && serial=$2 && shift 2
case "$1" in
  version) printf 'Android Debug Bridge version 1.0.41\nVersion 37.0.0-14910828\n' ;;
  start-server) [ -z "$FAKE_SERVER_PID" ] || { sleep 30 >/dev/null 2>&1 & echo $! >>"$FAKE_SERVER_PID"; } ;;
  get-state) case " $FAKE_DEVICES " in *" $serial "*) echo device ;; *) exit 1 ;; esac ;;
  exec-out) cat "$FAKE_SCREENCAP" ;;
  shell)
    shift
    case "$*" in
      "dumpsys battery") echo "  level: 88" ;;
      "dumpsys window policy") echo "    showing=false" ;;
      "getprop ro.build.version.release") echo 16 ;;
      "getprop ro.mi.os.version.name") echo OS3.0 ;;
    esac
    ;;
esac
ADB
printf '#!/bin/sh\necho 2.11.0\necho "A new version of the Maestro CLI is available (2.12.0). Upgrade command: curl -Ls https://get.maestro.mobile.dev | bash"\n' >"$tmp/home/.maestro/bin/maestro"
printf '#!/bin/sh\necho "Picked up JAVA_TOOL_OPTIONS: -Dfile.encoding=UTF-8" >&2\necho "openjdk version \\"17.0.12\\" 2024-07-16" >&2\n' >"$tmp/stub-bin/java"
printf '#!/bin/sh\n[ "$1" = status ] && echo "100.64.0.9  redmi-note-13-pro-5g  owner@  android  -"\nexit 0\n' >"$tmp/stub-bin/tailscale.exe"
printf '#!/bin/sh\necho "  Proto  Local Address  Foreign Address  State  PID"\n[ -z "$FAKE_WINDOWS_ADB" ] || echo "  TCP    127.0.0.1:5037         0.0.0.0:0              LISTENING       $FAKE_WINDOWS_ADB"\n' >"$tmp/stub-bin/netstat.exe"
chmod +x "$tmp/fake-sdk/platform-tools/adb" "$tmp/home/.maestro/bin/maestro" "$tmp/stub-bin/"*
export ANDROID_HOME=$tmp/fake-sdk
stubbed() {
  env HOME="$tmp/home" NVM_DIR="$tmp/no-nvm" PATH="$tmp/stub-bin:/usr/bin:/bin" \
    MONI_TAILSCALE="$tmp/stub-bin/tailscale.exe" MONI_NETSTAT="$tmp/stub-bin/netstat.exe" \
    MONI_DEVICE_SERIAL=100.64.0.9:40000 FAKE_DEVICES=100.64.0.9:40000 "$@"
}

printf '\211PNG\r\n\032\nrest' >"$tmp/screen.png"
echo "error: closed" >"$tmp/screen.bad"
FAKE_DEVICES=100.64.0.3:41000 NVM_DIR=$tmp/no-nvm "$dir/connect.sh" 100.64.0.3:41000 >/dev/null 2>&1
expect "connect.sh <host:port> exits 0 when adb reports device, even with no node 22" 0 $?
expect "connect.sh remembers the serial it reached" 100.64.0.3:41000 "$(resolve_serial)"

out=$("$dir/connect.sh" 127.0.0.1:1 2>&1)
expect "connect.sh exits 3 for an unreachable serial" 3 $?
[[ $out == *"adb down, run taildrop.sh or ask the operator for O2"* ]] && pass "connect.sh prints the fallback" || fail "connect.sh fallback message missing: $out"
expect "a failed connect.sh keeps the last good serial" 100.64.0.3:41000 "$(resolve_serial)"

expect "an exported bare host gets port 5555" 100.64.0.5:5555 "$(MONI_DEVICE_SERIAL=100.64.0.5 resolve_serial)"
FAKE_DEVICES=100.64.0.4:5555 "$dir/connect.sh" 100.64.0.4 >/dev/null 2>&1
expect "connect.sh <host> connects to port 5555" 100.64.0.4:5555 "$(resolve_serial)"
FAKE_DEVICES=100.64.0.3:41000 "$dir/connect.sh" 100.64.0.3:41000 >/dev/null 2>&1

out=$(stubbed "$dir/doctor.sh" 2>/dev/null)
expect "doctor.sh exits 0 when every check passes" 0 $?
expect "doctor.sh ends with the OK line despite a Maestro update notice and JAVA_TOOL_OPTIONS" "OK device 100.64.0.9:40000 android 16 hyperos OS3.0" "$(tail -n 1 <<<"$out")"
out=$(stubbed FAKE_WINDOWS_ADB=4242 "$dir/doctor.sh" 2>/dev/null)
expect "doctor.sh exits 1 when Windows adb holds port 5037" 1 $?
[[ $out == *"FAIL port-5037 held by Windows pid 4242"* && $out == *"FAIL device not checked while Windows adb holds port 5037"* ]] && pass "doctor.sh names the port 5037 conflict" || fail "port 5037 output: $out"

setsid "$dir/with-device.sh" --skip-doctor --pr t1 --lane holder -- bash -c "sleep 3; date +%s%N >$tmp/orphan.end" >/dev/null 2>&1 &
holder=$!
disown
for _ in $(seq 50); do
  grep -q " $holder t1 holder$" "$MONI_DEVICE_STATE_DIR/redmi.owner" 2>/dev/null && break
  sleep 0.1
done
waiting=$(timeout 1 "$dir/with-device.sh" --skip-doctor -- true 2>&1)
[[ $waiting == *"waiting for device lock held by $holder t1 holder"* ]] && pass "a second caller names the holder" || fail "waiting message: $waiting"
kill -9 "$holder"
out=$(timeout 10 "$dir/with-device.sh" --skip-doctor --lane after-kill -- bash -c "date +%s%N >$tmp/second.start; [[ -e $tmp/orphan.end ]] && echo after-orphan || echo overlap" 2>/dev/null)
expect "after kill -9 the next holder waits for the orphaned lane command" after-orphan "$out"
gap=$((($(cat "$tmp/second.start") - $(cat "$tmp/orphan.end" 2>/dev/null || echo 0)) / 1000000))
((gap >= 0 && gap < 2000)) && pass "the next holder starts ${gap} ms after the orphan exits" || fail "next holder started ${gap} ms after the orphan exited"

"$dir/with-device.sh" --skip-doctor --lane term -- bash -c "echo \$\$ >$tmp/term.pid; exec sleep 30" >/dev/null 2>&1 &
wrapper=$!
for _ in $(seq 50); do
  [[ -s $tmp/term.pid ]] && break
  sleep 0.1
done
kill -TERM "$wrapper"
wait "$wrapper" 2>/dev/null
expect "with-device.sh exits 143 on SIGTERM" 143 $?
kill -0 "$(cat "$tmp/term.pid")" 2>/dev/null && fail "SIGTERM left the lane command running" || pass "SIGTERM stops the lane command"
timeout 2 "$dir/with-device.sh" --skip-doctor -- true 2>/dev/null
expect "the lock is free after SIGTERM" 0 $?

"$dir/with-device.sh" --skip-doctor --lane stubborn -- bash -c "trap '' TERM; echo \$\$ >$tmp/stubborn.pid; sleep 30" >/dev/null 2>&1 &
wrapper=$!
for _ in $(seq 50); do
  [[ -s $tmp/stubborn.pid ]] && break
  sleep 0.1
done
start=$(now_ms)
kill -TERM "$wrapper"
wait "$wrapper" 2>/dev/null
elapsed=$(($(now_ms) - start))
kill -0 "$(cat "$tmp/stubborn.pid")" 2>/dev/null && fail "a lane command that ignores TERM survived" || pass "a lane command that ignores TERM is killed"
((elapsed >= 9000 && elapsed < 13000)) && pass "KILL follows TERM after the grace period, ${elapsed} ms" || fail "KILL came ${elapsed} ms after TERM"

"$dir/with-device.sh" --skip-doctor --lane leftover -- bash -c "sleep 2 >/dev/null 2>&1 & echo \$! >$tmp/leftover.pid" >/dev/null 2>&1
out=$(timeout 10 "$dir/with-device.sh" --skip-doctor -- bash -c "kill -0 \$(cat $tmp/leftover.pid) 2>/dev/null && echo overlap || echo clean" 2>/dev/null)
expect "a process the lane leaves behind keeps the lock until it exits" clean "$out"

FAKE_SERVER_PID=$tmp/server.pid "$dir/with-device.sh" --skip-doctor -- adb start-server >/dev/null 2>&1
timeout 2 "$dir/with-device.sh" --skip-doctor -- true 2>/dev/null
expect "an adb server started before or inside the lane does not keep the lock" 0 $?
expect "with-device.sh and the lane each started a server" 2 "$(wc -l <"$tmp/server.pid")"
xargs kill <"$tmp/server.pid" 2>/dev/null

expect "the lane command reads the caller's stdin" piped "$(echo piped | "$dir/with-device.sh" --skip-doctor -- cat 2>/dev/null)"
expect "with-device.sh runs with stdin closed" ran "$("$dir/with-device.sh" --skip-doctor -- echo ran 2>/dev/null <&-)"
expect "the lane command sees ANDROID_SERIAL" 100.64.0.3:41000 "$("$dir/with-device.sh" --skip-doctor -- bash -c 'echo "$ANDROID_SERIAL"' 2>/dev/null)"

seq 250 >"$MONI_DEVICE_STATE_DIR/redmi.owner"
"$dir/with-device.sh" --skip-doctor --pr t2 --lane bounded -- true 2>/dev/null
expect "redmi.owner keeps the last 200 holders" 200 "$(wc -l <"$MONI_DEVICE_STATE_DIR/redmi.owner")"
expect "redmi.owner ends with the newest holder" "t2 bounded" "$(tail -n 1 "$MONI_DEVICE_STATE_DIR/redmi.owner" | cut -d' ' -f3-)"

FAKE_SCREENCAP=$tmp/screen.png "$dir/screenshot.sh" "$tmp/shots/ok.png" >/dev/null 2>&1
expect "screenshot.sh saves the PNG adb returns" "$(cat "$tmp/screen.png")" "$(cat "$tmp/shots/ok.png" 2>/dev/null)"
FAKE_SCREENCAP=$tmp/screen.bad "$dir/screenshot.sh" "$tmp/shots/bad.png" >/dev/null 2>&1
expect "screenshot.sh exits 1 when adb returns no PNG" 1 $?
expect "screenshot.sh leaves no file for a failed capture" "" "$(ls "$tmp/shots" | grep bad)"

expect "a nested with-device.sh runs inside the outer lock" inner-ran "$(timeout 5 "$dir/with-device.sh" --skip-doctor --lane outer -- "$dir/with-device.sh" --skip-doctor --lane inner -- echo inner-ran 2>/dev/null)"

out=$(stubbed FAKE_WINDOWS_ADB=4242 "$dir/with-device.sh" --lane doctor-fails -- echo lane-ran 2>&1)
expect "with-device.sh exits 6 when doctor.sh fails" 6 $?
[[ $out == *"FAIL port-5037 held by Windows pid 4242"* && $out != *lane-ran* ]] && pass "with-device.sh shows the failing check and skips the command" || fail "doctor failure output: $out"
expect "with-device.sh runs the command when doctor.sh passes" lane-ran "$(stubbed "$dir/with-device.sh" --lane doctor-passes -- echo lane-ran 2>/dev/null)"

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
