#!/usr/bin/env node
// Another app's floating window (a video call's picture-in-picture) can sit over Moni during a run.
// It shows the operator's camera and differs from run to run, so its rectangle is blacked out in every
// screenshot and left out of comparisons.
//   overlays.mjs parse < dumpsys-activity.txt   prints one "x1 y1 x2 y2" per pinned window
//   overlays.mjs mask <rects-file> <dir>        blacks those rectangles out of every PNG under dir
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

export function parsePinnedBounds(dumpsys) {
  const rects = new Set();
  let pinned = false;
  for (const line of dumpsys.split('\n')) {
    if (/^\s*\* Task\{/.test(line)) pinned = /mode=pinned/.test(line);
    const m = pinned && /mBounds=Rect\((\d+), (\d+) - (\d+), (\d+)\)/.exec(line);
    if (m) {
      rects.add(m.slice(1).join(' '));
      pinned = false;
    }
  }
  return [...rects].map((r) => r.split(' ').map(Number));
}

export function readRects(file) {
  try {
    return readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => /^\d+ \d+ \d+ \d+$/.test(l.trim()))
      .map((l) => l.trim().split(' ').map(Number));
  } catch {
    return [];
  }
}

export async function maskFile(path, rects) {
  if (!rects.length) return;
  const { width, height } = await sharp(path).metadata();
  const boxes = rects
    .map(([x1, y1, x2, y2]) => [Math.max(0, x1), Math.max(0, y1), Math.min(width, x2), Math.min(height, y2)])
    .filter(([x1, y1, x2, y2]) => x2 > x1 && y2 > y1)
    .map(([x1, y1, x2, y2]) => ({
      input: { create: { width: x2 - x1, height: y2 - y1, channels: 4, background: '#000' } },
      left: x1,
      top: y1,
    }));
  const masked = await sharp(path).composite(boxes).png().toBuffer();
  writeFileSync(path, masked);
}

function pngsUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pngsUnder(path);
    return name.endsWith('.png') ? [path] : [];
  });
}

async function main([cmd, a, b]) {
  if (cmd === 'parse') {
    for (const r of parsePinnedBounds(readFileSync(0, 'utf8'))) console.log(r.join(' '));
  } else if (cmd === 'mask' && a && b) {
    const rects = readRects(a);
    for (const png of pngsUnder(b)) await maskFile(png, rects);
  } else {
    console.error('usage: overlays.mjs parse < dumpsys.txt | overlays.mjs mask <rects-file> <dir>');
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
