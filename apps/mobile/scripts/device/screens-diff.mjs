#!/usr/bin/env node
// Compares two folders of flow screenshots by file name and writes a side-by-side image for each
// one that differs. Exit 0 when every shared screenshot matches and neither side is missing one.
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { readRects } from './overlays.mjs';

// The status bar holds the real clock, battery and notification icons, which differ between runs.
export const STATUS_BAR_FRACTION = 0.05;
// A channel must move this much to count, which absorbs JPEG-like noise from screen capture.
export const CHANNEL_TOLERANCE = 24;
// Antialiasing and the blinking caret change a few pixels; more than this is a real change.
export const CHANGED_FRACTION = 0.002;

export async function compareImages(basePath, headPath, ignore = []) {
  const [base, head] = await Promise.all(
    [basePath, headPath].map((p) => sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true })),
  );
  const { width, height } = base.info;
  if (width !== head.info.width || height !== head.info.height) {
    return { changed: true, fraction: 1, reason: `size ${width}x${height} vs ${head.info.width}x${head.info.height}` };
  }
  const top = Math.round(height * STATUS_BAR_FRACTION);
  let differing = 0;
  const ignored = (x, y) => ignore.some(([x1, y1, x2, y2]) => x >= x1 && x < x2 && y >= y1 && y < y2);
  for (let y = top; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (ignored(x, y)) continue;
      const i = (y * width + x) * 4;
      if (
        Math.abs(base.data[i] - head.data[i]) > CHANNEL_TOLERANCE ||
        Math.abs(base.data[i + 1] - head.data[i + 1]) > CHANNEL_TOLERANCE ||
        Math.abs(base.data[i + 2] - head.data[i + 2]) > CHANNEL_TOLERANCE
      )
        differing++;
    }
  }
  const fraction = differing / (width * (height - top));
  return { changed: fraction > CHANGED_FRACTION, fraction };
}

async function writeSideBySide(basePath, headPath, out) {
  const meta = await sharp(basePath).metadata();
  await sharp({ create: { width: meta.width * 2, height: meta.height, channels: 4, background: '#ff00ff' } })
    .composite([
      { input: basePath, left: 0, top: 0 },
      { input: await sharp(headPath).resize(meta.width, meta.height).toBuffer(), left: meta.width, top: 0 },
    ])
    .png()
    .toFile(out);
}

export async function diffFolders(baseDir, headDir, outDir) {
  const pngs = (dir) => new Set(readdirSync(dir).filter((f) => f.endsWith('.png') && !f.startsWith('step-')));
  const base = pngs(baseDir);
  const head = pngs(headDir);
  // Another app's floating window, blacked out where it sat on either side, is no change of Moni's.
  const ignore = [...readRects(join(baseDir, 'overlays.txt')), ...readRects(join(headDir, 'overlays.txt'))];
  const result = { same: [], changed: [], onlyBase: [], onlyHead: [] };
  for (const name of [...base].sort()) {
    if (!head.has(name)) {
      result.onlyBase.push(name);
      continue;
    }
    const cmp = await compareImages(join(baseDir, name), join(headDir, name), ignore);
    if (!cmp.changed) {
      result.same.push(name);
      continue;
    }
    result.changed.push({ name, fraction: cmp.fraction, reason: cmp.reason });
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      await writeSideBySide(join(baseDir, name), join(headDir, name), join(outDir, name));
    }
  }
  result.onlyHead = [...head].filter((n) => !base.has(n)).sort();
  return result;
}

async function main([baseDir, headDir, outDir]) {
  if (!baseDir || !headDir) {
    console.error('usage: screens-diff.mjs <base-dir> <head-dir> [<diff-out-dir>]');
    process.exit(2);
  }
  const r = await diffFolders(baseDir, headDir, outDir);
  for (const c of r.changed) console.log(`changed ${c.name} ${(c.fraction * 100).toFixed(2)}%${c.reason ? ` ${c.reason}` : ''}`);
  for (const n of r.onlyBase) console.log(`missing on head ${n}`);
  for (const n of r.onlyHead) console.log(`new on head ${n}`);
  console.log(`${r.same.length} same, ${r.changed.length} changed, ${r.onlyBase.length} missing, ${r.onlyHead.length} new${outDir && r.changed.length ? `, diffs in ${outDir}` : ''}`);
  process.exit(r.changed.length || r.onlyBase.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
