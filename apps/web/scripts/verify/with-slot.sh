#!/usr/bin/env bash
# Runs a web-verify on the first free slot. Each slot reseeds its own e2e user (slot 0 is E2E_WEB_EMAIL,
# slot n is its -slot<n> twin), so up to MONI_WEB_VERIFY_SLOTS runs go at once without sharing rows.
set -uo pipefail
slots=${MONI_WEB_VERIFY_SLOTS:-3}
# Chromium writes screenshots through /tmp, a RAM disk under WSL; nearly full, it crashes mid-run.
tmp_free_mb=$(df -Pm /tmp | awk 'NR == 2 { print $4 }')
if ((tmp_free_mb < 1024)); then
  echo "web-verify FAIL: /tmp has ${tmp_free_mb} MB free; Chromium needs room there. See what fills it: du -sh /tmp/* | sort -h" >&2
  exit 1
fi
dir=${XDG_RUNTIME_DIR:-/tmp}
announced=false
while :; do
  for ((n = 0; n < slots; n++)); do
    lock=$dir/moni-web-verify.lock
    ((n == 0)) || lock=$dir/moni-web-verify-$n.lock
    exec {fd}>"$lock"
    if flock -n "$fd"; then
      echo "web-verify slot $n"
      MONI_WEB_SLOT=$n "$@"
      exit $?
    fi
    exec {fd}>&-
  done
  $announced || echo "web-verify: all $slots slots busy, waiting"
  announced=true
  sleep 10
done
