# @repo/brand

Cat Pebble, the Moni mascot, as TypeScript functions that return SVG and HTML strings. This package is the one copy of the locked art. The phone app's asset generator reads it, and the web app can inline the same strings.

The direction is fixed: a Paper cat on a Deep mint tile (a Deep mint cat on light pages) holding a Lemon coin at its chest. It has no tail and no sparkles, and the cat never goes inside the wordmark. Do not change the geometry here unless the owner has approved new art on the design canvas.

## Interface

All art is drawn on a 240-unit grid.

| Function | Returns |
| --- | --- |
| `figure(mood, ground, { fit, lift })` | The cat as an SVG `<g>`, in a named ground (`deep`, `cream`, `ink`, `none` for light pages, `dark`) or a custom `Ground` |
| `catSvg(mood, { size, ground, tile, label })` | An inline `<svg>`: the app-icon tile (radius 22%), or the mascot alone, cropped to the figure |
| `monoFigure(mood, color, maskId)` and `catMonoSvg(mood, { tile, color, … })` | The official one-colour cat: one fill through a mask, so every cut-out is transparent |
| `wordmarkHtml(size, { color, dot, dotColor })` | "moni" in Funnel Display Bold, with the drawn i-dot. This is HTML, because the word is live text. |
| `lockupHtml(kind, { size, ground, dot })` | The tile beside the wordmark (`horizontal`) or above it (`stacked`), as HTML |

`MOODS` lists the nine moods, and `MOOD_NOTES` gives the moment each one belongs to. The palette (`DEEP`, `PAPER`, `INK`, `LEMON`, `PEACH`, `MINTKEY`, …), `LOCKUP` ratios and the geometry constants are exported too.

## The Python bridge

`python/catart.py` has the API of the old Python art module (`figure`, `cat_svg`, `mono_figure`, `cat_mono_svg`, `wordmark_html`, `lockup_html`, the constants). Each call runs this package through `node scripts/call.ts`, so the bridge needs Node 22.18 or later on `PATH`. The phone's `apps/mobile/scripts/brand/export.py` imports it. To refresh the mascot registry and the app icons, run this command:

```bash
pnpm --filter moni brand:assets
```

It rewrites `apps/mobile/components/brand/mascot-art.generated.ts` and `apps/mobile/assets/images/*.png`. The output matches the old module byte for byte. Numbers print as Python printed them: one decimal with ties to the even digit, and `5.0` where Python printed a float.

## Scripts

`test` (Vitest), `lint`, `check-types` (`src` without DOM or Node types, then `scripts` with Node types).
