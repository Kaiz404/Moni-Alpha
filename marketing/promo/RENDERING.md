# Rendering

How to render the promo fast on this machine (WSL2, 16 cores, RTX 3050 Laptop), and the measurements behind the defaults.

## Defaults

`remotion.config.ts` runs WebGL on the NVIDIA GPU:

- `--gl=angle-egl` with `--chrome-mode=headless-shell` (the default mode).
- `GALLIUM_DRIVER=d3d12`, set inside the config. Mesa's d3d12 driver reaches the Windows GPU through `/dev/dxg`. Without it, Mesa falls back to llvmpipe on the CPU.
- `MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`, set inside the config. Without it, d3d12 picks the Intel UHD iGPU.
- JPEG frames. Concurrency stays at Remotion's default (8, half the cores).

Both variables use `??=`, so you can override them from the shell. For example, `MESA_D3D12_DEFAULT_ADAPTER_NAME=Intel` selects the iGPU.

`scripts/render-all.mts` bundles once and renders every video from that bundle. Before, every video re-bundled (14 s on an idle machine, 52 s under load).

## Commands

Quick preview (check a moment or a range at low cost):

```sh
source /home/kaiz404/projects/moni/apps/mobile/scripts/device/env.sh
npx remotion still SpotScan out/check.png --frame=120
npx remotion render SpotScan out/check.mp4 --frames=0-89 --scale=0.5
```

Final:

```sh
node scripts/render-all.mts            # every video in src/videos.ts
node scripts/render-all.mts SpotScan   # one video
npx remotion render CalmHero out/calm/hero.mp4
```

When other renders share the machine, add `--concurrency=4`. It measured as fast as 8 (table below).

To confirm that the GPU is in use, render the probe. It prints WebGL's unmasked renderer into the image:

```sh
npx remotion still src/directions/_bench/entry.ts Probe out/probe.png
```

Expected: `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 3050 6GB Laptop GPU), OpenGL ES 3.1)`.

## What was tried

### GPU backends (probe, `UNMASKED_RENDERER_WEBGL`)

| `--gl` | default env | with `GALLIUM_DRIVER=d3d12` |
|---|---|---|
| swangle (old default) | SwiftShader (CPU) | not tried |
| swiftshader | no WebGL context | not tried |
| angle | no WebGL context | no WebGL context |
| egl | no WebGL context | no WebGL context |
| vulkan | llvmpipe (CPU) | llvmpipe (CPU) |
| **angle-egl** | llvmpipe (CPU) | **D3D12 NVIDIA** (Intel iGPU unless the adapter is named) |

`headless-shell` and `chrome-for-testing` behaved the same, except that `angle-egl` with `chrome-for-testing` got no WebGL context. `LD_LIBRARY_PATH=/usr/lib/wsl/lib` is not needed. Mesa has no dzn (Vulkan-on-D3D12) driver here, so `vulkan` stays on llvmpipe. No step needed sudo.

### Timings

All runs render frames 0-59 of the composition from a prebuilt bundle. Wall time includes browser start-up. Runs alternate between sides. Four art agents rendered at the same time, so each row gives the 1-minute load average before the run.

| Test | Composition | swangle (CPU) | angle-egl (GPU) | load |
|---|---|---|---|---|
| three.js phone, 4 runs each | SpotScan | 42.1 / 47.4 / 49.2 / 52.0 s, median 48.3 | 19.6 / 20.0 / 20.2 / 27.7 s, median 20.1 | 27-33 |
| three.js phone, 3 runs each | SpotScan | 20.7 / 21.8 / 22.4 s, median 21.8 | 9.4 / 9.5 / 16.5 s, median 9.5 | 11-19 |
| CSS 3D phone (div + OffthreadVideo), 3 runs each | EditorialSpotScan | 6.4 / 7.1 / 12.8 s, median 7.1 | 6.3 / 6.7 / 16.1 s, median 6.7 | 11-19 |

- The GPU makes the three.js phone 2.3-2.4x faster at both load levels.
- The GPU does nothing measurable for CSS 3D. Chrome composites the CSS transforms cheaply on either path.
- CSS 3D on swangle is still 1.3x faster than three.js on the GPU. Prefer CSS 3D for small angles.
- Output matches: SSIM between the swangle and GPU renders is 0.998 for SpotScan and 0.999 for EditorialSpotScan.

Concurrency, GPU, SpotScan 0-59, 2 rounds. Load fell from 29 to 18 during the sweep, so compare within a round:

| `--concurrency` | round 1 | round 2 |
|---|---|---|
| 4 | 19.9 s | 9.4 s |
| 8 (default) | 9.6 s | 9.8 s |
| 12 | 21.3 s | 12.7 s |
| 16 | 21.7 s | 12.8 s |

4 and 8 tie. 12 and 16 are slower because they add tabs that contend for the same frame extraction.

All-intra clips (re-encoded with `-g 1`, so every frame is a keyframe), GPU, SpotScan 0-59: 51.5 → 48.1 s and 34.1 → 30.8 s. That is about 8% faster, but the clips grow from 26 MB to 794 MB. Not adopted.

End to end, `node scripts/render-all.mts SpotScan` (7.7 s video) takes 45 s at load 18-20: 11 s to bundle and 34 s to render. Earlier runs of the same video took 95-175 s, but under unrecorded load, so that comparison is rough. The frame-range table above is the controlled comparison.

### Where the time goes now

From `--log=verbose` on a GPU render of 30 frames:

- **Clip frame extraction is the limiter.** Each frame waits for Remotion's compositor to decode a 1080x2400 frame from the clip: median 1.7 s, max 4.7 s under load. The first frame on each of the 8 tabs takes 12-16 s (open the clip, seek, warm up).
- Screenshot capture totals 0.4 s for 30 frames, so JPEG versus PNG does not matter.
- Encoding runs in parallel with rendering, and the final stitch only copies streams. So `--x264-preset` and NVENC cannot help much. Remotion's `--hardware-acceleration` is macOS-only anyway.

## Caveats

- The GPU path depends on WSLg's `/dev/dxg` and the Windows NVIDIA driver. After a driver update, run the probe again. If it shows llvmpipe or SwiftShader, renders still work, just slower.
- On a machine without d3d12 (not WSL), the config falls back to CPU rendering through llvmpipe. Set `--gl=swangle` there.
- `libEGL warning: DRI3 error` lines in the logs are harmless. They come from Mesa trying the X11 platform first.
- The bench harness is `src/directions/_bench/bench.sh`. Its usage is in the header.
