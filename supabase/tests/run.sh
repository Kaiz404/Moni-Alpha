#!/usr/bin/env bash
# Runs every supabase/tests/*.sql with psql inside the local stack's database container
# (`npx supabase db start`). Each test rolls itself back. Exits non-zero on the first failure.
set -euo pipefail
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
project_id=$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' "$root/supabase/config.toml")
container=supabase_db_$project_id
docker inspect "$container" >/dev/null 2>&1 || { echo "no local database $container: run npx supabase db start" >&2; exit 1; }
for test in "$root"/supabase/tests/*.sql; do
  echo "== ${test#"$root"/}"
  docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q -t -A <"$test"
done
