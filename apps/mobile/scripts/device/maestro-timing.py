#!/usr/bin/env python3
"""Per-command timing for a Maestro run. Prints names and durations only, because commands.json holds the typed e2e password.

usage: maestro-timing.py <run dir> [--flows]
"""
import glob
import json
import os
import sys
from collections import defaultdict


def command_name(entry):
    command = entry.get("command") or {}
    for name, value in command.items():
        if value is not None:
            return name
    return "unknown"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    show_flows = "--flows" in sys.argv
    files = glob.glob(os.path.join(args[0], "**", "commands.json"), recursive=True)
    if not files:
        sys.exit(f"no commands.json under {args[0]}")
    totals = defaultdict(lambda: [0, 0])
    flows = []
    for path in sorted(files):
        with open(path) as handle:
            entries = json.load(handle)
        flow_ms = 0
        for entry in entries:
            name = command_name(entry)
            if name == "runFlowCommand":
                continue
            duration = (entry.get("metadata") or {}).get("duration") or 0
            totals[name][0] += duration
            totals[name][1] += 1
            flow_ms += duration
        flows.append((os.path.basename(os.path.dirname(path)), flow_ms))
    grand = sum(ms for ms, _ in totals.values())
    print(f"{'command':<34}{'total s':>9}{'count':>7}{'avg s':>8}{'share':>8}")
    for name, (ms, count) in sorted(totals.items(), key=lambda item: -item[1][0]):
        print(f"{name:<34}{ms / 1000:>9.1f}{count:>7}{ms / count / 1000:>8.2f}{ms / grand:>8.0%}")
    print(f"{'all':<34}{grand / 1000:>9.1f}")
    if show_flows:
        print()
        for flow, ms in sorted(flows, key=lambda item: -item[1]):
            print(f"{ms / 1000:>8.1f}  {flow}")


if __name__ == "__main__":
    main()
