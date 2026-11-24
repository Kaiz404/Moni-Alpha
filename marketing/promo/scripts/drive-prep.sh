#!/usr/bin/env bash
# usage: scripts/drive-prep.sh <video.mp4>...
# Prints one Google Drive connector file reference per video: sha256:<hex>:<absolute path> <bytes>.
# The connector refuses payloads over 10 MB after base64, so a video over 7 MB is re-encoded (2-pass x264) to about 6.6 MB into out/drive/ first.
set -euo pipefail
ffmpeg=~/.local/opt/ffmpeg-static/bin/ffmpeg
ffprobe=~/.local/opt/ffmpeg-static/bin/ffprobe
out=$(cd "$(dirname "$0")/.." && pwd)/out/drive
mkdir -p "$out"
for f in "$@"; do
  f=$(realpath "$f")
  if [ "$(stat -c %s "$f")" -gt 7000000 ]; then
    dur=$("$ffprobe" -v error -show_entries format=duration -of csv=p=0 "$f")
    kbps=$(python3 -c "print(int(6.6e6*8/1000/$dur))")
    small="$out/$(basename "$(dirname "$f")")-$(basename "$f")"
    (cd "$out" \
      && "$ffmpeg" -loglevel error -y -i "$f" -c:v libx264 -preset slow -b:v "${kbps}k" -pass 1 -an -f mp4 /dev/null \
      && "$ffmpeg" -loglevel error -y -i "$f" -c:v libx264 -preset slow -b:v "${kbps}k" -pass 2 -pix_fmt yuv420p -movflags +faststart -an "$small")
    f=$small
  fi
  echo "sha256:$(sha256sum "$f" | cut -d' ' -f1):$f $(stat -c %s "$f")"
done
