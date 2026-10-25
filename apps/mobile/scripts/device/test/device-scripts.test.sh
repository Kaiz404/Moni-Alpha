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
[ -z "$FAKE_ADB_LOG" ] || echo "$*" >>"$FAKE_ADB_LOG"
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
      "cat /data/local/tmp/moni-e2e.sha") echo "$FAKE_MARKER" ;;
      "pm path com.anonymous.moni.e2e") echo package:/data/app/moni-e2e/base.apk ;;
    esac
    ;;
esac
ADB
cat >"$tmp/home/.maestro/bin/maestro" <<'MAESTRO'
#!/bin/sh
if [ "$1" != test ]; then
  echo 2.11.0
  echo "A new version of the Maestro CLI is available (2.12.0). Upgrade command: curl -Ls https://get.maestro.mobile.dev | bash"
  exit 0
fi
printf '%s\n' "$@" >"$FAKE_MAESTRO_LOG"
while [ $# -gt 0 ]; do
  case "$1" in
    --output) report=$2 ;;
    --test-output-dir) shots=$2/takeScreenshot ;;
  esac
  shift
done
mkdir -p "$shots"
printf '\211PNG' >"$shots/smoke-home.png"
printf '<testsuites><testsuite><testcase name="a"/><testcase name="b"><failure/></testcase></testsuite></testsuites>\n' >"$report"
exit 1
MAESTRO
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

mkdir -p "$tmp/apks/daily-key"
touch "$tmp/apks/daily-key/app-release.apk"
printf '#!/bin/sh\necho com.anonymous.moni\n' >"$tmp/stub-bin/aapt2"
chmod +x "$tmp/stub-bin/aapt2"
out=$(MONI_APK_CACHE=$tmp/apks MONI_AAPT2=$tmp/stub-bin/aapt2 "$dir/install.sh" daily-key 2>&1)
expect "install.sh exits 3 for an APK whose package is com.anonymous.moni" 3 $?
[[ $out == *"installs only com.anonymous.moni.e2e"* ]] && pass "install.sh names the package it refused" || fail "install.sh refusal: $out"

repo=$tmp/repo
mkdir -p "$repo/apps/mobile/scripts" "$tmp/build-bin"
cp -r "$dir" "$repo/apps/mobile/scripts/device"
echo android/ >"$repo/.gitignore"
git -C "$repo" init -q
git -C "$repo" add -A
git -C "$repo" -c user.name=t -c user.email=t@t commit -qm init
out=$("$repo/apps/mobile/scripts/device/build-apk.sh" 2>&1)
expect "build-apk.sh exits 3 in the main checkout" 3 $?
[[ $out == *"refuses to run in the main checkout"* ]] && pass "build-apk.sh says why it refused" || fail "build-apk.sh main refusal: $out"

git -C "$repo" worktree add -q "$tmp/wt" 2>/dev/null
printf '#!/bin/sh\necho fake-fingerprint\n' >"$tmp/build-bin/node"
printf '#!/bin/sh\ncase "$*" in *prebuild*) mkdir -p android; printf "#!/bin/sh\\nmkdir -p app/build/outputs/apk/release\\necho apk >app/build/outputs/apk/release/app-release.apk\\n" >android/gradlew; chmod +x android/gradlew ;; esac\n' >"$tmp/build-bin/npx"
chmod +x "$tmp/build-bin/"*
build() { env NVM_DIR="$tmp/no-nvm" PATH="$tmp/build-bin:/usr/bin:/bin" MONI_APK_CACHE="$tmp/apk-cache" "$tmp/wt/apps/mobile/scripts/device/build-apk.sh" 2>/dev/null; }
head_sha=$(git -C "$tmp/wt" rev-parse HEAD)
out=$(build)
expect "build-apk.sh in a worktree builds and caches the APK under the SHA" "built $head_sha $tmp/apk-cache/$head_sha/app-release.apk in" "${out% * s}"
start=$(now_ms)
out=$(build)
rc=$?
elapsed=$(($(now_ms) - start))
expect "a second build-apk.sh for the same SHA is a cache hit" "0 cached $head_sha $tmp/apk-cache/$head_sha/app-release.apk" "$rc $out"
((elapsed < 5000)) && pass "the cache hit took ${elapsed} ms" || fail "the cache hit took ${elapsed} ms"
echo "// edit" >>"$tmp/wt/apps/mobile/scripts/device/perf-compare.mjs"
out=$(build)
[[ $out == "built $head_sha-dirty-"* ]] && pass "a dirty tree builds under <sha>-dirty-<hash>" || fail "dirty build: $out"

with_env() { env -u ANDROID_HOME bash -c 'source "$1/env.sh" 2>/dev/null; shift; exec "$@"' _ "$dir" "$@"; }
echo '{"coldStartMs": 1000, "apkBytes": 100}' >"$tmp/base.json"
echo '{"coldStartMs": 1150, "apkBytes": 100}' >"$tmp/head.json"
out=$(with_env node "$dir/perf-compare.mjs" "$tmp/base.json" "$tmp/head.json" --rule coldStartMs=+10% --rule apkBytes=100 2>&1)
expect "perf-compare.mjs exits 1 when a rule fails" 1 $?
expect "perf-compare.mjs prints one line per metric" "coldStartMs base 1000 head 1150 delta +150 (+15.0%) FAIL rule +10%
apkBytes base 100 head 100 delta +0 (+0.0%) ok rule 100" "$out"
with_env node "$dir/perf-compare.mjs" "$tmp/base.json" "$tmp/head.json" --rule coldStartMs=+200 >/dev/null 2>&1
expect "perf-compare.mjs exits 0 when every rule passes" 0 $?

expo_config() {
  (cd "$dir/../.." && with_env npx expo config --type public --json 2>/dev/null) |
    with_env node -e 'const c = JSON.parse(require("fs").readFileSync(0, "utf8")); console.log(c.android.package, c.scheme, c.name, c.extra.appVariant ?? "no-variant")'
}
expect "APP_VARIANT=e2e gives the e2e package, scheme, name, and extra.appVariant" "com.anonymous.moni.e2e moni-e2e Moni E2E e2e" "$(APP_VARIANT=e2e expo_config)"
expect "without APP_VARIANT the config keeps the daily package and scheme, with no appVariant" "com.anonymous.moni moni Moni no-variant" "$(expo_config)"

rf=$dir/run-flows.sh
for bad in "--seed bogus" "--area nosuch" "--tag" "--frobnicate" "no/such/flow.yaml"; do
  # shellcheck disable=SC2086
  out=$("$rf" $bad 2>&1)
  rc=$?
  [[ $rc == 2 && $out == *"usage: run-flows.sh"* ]] && pass "run-flows.sh $bad exits 2 with the usage" || fail "run-flows.sh $bad: rc $rc, $out"
done
[[ $("$rf" --area nosuch 2>&1) == *"areas: "*"smoke"* ]] && pass "run-flows.sh lists the areas" || fail "run-flows.sh area list missing"

setsid "$dir/with-device.sh" --skip-doctor --pr t3 --lane holder -- sleep 5 >/dev/null 2>&1 &
holder=$!
disown
for _ in $(seq 50); do
  grep -q " $holder t3 holder$" "$MONI_DEVICE_STATE_DIR/redmi.owner" 2>/dev/null && break
  sleep 0.1
done
out=$(timeout 1 "$rf" --tag smoke 2>&1)
[[ $out == *"waiting for device lock held by $holder t3 holder"* ]] && pass "run-flows.sh waits for the device lock" || fail "run-flows.sh lock wait: $out"
kill -9 -- "-$holder" 2>/dev/null
holder=""

mkdir -p "$tmp/rf-bin" "$tmp/rf-apks/rf-key"
touch "$tmp/rf-apks/rf-key/app-release.apk"
printf '#!/bin/sh\necho "$@" >>"$FAKE_NODE_LOG"\necho "before {}"\necho "after  {\\"wallets\\":4}"\necho "seeded"\n' >"$tmp/rf-bin/node"
printf '#!/bin/sh\ncase "$2" in packagename) echo com.anonymous.moni.e2e ;; permissions) echo "uses-permission: name='"'"'android.permission.CAMERA'"'"'" ;; esac\n' >"$tmp/rf-bin/aapt2"
chmod +x "$tmp/rf-bin/"*
run_flows() {
  stubbed env PATH="$tmp/rf-bin:$tmp/stub-bin:/usr/bin:/bin" MONI_APK_CACHE="$tmp/rf-apks" MONI_AAPT2="$tmp/rf-bin/aapt2" \
    MONI_RUNS_DIR="$tmp/runs" FAKE_MARKER=rf-key FAKE_ADB_LOG="$tmp/rf-adb.log" FAKE_NODE_LOG="$tmp/rf-node.log" \
    FAKE_MAESTRO_LOG="$tmp/rf-maestro.log" E2E_EMAIL=e2e+test@example.com E2E_PASSWORD=pw-123 "$rf" "$@"
}
out=$(run_flows --sha rf-key --tag smoke --out "$tmp/rf-out" 2>/dev/null)
expect "run-flows.sh exits with Maestro's code" 1 $?
[[ $out == "1/2 flows passed, report $tmp/runs/rf-key/"*"/report.xml" ]] && pass "run-flows.sh prints the passed count from report.xml" || fail "run-flows.sh summary: $out"
maestro_args=$(tr '\n' ' ' <"$tmp/rf-maestro.log")
[[ $maestro_args == "test --device 100.64.0.9:40000 --include-tags smoke --exclude-tags seed-empty,needs-speech,needs-posted-alert,needs-ai,perf --format junit --output $tmp/runs/rf-key/"*"/report.xml"* ]] && pass "run-flows.sh runs one Maestro suite with the smoke tag and the full seed's exclusions" || fail "maestro args: $maestro_args"
[[ $maestro_args == *"-e E2E_EMAIL=e2e+test@example.com -e E2E_PASSWORD=pw-123 $(cd "$dir/../.." && pwd)/.maestro "* ]] && pass "run-flows.sh passes the e2e credentials and the workspace" || fail "maestro env args: $maestro_args"
expect "run-flows.sh resets the seed it was given" "$(cd "$dir/../.." && pwd)/scripts/e2e/seed.mjs --reset --profile full" "$(cat "$tmp/rf-node.log")"
[[ $(grep -c "^shell pm clear com.anonymous.moni.e2e$" "$tmp/rf-adb.log") == 1 && $(grep -c "^shell pm grant com.anonymous.moni.e2e android.permission.CAMERA$" "$tmp/rf-adb.log") == 2 ]] && pass "run-flows.sh clears the app's data and grants permissions again" || fail "adb calls: $(tr '\n' ';' <"$tmp/rf-adb.log")"
grep -q "^install " "$tmp/rf-adb.log" && fail "run-flows.sh reinstalled an APK the phone already has" || pass "run-flows.sh skips the install when the phone has the key"
[[ -f $tmp/rf-out/smoke-home.png ]] && pass "run-flows.sh copies screenshots to --out" || fail "no screenshot in --out: $(ls "$tmp/rf-out" 2>&1)"
run_flows --sha rf-key --seed empty --tag needs-ai --area home >/dev/null 2>&1
maestro_args=$(tr '\n' ' ' <"$tmp/rf-maestro.log")
[[ $maestro_args == *"--include-tags needs-ai --exclude-tags seed-full,needs-speech,needs-posted-alert,perf "*" $(cd "$dir/../.." && pwd)/.maestro/flows/home "* ]] && pass "--seed empty excludes seed-full, a --tag lifts its default exclusion, and --area picks one folder" || fail "empty seed maestro args: $maestro_args"

echo "$failures failed"
((failures == 0))
