#!/usr/bin/env bash
# Puts the adb and maestro guards in ~/.local/bin, which is first on PATH, so a bare call from any
# agent shell goes through the device lock. Rerunnable.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$HOME/.local/bin"
for tool in adb maestro; do
  install -m 755 "$here/guard/$tool" "$HOME/.local/bin/$tool"
done
for tool in adb maestro; do
  [[ $(command -v "$tool") == "$HOME/.local/bin/$tool" ]] || echo "warning: $tool resolves to $(command -v "$tool"), put ~/.local/bin first on PATH" >&2
done
echo "guards installed in $HOME/.local/bin"
