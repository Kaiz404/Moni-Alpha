#!/usr/bin/env python3
"""Resolve a conflicted prose file by merging word by word instead of line by line.

Docs like docs/WEB.md keep a whole status paragraph on one line, so two branches that edit
different sentences of it conflict. This merges base, ours and theirs with git's own 3-way
merge after putting one word per line, then joins the words back. Only edits that touch the
same words stay conflicted (exit 1), marked in the file around just those words.

  word-merge.py <path>              during a cherry-pick, merge, or rebase with <path> conflicted
"""
import re
import subprocess
import sys
import tempfile

NL = "⁣NL⁣"


def stage(n: int, path: str) -> str:
    return subprocess.run(["git", "show", f":{n}:{path}"], capture_output=True, text=True, check=True).stdout


def words(text: str) -> str:
    text = text.replace("\n", f" {NL} ")
    return "\n".join(t for t in re.split(r"(\s+)", text) if t) + "\n"


def unwords(text: str) -> str:
    out = []
    for line in text.split("\n"):
        if line.startswith(("<<<<<<<", "=======", ">>>>>>>")):
            out.append(f"\n{line}\n")
        else:
            out.append(line)
    return "".join(out).replace(f" {NL} ", "\n").replace(NL, "\n")


def main(path: str) -> int:
    base, ours, theirs = (stage(n, path) for n in (1, 2, 3))
    with tempfile.TemporaryDirectory() as tmp:
        files = []
        for name, text in (("ours", ours), ("base", base), ("theirs", theirs)):
            f = f"{tmp}/{name}"
            open(f, "w").write(words(text))
            files.append(f)
        merged = subprocess.run(["git", "merge-file", "-p", *files], capture_output=True, text=True)
    if merged.returncode < 0 or merged.returncode > 127:
        print(merged.stderr, file=sys.stderr)
        return 2
    open(path, "w").write(unwords(merged.stdout))
    if merged.returncode > 0:
        print(f"{path}: {merged.returncode} conflict(s) remain on the same words, marked in the file", file=sys.stderr)
        return 1
    print(f"{path}: merged word by word")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
