/**
 * Writes every file generated from packages/design/src. With --check, writes nothing and exits 1
 * when a committed file differs from a fresh run (CI runs `pnpm --filter moni lint:tokens`).
 * Run: pnpm --filter @repo/design gen
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { iconNamesTs, mobileGlobalCss, mobileThemeTokensTs, webTokensCss } from '../src/emit.ts';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const MDI = join(REPO, 'apps/mobile/node_modules/@react-native-vector-icons/material-design-icons');
const ICON_SOURCES = [
  'apps/mobile/app',
  'apps/mobile/components',
  'apps/mobile/lib',
  'packages/types/src',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function iconNames() {
  const glyphs = JSON.parse(readFileSync(join(MDI, 'glyphmaps/MaterialDesignIcons.json'), 'utf8'));
  const names = new Set<string>();
  for (const file of ICON_SOURCES.flatMap((dir) => sourceFiles(join(REPO, dir)))) {
    for (const [, name] of readFileSync(file, 'utf8').matchAll(
      /['"]([a-z0-9]+(?:-[a-z0-9]+)*)['"]/g,
    )) {
      if (Object.hasOwn(glyphs, name!)) names.add(name!);
    }
  }
  const pkg = JSON.parse(readFileSync(join(MDI, 'package.json'), 'utf8'));
  const version = pkg.devDependencies?.['@mdi/font'];
  if (typeof version !== 'string')
    throw new Error(`${MDI}/package.json names no @mdi/font version`);
  return iconNamesTs([...names].sort(), version);
}

const outputs: Record<string, string> = {
  'apps/mobile/global.css': mobileGlobalCss(),
  'apps/mobile/constants/theme-tokens.generated.ts': mobileThemeTokensTs(),
  'packages/design/tokens.css': webTokensCss(),
  'packages/design/src/icons.generated.ts': iconNames(),
};

const read = (path: string) => {
  try {
    return readFileSync(join(REPO, path), 'utf8');
  } catch {
    return '';
  }
};

if (process.argv.includes('--check')) {
  const stale = Object.keys(outputs).filter((path) => read(path) !== outputs[path]);
  if (stale.length > 0) {
    console.error(
      `stale: ${stale.join(', ')}\nEdit packages/design/src, then run: pnpm --filter @repo/design gen`,
    );
    process.exit(1);
  }
  console.log(`${Object.keys(outputs).length} generated files match packages/design/src`);
} else {
  for (const [path, text] of Object.entries(outputs)) writeFileSync(join(REPO, path), text);
  console.log(`wrote ${Object.keys(outputs).join(', ')}`);
}
