#!/usr/bin/env node
/**
 * Lists modules under components/, hooks/, constants/, and assets/ that no live
 * file reaches. Every file outside those folders (app/ routes, lib/, config,
 * plugins, scripts) is a root; tests are neither roots nor reported.
 * Run: pnpm --filter moni lint:unreferenced
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const SCANNED = ['components', 'hooks', 'constants', 'assets'];
const SKIP_DIRS = new Set([
  'node_modules',
  'android',
  'ios',
  '.expo',
  'dist',
  'build',
  '.git',
]);
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css)$/;
const RESOLVE_EXT = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
];
const PLATFORMS = ['', '.android', '.ios', '.web', '.native'];
const SPECIFIER = /(['"`])((?:\.\.?|@)\/[^'"`\s$]*)\1/g;
const DYNAMIC = /\b(?:require|import)\(\s*(?!['"])[^)\s]/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const rel = (path) => relative(ROOT, path).split(sep).join('/');
const isTest = (path) =>
  /(^|\/)__tests__\//.test(path) || /\.test\.[jt]sx?$/.test(path);
const isScanned = (path) =>
  SCANNED.some((dir) => path.startsWith(`${dir}/`));

function candidates(base) {
  const found = [];
  for (const stem of [base, join(base, 'index')]) {
    for (const platform of PLATFORMS) {
      for (const ext of RESOLVE_EXT) {
        if (platform && !ext) continue;
        const path = `${stem}${platform}${ext}`;
        if (existsSync(path) && statSync(path).isFile())
          found.push(rel(path));
      }
    }
  }
  return found;
}

const files = walk(ROOT).map(rel);
const edges = new Map();
const dynamic = [];

for (const file of files) {
  if (!SOURCE_EXT.test(file)) continue;
  const text = readFileSync(join(ROOT, file), 'utf8');
  if (DYNAMIC.test(text) && !file.startsWith('scripts/'))
    dynamic.push(file);
  const targets = new Set();
  for (const [, , spec] of text.matchAll(SPECIFIER)) {
    const base = spec.startsWith('@/')
      ? join(ROOT, spec.slice(2))
      : resolve(dirname(join(ROOT, file)), spec);
    for (const target of candidates(base)) targets.add(target);
  }
  edges.set(file, targets);
}

const live = new Set();
const queue = files.filter(
  (file) => !isScanned(file) && !isTest(file),
);
while (queue.length > 0) {
  const file = queue.pop();
  if (live.has(file)) continue;
  live.add(file);
  for (const target of edges.get(file) ?? [])
    if (!isTest(target)) queue.push(target);
}

const unreferenced = files.filter(
  (file) => isScanned(file) && !isTest(file) && !live.has(file),
);

for (const file of dynamic)
  console.log(`dynamic import or require, check by hand: ${file}`);
for (const file of unreferenced.sort()) console.log(file);
console.log(`${unreferenced.length} unreferenced modules`);
process.exit(unreferenced.length > 0 ? 1 : 0);
