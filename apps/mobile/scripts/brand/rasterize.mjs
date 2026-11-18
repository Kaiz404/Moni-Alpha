#!/usr/bin/env node
/**
 * Renders the SVG masters from export.py into assets/images/*.png.
 * Run: pnpm --filter moni brand:assets
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const IMAGES = join(HERE, '../../assets/images');

const ASSETS = [
  ['icon', 1024],
  ['icon-dark', 1024],
  ['icon-tinted', 1024],
  ['adaptive-icon', 1024],
  ['adaptive-icon-monochrome', 1024],
  ['splash-icon', 1024],
  ['notification-icon', 96],
  ['favicon', 48],
];

for (const [name, size] of ASSETS) {
  const master = readFileSync(join(HERE, 'out', `${name}.svg`));
  await sharp(master)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(IMAGES, `${name}.png`));
  console.log(`assets/images/${name}.png ${size}x${size}`);
}
