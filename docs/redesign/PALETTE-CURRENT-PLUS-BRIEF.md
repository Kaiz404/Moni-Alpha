# Brief: apply the Current+ palette to the mobile app (12 Nov 2026)

The owner picked the **Current+** palette on the design canvas. `docs/redesign/tokens.md` § Colour is the spec (read it first, in full). This brief splits the code work and gives exact values.

## What changes

1. **Light neutrals do not change.** Cream, Paper, Sand, Sand light, Hairline, Ink, Ink 2, Meta, Deep mint, Over text and the Mint key stay as they are.
2. **Category bubbles wear the category's colour solid with an Ink (#17181A) glyph, in both themes.** Today `TintBubble` (`components/ui/transaction-row.tsx`) draws `${color}73` (45%) in light and `${color}38` (22%) in dark with the glyph in the colour. Replace that with a solid fill and an Ink glyph everywhere a category or wallet bubble is drawn (row bubbles, picker tiles, budget-ring centres, map pins, wallet bubbles, bill rows).
3. **Chart and category colours are sharper.** The core set, light / dark:

| Name | Light | Dark |
| --- | --- | --- |
| mint | #6FD08C | #59C97D |
| lemon | #F7CF3A | #F0C42C |
| lilac | #A98CF5 | #987AFF |
| peach | #FF9F66 | #F58D47 |
| coral | #FF7F70 | #F5685A |
| sky | #62A8EE | #4CA4F5 |
| aqua | #4CC8BA | #30BEA6 |
| pink | #EE8DB8 | #F07AB2 |
| other | #CFC6B5 | #8C867B |

   Coral is also the over-budget fill and the Daily bars above even pace. `chart-1..6` are mint, sky, lilac, lemon, coral, peach.
4. **Blocks keep their pastels in light** (Mint #A9DDB5, Lemon #F2DC72, Lilac #C9B6F0, Peach #F5BE98 under ink text) and **turn tonal in dark**: a dark fill with light text. A token that fills a block, pill, button or state keeps its light value; a token that draws a category or chart mark takes the core set above. When a token does both today, split it.
5. **Dark goes near black.** Map `@variant dark` in `apps/mobile/global.css` to these values:

| Token(s) | Dark value |
| --- | --- |
| background, canvas | #0B0A09 |
| card, surface-1, surface-raised | #1D1B19 |
| background-muted, surface-2, sand | #2D2A27 |
| surface-tray, sand-light, track, border-subtle | #252320 |
| border, hairline, bloom | #443F38 |
| border-strong | #80796D |
| foreground, expense, on-tab-bar, primary | #F6F3ED |
| primary-foreground | #0B0A09 |
| primary-pressed | #DDD8CE |
| muted, transfer, inactive | #A39C90 |
| ink-2 | #CEC8BD |
| tab-bar | #242220 |
| success, income, deep-mint, state-approved | #72DE97 |
| danger, over | #FF7366 |
| warning, state-attention | #F0CF5A |
| state-pending | #C9B7FF |
| state-destructive | #FF8A7E |
| accent, mint-key | #66D68A (glyph on it #0B2416) |
| mint-key-pressed | #59C97D |
| primary-muted (block) and the dark Mint block | #123422 |
| attention-fill and the dark Lemon block | #352B0C |
| pending-fill and the dark Lilac block | #2D2452 |
| destructive-fill | #3D1D19 (pressed #4D2620) |
| moni-glyph (on the cream Contrast circle) | #4A3596 |
| on-ink-positive | #236B47 |
| on-ink-meta | #6B655C |
| on-ink-body | #2D2A27 |

   In dark, text on a tonal block is light (#F6F3ED); its secondary text is #C9B7FF on Lilac, #F0CF5A on Lemon and #72DE97 on Mint. Today `on-pastel`, `on-lemon`, `on-lilac` and `on-mint` are ink in both themes. They must become light in dark for blocks, while category bubbles keep an Ink glyph. Add a token for the bubble glyph (for example `on-category`, #17181A in both themes) rather than reusing `on-pastel`.
6. **The stored category catalogue is sharpened** by the rule and the old → new table in tokens.md § Colour. That means `packages/types/src/category.ts` (`customCategoryColors`), the system presets, the `categories_color_catalog_check` constraint, the rows already stored, and any import or restore path that could bring an old hex back. Wallet colours follow the same rule.

## Rules for every agent

- Work only in the files your brief owns. If you need a change outside them, note it in your report instead of making it.
- Another session is changing `components/charts/**` and `components/wallets/net-worth-*`. Touch only colour values there, nothing else.
- Run `pnpm --filter moni gen:tokens` after any `global.css` change. Run `npx tsc --noEmit`, `npx jest --runInBand`, `npx eslint` on the files you touched, `pnpm -s lint:test-ids`, `pnpm -s lint:flow-ids` and `pnpm -s lint:copy` in `apps/mobile` (`source apps/mobile/scripts/device/env.sh` first). Fix the tests your change breaks by updating their expected colours, not by weakening them.
- Commit in your worktree with a conventional message (`feat(mobile): …`). Add no Co-Authored-By or Claude attribution lines.
- Never write a file by opening it for writing before reading it. Read first, then write.
