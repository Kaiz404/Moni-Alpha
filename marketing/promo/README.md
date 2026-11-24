# Moni promo videos

A standalone Remotion project, outside the pnpm workspace, that turns real recordings of the Moni E2E app into marketing videos. The videos are not in git. Clips and renders live in the owner's Google Drive folder "Moni promo" (`clips/`, `first-cut/`, `directions/<name>/`). This folder holds everything needed to make them again.

## Layout

- `takes/*.yaml` are the Maestro take flows, one per feature, paced for viewers.
- `scripts/devicefarm.sh` leases an AWS Device Farm phone and attaches it to local adb through Device Connect. `scripts/record-take.sh <feature>` records one take into `clips/<feature>.mp4` and updates `clips/manifest.json`.
- `clips/manifest.json` lists each clip with its key beats (timestamps), so cuts can be planned without watching the footage.
- `src/videos.ts` and `src/film/` hold the first cut, a three.js phone. `src/directions/<name>/` holds one folder per art direction (calm, still, editorial, callouts), each a data-driven shot list.
- `STORYBOARD.md` explains the first cut. `BRIEF-directions.md` holds the owner's feedback that every direction follows. `RENDERING.md` covers render speed and the GPU setup.

## Record

AWS CLI profile `moni-devicefarm` (region `us-west-2`), `devicefarm-connect` in `~/.local/bin`, and an e2e APK built in a worktree with `apps/mobile/scripts/device/build-apk.sh`.

```bash
scripts/devicefarm.sh start
scripts/devicefarm.sh prep ~/.cache/moni-apk-promo/<sha>/app-release.apk
scripts/record-take.sh quick-add
scripts/devicefarm.sh stop && scripts/devicefarm.sh status
```

A take costs about 4 device minutes. Always end with `stop`, since billing runs until the session stops.

## Render

```bash
source ../../apps/mobile/scripts/device/env.sh
npm ci
npx remotion studio                      # preview every composition
node scripts/render-all.mts Hero         # first-cut videos into out/
npx remotion render src/index.ts CalmHero out/calm/CalmHero.mp4
```

`remotion.config.ts` renders WebGL on the NVIDIA GPU through WSL's d3d12 driver. See `RENDERING.md`.
