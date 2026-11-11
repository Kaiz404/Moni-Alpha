#!/usr/bin/env bash
# Metro for the e2e dev build (build-apk.sh --dev), reached over Tailscale, with the real AI backend.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
source "$here/env.sh"
root=$(git -C "$here" rev-parse --show-toplevel)
main_checkout=$(git -C "$root" worktree list --porcelain | sed -n '1s/^worktree //p')
source "$here/app-env.sh" "$root/apps/mobile" "$main_checkout" --real-ai
cd "$root/apps/mobile"
exec pnpm run dev:tailscale "$@"
