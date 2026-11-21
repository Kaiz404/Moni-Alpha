---
name: moni-issues
description: File and work through Moni's issue list, which is GitHub Issues on Kaiz404/Moni-Alpha. Use when the owner reports a problem or idea from daily use ("issue:", "bug:", "log this", "note that X is broken"), asks what is open, or asks to churn, fix, or work through issues.
---

# Moni issues

The owner uses the daily **Moni** app (`com.anonymous.moni`, a preview build) every day and reports what goes wrong. Each report becomes a GitHub issue on `Kaiz404/Moni-Alpha`. Later the owner sits down and asks an agent to churn through them.

This directory is a real directory in `.claude/skills/`, and `.cursor/skills/moni-issues` links to it. Edit it here.

## Labels

Every issue gets one type and one priority.

| Type | Use for |
| --- | --- |
| `bug` | Broken, wrong, crashed, or lost data |
| `polish` | Works, but looks or feels off |
| `enhancement` | Something new |

| Priority | Meaning |
| --- | --- |
| `p1` | Breaks daily use or loses data. Fix next. |
| `p2` | Annoying in daily use. Fix soon. |
| `p3` | Minor or cosmetic. |

Add `needs-info` when an agent cannot act on the issue yet. Ask the owner the one missing thing in an issue comment and in the reply.

## File an issue

1. Read the owner's words. One message can hold several issues. File each one separately.
2. Look for a duplicate first: `gh issue list --state open --search "<two or three key words>"`. If one matches, comment on it with the new detail instead of filing a new one, and say so.
3. Pick the type and priority from the tables. When unsure, use `p2`.
4. File it:

   ```bash
   gh issue create --title "<Screen>: <what is wrong, in the owner's terms>" --label bug,p2 --body-file <file>
   ```

   Body sections, and leave out any the owner gave nothing for:

   ```markdown
   **What happened**
   **Expected**
   **Where** Screen or route, e.g. Home, Say it check page, `/budget/[categoryId]`
   **Steps**
   **Build** Moni (daily) <sha> | Moni E2E (dev)
   **Notes** Suspected files, related issues, owner quotes
   **Also on** The web screen (`apps/web`, `docs/WEB.md` board) and the canvas boards for the same feature, or "phone only"
   ```

   The **Also on** line is required for any UI or flow issue (rule: `.cursor/rules/project-overview.mdc`, "Keep the phone, the web and the canvas in step"). A fix covers every place it lists, or files a linked issue for what it leaves.

   For a `polish` issue, or a design point inside a bug, name the rule it breaks from `.claude/skills/moni-taste/SKILL.md` under **Notes** ("rule 2, a sheet is a title and one short line") and quote the owner's words. If the owner's point is new or sharper than the guide, add or edit the rule there and say so in the reply. If a parser could catch it, add it to `apps/mobile/scripts/lint/check-taste.mjs` or `copy-rules.mjs` (and `lint_terms.py` on the canvas side), proved on a real past violation.

5. For **Build**, read the daily app's installed build when adb is up: `apps/mobile/scripts/device/with-device.sh --skip-doctor -- adb shell cat /data/local/tmp/moni-preview.sha`. Write `unknown` when it fails. Do not spend more than that on it.
6. Reply with each issue's number, title, and link, one line each.

Rules:

- The repo is public. Do not write real balances, account numbers, people's names, or merchant names from the owner's own data unless the owner says to. Paraphrase: "a debt with a friend", "a Maybank alert for a grocery shop".
- When the owner sends a screenshot, embed it. `gh` cannot upload images, so commit the image to the `issue-assets` branch as `issues/<n>-<slug>.png` with git plumbing (no checkout), push, and add `![<what it shows>](https://raw.githubusercontent.com/Kaiz404/Moni-Alpha/issue-assets/issues/<n>-<slug>.png)` under a **Screenshot** heading with `gh issue edit`. Also describe what it shows in words. Attach every screenshot the owner sends, real balances and names included (owner, 20 and 21 Nov 2026). Third-party images, such as Mobbin screens, are the exception: describe them and link them instead.

  ```bash
  set -e
  git fetch -q origin issue-assets
  base=$(git rev-parse --verify origin/issue-assets^{commit})
  export GIT_INDEX_FILE=$(mktemp -u); git read-tree "$base"
  git update-index --add --cacheinfo 100644,$(git hash-object -w <image>),issues/<n>-<slug>.png
  commit=$(git commit-tree "$(git write-tree)" -p "$base" -m "Screenshot for #<n>"); unset GIT_INDEX_FILE
  [ -n "$commit" ] && git push origin "$commit:refs/heads/issue-assets"
  ```

  Never push an empty commit variable: `git push origin :refs/heads/issue-assets` deletes the branch and breaks every embedded image. That happened on 21 Nov 2026 when the temp index directory had been cleared. If it happens again, push the branch's last commit back (`.git/FETCH_HEAD` holds it after the fetch).
- File what the owner said. Do not investigate or fix while filing unless asked. Filing should take a minute.
- Do not file an issue for something already fixed on `main` but not yet on the phone. Check `git log --oneline -20` for it, and tell the owner to update the daily app instead.

## Churn

When the owner asks to work through issues:

1. List open work, highest priority first:

   ```bash
   gh issue list --state open --label p1 --limit 50
   gh issue list --state open --label p2 --limit 50
   gh issue list --state open --label p3 --limit 50
   gh issue list --state open --search "-label:p1 -label:p2 -label:p3"   # untriaged
   ```

   Give untriaged issues a type and priority first. Skip `needs-info` issues.

2. Take issues in that order unless the owner named some. For several independent issues, run one subagent per issue, each in its own git worktree, as in the redesign workflow.
3. For each issue, `gh issue view <n> --comments`, then fix it the repo's usual way: read the matching `.cursor/rules/` and docs, find the root cause, and keep the change to that issue. Prove it on Moni E2E with the `moni-device` skill when the fix changes what the phone shows. For a `bug`, add a test that fails without the fix when there is a cheap test target.
4. Commit straight to `main`, one commit per issue, with `Fixes #<n>` on its own line in the message body. GitHub closes the issue when `main` is pushed.
5. If you cannot fix it, comment on the issue with what you found, add `needs-info` when you need the owner, and move on.
6. Report at the end: fixed (number, title, commit), skipped and why, and what needs the owner.

## Ship fixes to the daily app

The fixes reach the phone only when the owner installs a new preview build. Do this only when the owner asks. From a git worktree, not the main checkout:

```bash
apps/mobile/scripts/device/build-apk.sh --preview          # prints: built <key> <apk> in <n> s
apps/mobile/scripts/device/with-device.sh -- apps/mobile/scripts/device/install.sh --preview <key>
```

`install.sh --preview` installs over the daily app and keeps its data. If it fails, report the error. Never uninstall or clear `com.anonymous.moni`.
