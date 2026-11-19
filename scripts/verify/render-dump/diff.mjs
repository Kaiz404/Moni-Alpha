#!/usr/bin/env node
// usage: diff.mjs <base dump dir> <head dump dir>
// Prints each route `same`, or its changed lines; variants whose diff is identical (light and dark
// usually) print once. Exit 1 when any route changed, appeared, or went missing.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const MAX_LINES = 16;
const [baseDir, headDir] = process.argv.slice(2);
if (!baseDir || !headDir) {
  console.error('usage: diff.mjs <base dump dir> <head dump dir>');
  process.exit(2);
}

function dumps(dir) {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)));
  return new Set(files);
}

/** `(tabs)/index.full.light.json` → [`(tabs)/index`, `full.light`] */
function split(file) {
  const match = /^(.*)\.((?:full|empty)\.(?:light|dark))\.json$/.exec(file);
  return match ? [match[1], match[2]] : [file, ''];
}

function changedLines(a, b) {
  const { stdout } = spawnSync('diff', ['-U0', a, b], { encoding: 'utf8' });
  return stdout
    .split('\n')
    .filter((line) => /^[-+]/.test(line) && !/^(---|\+\+\+) /.test(line))
    .map((line) => line.replace(/,$/, ''));
}

const base = dumps(baseDir);
const head = dumps(headDir);
const routes = new Map();
for (const file of new Set([...base, ...head])) {
  const [route, variant] = split(file);
  if (!routes.has(route)) routes.set(route, []);
  routes.get(route).push({ file, variant });
}

let changed = 0;
for (const route of [...routes.keys()].sort()) {
  const groups = new Map();
  for (const { file, variant } of routes.get(route).sort((x, y) => x.variant.localeCompare(y.variant))) {
    let body;
    if (!base.has(file)) body = ['+ new on head'];
    else if (!head.has(file)) body = ['- missing on head'];
    else body = changedLines(join(baseDir, file), join(headDir, file));
    if (!body.length) continue;
    const key = body.join('\n');
    groups.set(key, [...(groups.get(key) ?? []), variant]);
  }
  if (!groups.size) {
    console.log(`${route} same`);
    continue;
  }
  changed += 1;
  console.log(`${route} CHANGED`);
  for (const [key, variants] of groups) {
    const lines = key.split('\n');
    console.log(`  ${variants.join(', ')}`);
    for (const line of lines.slice(0, MAX_LINES)) console.log(`    ${line}`);
    if (lines.length > MAX_LINES) console.log(`    … ${lines.length - MAX_LINES} more lines`);
  }
}
if (!routes.size) {
  console.log('no dumps to compare');
  process.exit(1);
}
console.log(`${changed} of ${routes.size} routes changed`);
process.exit(changed ? 1 : 0);
