# Legal texts

This folder holds the source text of Moni's privacy policy and terms of service. The web app renders these files at `/privacy`, `/privacy/ms`, `/terms` and `/terms/ms`. A store listing or any other copy starts from these files too. Do not keep a second copy elsewhere.

| File | Page |
| --- | --- |
| `privacy.en.md` | `/privacy` |
| `privacy.ms.md` | `/privacy/ms` |
| `terms.en.md` | `/terms` |
| `terms.ms.md` | `/terms/ms` |

PDPA s.7(3) requires the notice in Malay and in English. Change both languages in the same commit, and keep their section ids the same: the language switch and `apps/web/src/lib/__tests__/legal.test.tsx` rely on them.

## Format

`apps/web/src/components/legal/markdown.ts` reads a strict subset of markdown, and the build fails on anything else:

- Front matter with `updated: YYYY-MM-DD`. The page shows it as **Last updated**. Change it whenever the text changes.
- `# Title`, then one summary paragraph.
- Sections as `## Heading {#id}`. Inside a section: paragraphs, `### ` subheadings, `- ` lists and pipe tables.
- Inline: `[text](href)` links and `{{name}}` facts.

A fact is a value the owner still has to confirm, such as the legal entity or the support email. Facts live in `apps/web/src/lib/site-facts.ts`. Until a fact is confirmed, the page shows it as a marked `[CONFIRM: …]`. To confirm one, change its `confirm(…)` to `fact('English', 'Malay')`. When you copy text into a store listing, replace each `{{name}}` with the fact's value.

## Before launch

A lawyer has not reviewed these texts. The open points for a lawyer are in [`../research/international-compliance-2026-11.md`](../research/international-compliance-2026-11.md#open-questions-for-a-lawyer) and [`../research/import-ai-compliance-2026-11.md`](../research/import-ai-compliance-2026-11.md#open-questions). The launch paperwork that goes with these texts is in [`../launch/`](../launch/).
