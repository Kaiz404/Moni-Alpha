#!/usr/bin/env bash
# The static gate every change to this repo passes before it lands: types, lint and tests for every
# workspace, the mobile custom lints, Go vet, and a production web build. Prints one PASS or FAIL
# line per check and exits non-zero if any failed. --fast skips the web build and the test suites.
set -uo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$root"
[[ -d $HOME/.nvm/versions/node/v22.23.3/bin ]] && export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"
fast=false
[[ ${1:-} == --fast ]] && fast=true
logs=$(mktemp -d)
failed=()

check() {
  local name=$1
  shift
  if "$@" >"$logs/$name.log" 2>&1; then
    echo "PASS $name"
  else
    echo "FAIL $name (log: $logs/$name.log)"
    tail -n 30 "$logs/$name.log" | sed 's/^/    /'
    failed+=("$name")
  fi
}

check check-types pnpm turbo check-types --output-logs=errors-only
check lint pnpm turbo lint --output-logs=errors-only
for l in lint:tokens lint:copy lint:test-ids lint:flow-ids lint:unreferenced; do
  check "moni-$l" pnpm --filter moni "$l"
done
check go-vet bash -c 'cd apps/backend && go vet ./...'
if ! $fast; then
  check test pnpm turbo test --output-logs=errors-only
  check verify-scripts node --test 'scripts/verify/**/*.test.mjs'
  check web-build pnpm --filter web build
fi

if ((${#failed[@]})); then
  echo "gate FAILED: ${failed[*]}"
  exit 1
fi
echo "gate passed"
