# Art direction round 2: shared brief

Project: `/home/kaiz404/projects/moni/marketing/promo/`, a standalone Remotion 4 project (not in the pnpm workspace). Do not commit anything.

## Setup

- Run `source /home/kaiz404/projects/moni/apps/mobile/scripts/device/env.sh` first. The default `npm` on PATH is the Windows one, and this script switches to nvm's Node instead.
- Use `npx remotion ffmpeg` for ffmpeg. A static ffmpeg is also at `~/.local/opt/ffmpeg-static/bin/ffmpeg`.
- The first cut is in `src/videos.ts`, a data-driven shot list. It is rendered by:
  - `src/film/Film.tsx`
  - `src/film/timeline.ts`
  - `src/film/types.ts`
  - `src/film/useClipTexture.ts`
  - `src/Phone.tsx`, a three.js phone whose screen is a video texture. Its material needs a `key`, or the screen renders black.
- `src/brand.ts` holds the colours, the font and FPS.
- The rendered first cut is in `out/`. Watch frames from it in `out/frames/`.

## Footage

- `clips/*.mp4` holds 12 real 1080x2400 portrait recordings of the Moni Android app.
- `clips/manifest.json` gives each clip a description and `beats`, the timestamps of its key moments.
- `clips/contact/*.png` holds contact sheets.
- `STORYBOARD.md` explains the first cut.

## Owner feedback on the first cut (applies to every direction)

- The movements are too intense. Calm them down.
- There is too much rotation of the phone and screen. Dial it way down. Small yaw and tilt only, and no whip spins.
- Zooming in and out as parts of the screen come and go is good. Keep it, but make it more intentional: push in on the exact beat that matters and frame the element that matters.
- Captions should play more with the sides of the frame rather than always sitting centred at the bottom.
- No "smoke screen" at the bottom. Today the phone fades to white near its lower edge, and the caption sits over ghosted UI. Remove all fades and gradients over the phone. Captions sit on clean background.

## Footage problems you must not show

- **ask-moni:** the grey line under the answer title ("...went on") is an app bug. Never show that line legibly.
- **scan-receipt:**
  - Never show the black camera viewfinder, the green camera chip, or the "Moni E2E will have access..." text. Cut from the "Scan a receipt" tap to the Check and approve result.
  - Never zoom on Location ("Seattle..." / "Not saved").
- **Headers and dates:** header timestamps and dates (for example "Mon 23 Nov at 11:44 pm") don't match the 09:41 status bar. No tight close-ups on headers or date lines.
- **quick-add:** the typed bubble says "ringgit". Avoid lingering on it, and frame the draft card instead. The keyboard is up in parts of it, so prefer source ranges after it's dismissed, or crop it out.
- **Short holds:** holds in clips are about 1.2 s. Where you need read time, use a short freeze-frame or a slow drift.

## Brand

- Cream background, `#f6f2e9` to `#ece5d6`, with Deep mint accents.
- Funnel Display font (see `brand.ts`).
- Cream & Capsule style.
- Read `/home/kaiz404/projects/moni/.claude/skills/moni-taste/SKILL.md`.
- Moni launches worldwide, so captions never say "ringgit" or anything Malaysia-only. RM amounts in the UI are fine.
- Keep captions very short: 2 to 5 words, plus an optional one-line sub.

## Isolation rules (several agents work in parallel)

- Own ONLY `src/directions/<your-direction>/`. Its `index.tsx` exports `compositions`, a fragment of `<Composition>` elements. It is already imported by `src/Root.tsx`, so do not edit Root.tsx.
- Prefix every composition id with your direction name in PascalCase, for example `CalmHero`.
- Do not edit the shared files: `src/Phone.tsx`, `src/film/*`, `src/videos.ts`, `src/brand.ts`, `remotion.config.ts`, `scripts/*`. Copy anything you need into your folder and change the copy.
- Write renders to `out/<your-direction>/` and frames to `out/<your-direction>/frames/`.
- Keep compositions data-driven: a shots array the owner can re-cut without touching code.

## Rendering etiquette (the machine is shared, 16 cores)

- A separate agent is making rendering faster (GPU), so CPU is contended.
- While developing, check with `npx remotion still` at key frames, or `npx remotion render ... --frames=a-b --scale=0.5`.
- Do your full-resolution renders only at the end, with `--concurrency=4`.
- If 2D CSS transforms (`perspective`/`rotateY` on a div holding an `<OffthreadVideo>`) can do your direction, prefer them over three.js. They render far faster and look the same for small angles. The `<OffthreadVideo>` goes inside a phone frame built from divs, or a PNG frame.

## Verify before reporting

- Extract one frame per shot midpoint from each final render and look at every one yourself.
- Fix any shot that shows a black screen, a cut-off phone, a caption over UI, any footage problem listed above, or anything that breaks the owner feedback.

## Report (under 250 words)

- The direction in one sentence.
- Each video: path, length, aspect, what it shows.
- Render times, and whether you used CSS or three.js.
- The 3 frames that best show the direction.
- What is weakest.
