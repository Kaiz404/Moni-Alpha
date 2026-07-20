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
