# @repo/design

Moni's design tokens, in one place for the phone app and the web app. Values follow [`docs/redesign/tokens.md`](../../docs/redesign/tokens.md); this package is where they live in code.

## What it holds

| File | Exports |
| --- | --- |
| `src/colors.ts` | The colour roles, light and dark (`colorGroups`, `lightColors`, `darkColors`, `ColorRole`) |
| `src/shape.ts` | Radii and named spacing in px |
| `src/type.ts` | `fontFamily` (`Funnel Display`), `fontFaces` (each face's Expo font key and CSS weight), `typeScale` |
| `src/motion.ts` | The six motion tokens: `springs.press`, `value`, `control`, `sheet`, `throw` and `drag`; `projectedPosition` and `FLING_COMMIT_THRESHOLD`; `springCurve(spring)`, the spring as a CSS `linear()` easing and duration |
| `src/categories.ts` | `categoryColors`: the core category colours, light and dark, with the preset each one dresses |
| `src/icons.generated.ts` | `iconNames`: every MDI glyph name the phone app uses, and `mdiVersion` |

The stored category catalogue (`categoryIconNames`, `customCategoryColors`) stays in `@repo/types`, because its Zod schemas validate it.

## Change a token

1. Edit the value in `src/`.
2. Run `pnpm --filter @repo/design gen`.
3. Commit the source and the generated files together.

The generator writes these files. Do not edit them by hand:

- `apps/mobile/global.css`: the Uniwind entry. Fonts, radii and spacing go in `@theme`, and colours go in `@layer theme` `@variant light` and `@variant dark`.
- `apps/mobile/constants/theme-tokens.generated.ts`: the colours that `useThemeTokens()` returns.
- `tokens.css`: the same variables as plain CSS for the web, imported as `@repo/design/tokens.css`. Light values are on `:root`. Dark values apply under `[data-theme='dark']`, or under the system dark setting unless `[data-theme='light']` is set. Type and motion use Tailwind v4's namespaces (`--text-hero`, `--text-hero--line-height`, `--ease-sheet`, `--duration-sheet`).
- `src/icons.generated.ts`: the generator scans `apps/mobile` and `@repo/types` for string literals that name a glyph in the pinned MDI font, so the list can include a few ordinary words that are also glyph names.

`pnpm --filter moni lint:tokens` (CI) runs the generator with `--check` and fails when a generated file is stale. Adding an icon name to the phone app also makes the check fail until you run `gen`.

## Notes

- `springCurve` uses the same simulation as the W2-Motion board generator: mass 1, 0.25 ms steps, 40 points over the time after which the spring stays within 0.1% of its target. The CSS duration is that settle time.
- `projectedPosition` keeps its `'worklet'` directive. The phone's Reanimated Babel plugin compiles it for the UI thread, and on the web the directive is an unused string.
- `src/emit.ts` holds the generator's renderers. Its imports end in `.ts` so that Node can run `scripts/generate.ts` without a build step. The package index does not export it.

## Scripts

`gen`, `test` (Vitest), `lint`, `check-types` (`src` without DOM or Node types, then `scripts` with Node types).
