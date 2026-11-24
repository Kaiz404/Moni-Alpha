# Moni promo videos

A standalone Remotion project, outside the pnpm workspace, that turns real recordings of the Moni E2E app into marketing videos. Git holds the code, take flows and clip manifest. No video is in git: the videos live in Google Drive and in this folder's gitignored directories.

## Where the assets are

**Google Drive, the source of truth for finished videos.** The folder is "Moni promo" in the owner's My Drive. Agents reach it with the Google Drive connector, by folder ID (`parentId = '<id>'` in a search, or `parentId` on upload).

| Drive path | Folder ID | Holds |
| --- | --- | --- |
| `Moni promo/` | `1eN7iVwCr0BA74mUNid2UrzwAoK6eHWxi` | Root |
| `clips/` | `1aC4aGm2psDxNGFneA71bSSLGbcOy4SAc` | The 12 trimmed feature recordings (1080x2400, Pixel 8) and `manifest.json` |
| `first-cut/` | `1q0JaRYVpZiPQk-ZR52r8dEzaeSIN_uqk` | First cut, three.js phone: `hero-portrait`, `hero-landscape`, `spot-quick-add`, `spot-scan`, `spot-review` |
| `directions/` | `1sORqnTIRjGxXC2kxZqv-1PIDX6PSjPSi` | One subfolder per art direction |
| `directions/calm/` | `1I0L2LFrsT99S5_Sv-5emqHzgRqD3oHPw` | `calm-hero-portrait`, `calm-hero-landscape` |
| `directions/editorial/` | `1orc5HV19SwzEBsWWrl7vMFNQcXYYqRNR` | `editorial-hero-portrait`, `editorial-hero-landscape`, `editorial-spot-scan` |
| `directions/callouts/` | `1E5ye7tfxfTXUT3G075JX55ZDp4G72dJf` | `callouts-hero-portrait`, `callouts-hero-landscape`, `callouts-spot-quick-add` |
| `directions/still-thumbnails/` | `1EnKNC0NFI1IlIw21q_EM8d-n5GEQ66SP` | Two subfolders, below |
| `directions/still-thumbnails/tours/` | `1PD-5Wz1-CVxTUHWtzlhrqYbbCkWv6wkG` | Looping thumbnail tour: `tour-4x5`, `tour-square`, `tour-wide` |
| `directions/still-thumbnails/feature-loops/` | `19oXCeyhaVYjml692PF1GGxFSpK_sjdRk` | 6 to 8 s loops: `home`, `quick-add`, `scan`, `review`, `pace`, `map` |

The connector refuses uploads over about 7 MB. `scripts/drive-prep.sh <video>...` re-encodes larger videos into `out/drive/` and prints the file reference to pass as `base64Content`. So the Drive copies of the first-cut portrait hero and the two Calm heroes are lower-bitrate. The full-quality masters are local only.

**Local, gitignored, on the owner's machine:**

- `clips/<feature>.mp4` holds the trimmed recordings, the same as Drive `clips/`. `clips/raw/` holds the untrimmed takes, and `clips/contact/` holds 4-frame contact sheets. Only `clips/manifest.json` is in git.
- `out/*.mp4` is the first cut at full quality, with `out/frames/<video>/` holding one frame per shot.
- `out/<direction>/` holds each direction's full-quality renders and its `frames/`.
- `public/clips` is a symlink to `../clips`, so compositions load footage through `staticFile('clips/...')`.

A fresh checkout has no footage. Download Drive `clips/` into `clips/` to render, or record again (below). Upload new renders into the matching Drive folder, creating a new `directions/<name>/` folder for a new direction, and add its row to this table in the same change.

## Known footage problems

- `ask-moni`: the answer card's grey line stops at "went on". This is app bug Kaiz404/Moni-Alpha#122, so no cut uses this clip.
- `quick-add`: the typed bubble says "paid 6 ringgit parking at KLCC". Moni ships worldwide, so frame around it, or retake it with a neutral phrase.
- `scan-receipt`: the camera viewfinder is black, the scanner shows "Moni E2E will have access...", and Location reads "Seattle" or "Not saved" (Device Farm phones sit in Oregon). Cut from the "Scan a receipt" tap to the result.
- Header timestamps (around 11:44 pm, 23 to 24 Nov) don't match the 09:41 demo status bar. Avoid close-ups on headers and dates.

`BRIEF-directions.md` lists these as hard rules for any new cut.

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
