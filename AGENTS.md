# Codex Project Instructions

This repository uses Cursor rules as the canonical agent guidance source. Do not duplicate those rules here; read them from `.cursor/rules/` so Cursor and Codex stay in sync.

## Cursor Rule Loading

Before starting work, read every `.cursor/rules/*.mdc` file whose frontmatter has `alwaysApply: true`.

Before editing, reviewing, or reasoning deeply about files that match a rule's `globs` frontmatter, read that matching `.cursor/rules/*.mdc` file too. Treat comma-separated globs as separate patterns.

If a task spans multiple areas, load every matching rule before making changes. If a `.cursor/rules/` file changes, follow the updated rule immediately.

Current rule map:

- Always apply: `.cursor/rules/project-overview.mdc`, `.cursor/rules/docs-maintenance.mdc`
- `apps/backend/**`: `.cursor/rules/backend-go.mdc`
- `apps/web/**`: `.cursor/rules/web-nextjs.mdc`
- `apps/mobile/**`: `.cursor/rules/mobile-expo.mdc`
- `apps/mobile/lib/notifications/**`, `apps/mobile/index.js`, `apps/mobile/scripts/*notification*`: `.cursor/rules/mobile-headless-js.mdc`
- `packages/types/**`: `.cursor/rules/shared-types.mdc`

When in doubt, prefer reading the relevant Cursor rule over guessing from memory.

## pstack skills

A core subset of [pstack](https://github.com/cursor/plugins/tree/main/pstack) (v0.15.13, commit `77526ff`, MIT) is vendored in `.cursor/skills/` (`poteto-mode`, `how`, `why`, `architect`, `tdd`, `unslop`, `no-comments`, `technical-writing`, `typescript-best-practices`, `create-verification-skill`, `show-me-your-work`, `arena`, `swarm`, `interrogate`, `principle-*`). `.claude/skills/` symlinks to the same directories; `.cursor/agents/` and `.claude/agents/` hold the `poteto-agent` and Comment Sicko subagents. To update, re-copy from upstream rather than editing in place.

pstack is written for Cursor. Outside Cursor, translate:

- `Task` subagent → your agent/subagent tool; `generalPurpose` → `general-purpose`, `explore` → `Explore`, `"Comment Sicko"` → `comment-sicko`.
- `AskQuestion` → your structured question tool (e.g. `AskUserQuestion`).
- Model slugs and `~/.cursor/rules/pstack-models.mdc` → treat every role as `inherit-parent` (omit the model). For multi-model panels, run the same number of subagents, varying models where the tool allows.
- Skills not vendored here (`benchmark-checklist`, `reflect`, `correct`, `figure-it-out`, `blast-radius`, `setup-pstack`, and `cursor-team-kit`'s `deslop` / `control-ui` / `control-cli`) → skip that step and note `skip: not installed`.
