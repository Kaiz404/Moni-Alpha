#!/usr/bin/env python3
"""Trims a raw take to its motion, writes the clip, its contact sheet and its manifest entry.

usage: finish-take.py <feature> <raw.mp4> <maestro debug dir> <record start epoch ms> <take.yaml>

screenrecord writes a frame only when the screen changes, so the changed frames mark the action.
Maestro over Device Connect leaves several still seconds after each step, so every still stretch longer
than MAX_STILL is cut down to KEEP_STILL, and the clip keeps LEAD seconds before the first change and
TAIL after the last. Beats are the take's commands that carry a Maestro `label`, timed from the debug
output, matched to the first burst of change after each step begins, and mapped through the cuts.
"""
import glob
import json
import os
import re
import subprocess
import sys

LEAD, TAIL, FPS = 1.0, 1.5, 60
MAX_STILL, KEEP_STILL = 1.6, 1.2
DEVICE = "Google Pixel 8, Android 14 (AWS Device Farm)"


def ffmpeg(*args, capture=False):
    return subprocess.run(["ffmpeg", "-hide_banner", "-y", *args], check=True, text=True,
                          stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                          stderr=subprocess.PIPE)


def changed_frames(raw):
    out = ffmpeg("-i", raw, "-vf", "select='gt(scene,0.0008)',showinfo", "-f", "null", "-", capture=True)
    return [float(m) for m in re.findall(r"pts_time:([0-9.]+)", out.stderr)]


def probe_duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         check=True, text=True, capture_output=True)
    return float(out.stdout.strip())


def labelled_commands(debug_dir):
    beats = []
    for path in sorted(glob.glob(os.path.join(debug_dir, "**", "commands*.json"), recursive=True)):
        with open(path) as handle:
            entries = json.load(handle)
        for entry in entries:
            command = entry.get("command") or {}
            body = next((v for v in command.values() if isinstance(v, dict)), {})
            label = body.get("label")
            meta = entry.get("metadata") or {}
            if label and meta.get("timestamp"):
                start = meta["timestamp"] / 1000
                beats.append((start, start + (meta.get("duration") or 0) / 1000, label))
    return sorted(beats)


def header(take, key):
    with open(take) as handle:
        match = re.search(rf"^# {key}: (.+)$", handle.read(), re.M)
    return match.group(1).strip() if match else ""


def main():
    if len(sys.argv) != 6:
        sys.exit(__doc__)
    feature, raw, debug_dir, rec_ms, take = sys.argv[1:]
    rec = int(rec_ms) / 1000
    promo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    clips = os.path.join(promo, "clips")
    os.makedirs(os.path.join(clips, "contact"), exist_ok=True)

    commands = labelled_commands(debug_dir)
    first = commands[0][0] - rec - 1.0 if commands else 0.05
    changes = [t for t in changed_frames(raw) if t > first]
    if not changes:
        sys.exit("no screen change in the raw take")
    segments = [[max(0.0, changes[0] - LEAD), None]]
    for before, after in zip(changes, changes[1:]):
        if after - before > MAX_STILL:
            segments[-1][1] = before + KEEP_STILL
            segments.append([after - 0.05, None])
    segments[-1][1] = changes[-1] + TAIL

    def to_clip(t):
        elapsed = 0.0
        for a, b in segments:
            if t < a:
                return max(0.0, elapsed - KEEP_STILL / 2)
            if t <= b:
                return elapsed + t - a
            elapsed += b - a
        return elapsed - 0.3

    out = os.path.join(clips, f"{feature}.mp4")
    n = len(segments)
    graph = f"[0:v]fps={FPS},tpad=stop_mode=clone:stop_duration={TAIL + 1},split={n}" + "".join(f"[s{i}]" for i in range(n))
    for i, (a, b) in enumerate(segments):
        graph += f";[s{i}]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS[v{i}]"
    graph += ";" + "".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[out]"
    ffmpeg("-i", raw, "-filter_complex", graph, "-map", "[out]",
           "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", "-an", out)
    duration = round(probe_duration(out), 2)

    bursts = [[changes[0], changes[0]]]
    for t in changes[1:]:
        if t - bursts[-1][1] > 0.3:
            bursts.append([t, t])
        bursts[-1][1] = t
    beats = []
    for begun, _, label in commands:
        # A step's change is the first burst after it begins; the beat is the settled frame after it.
        burst = next((b for b in bursts if b[0] >= begun - rec - 1.0), bursts[-1])
        t = round(to_clip(burst[1] + 0.3), 2)
        beats.append({"t": max(0.0, min(t, duration)), "what": label})

    picks = [b["t"] for b in beats] or [duration * f for f in (0.1, 0.4, 0.7)]
    if len(picks) > 3:
        step = (len(picks) - 1) / 2
        picks = [picks[round(i * step)] for i in range(3)]
    picks = sorted(set([*picks, max(0.0, duration - 0.3)]))[:4]
    inputs, chains = [], []
    for i, t in enumerate(picks):
        inputs += ["-ss", f"{t:.2f}", "-i", out]
        chains.append(f"[{i}:v]scale=360:-2,pad=iw+12:ih:6:0:white[f{i}]")
    graph = ";".join(chains) + ";" + "".join(f"[f{i}]" for i in range(len(picks))) + f"hstack=inputs={len(picks)}"
    ffmpeg(*inputs, "-filter_complex", graph, "-frames:v", "1", os.path.join(clips, "contact", f"{feature}.png"))

    manifest_path = os.path.join(clips, "manifest.json")
    manifest = []
    if os.path.exists(manifest_path):
        with open(manifest_path) as handle:
            manifest = json.load(handle)
    manifest = [m for m in manifest if m["feature"] != feature]
    manifest.append({
        "feature": feature,
        "order": int(header(take, "order") or 99),
        "file": f"{feature}.mp4",
        "durationSec": duration,
        "device": DEVICE,
        "takeFlow": os.path.relpath(take, os.path.dirname(os.path.dirname(promo))),
        "oneLineDescription": header(take, "promo"),
        "contactFrames": [round(t, 2) for t in picks],
        "beats": beats,
    })
    manifest.sort(key=lambda m: m["order"])
    with open(manifest_path, "w") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")
    print(f"{feature}: {duration}s, {len(beats)} beats, {n} segments kept of {probe_duration(raw):.1f}s raw")


if __name__ == "__main__":
    main()
