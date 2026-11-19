#!/usr/bin/env node
// usage: affected.mjs --base <ref> [--head <ref>] [--list]
// Names the Maestro areas (folders of apps/mobile/.maestro/flows) whose screens a commit range
// reaches: each changed file, then every file that imports it, at the head commit, mapped to areas
// by apps/mobile/scripts/device/areas.json. A layout counts only when it changed itself, since it
// imports the chrome every screen shares and that chrome has its own row. --list prints only the
// areas, for parity.sh --affected.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TABLE_PATH = 'apps/mobile/scripts/device/areas.json';
const FLOWS = 'apps/mobile/.maestro/flows/';
const CODE = /\.(?:tsx?|jsx?|mjs|cjs)$/;
const EXTENSIONS = ['', '.ts', '.tsx', '.android.tsx', '.android.ts', '.native.tsx', '.native.ts', '.js', '.jsx', '.mjs', '.cjs', '.json'];
const INDEX = ['.ts', '.tsx', '.js'];
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"\n]+)['"]/g;

/** @returns {string[]} every module specifier a source file names, in order. */
export function parseImports(source) {
  return [...source.matchAll(IMPORT)].map((match) => match[1]);
}

/** `@repo/<name>[/sub]` → the file its package.json exports, else `src/<sub>` or `src/index.ts`. */
function exportTarget(spec, packages) {
  const [, scope, name, sub] = /^(@repo)\/([^/]+)(?:\/(.+))?$/.exec(spec) ?? [];
  if (!scope) return null;
  const exportsMap = packages[name]?.exports ?? {};
  const target = exportsMap[sub ? `./${sub}` : '.'];
  return posix.join('packages', name, typeof target === 'string' ? target : sub ? `src/${sub}` : 'src/index.ts');
}

/**
 * Resolves a specifier written in `from` to a tracked file, or null for a package outside the repo.
 * Handles relative paths, the app's `@/` alias, and `@repo/<pkg>` through the package's exports.
 */
export function resolveImport(from, spec, files, packages = {}) {
  let base;
  if (spec.startsWith('./') || spec.startsWith('../')) base = posix.join(posix.dirname(from), spec);
  else if (spec.startsWith('@/') && from.startsWith('apps/mobile/')) base = `apps/mobile/${spec.slice(2)}`;
  else base = exportTarget(spec, packages);
  if (!base) return null;
  for (const stem of new Set([base, base.replace(/\.js$/, '')])) {
    const candidates = [...EXTENSIONS.map((ext) => stem + ext), ...INDEX.map((ext) => `${stem}/index${ext}`)];
    const hit = candidates.find((path) => files.has(path));
    if (hit) return hit;
  }
  return null;
}

export function globToRegExp(glob) {
  const body = glob
    .split(/(\*\*\/|\*\*|\*)/)
    .map((part) =>
      part === '**/' ? '(?:.*/)?' : part === '**' ? '.*' : part === '*' ? '[^/]*' : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('');
  return new RegExp(`^${body}$`);
}

/** The areas the table names for one path; `*` stands for every area. */
export function tableAreas(path, table, allAreas) {
  if (path.startsWith(FLOWS)) {
    const area = path.slice(FLOWS.length).split('/')[0];
    return allAreas.includes(area) ? [area] : [];
  }
  const out = new Set();
  for (const [glob, areas] of Object.entries(table.areas)) {
    if (!globToRegExp(glob).test(path)) continue;
    for (const area of areas) for (const name of area === '*' ? allAreas : [area]) out.add(name);
  }
  return [...out];
}

/** Why render parity can't see this file's change, or null when it can. */
function pixelReason(path, imports, table) {
  const glob = table.pixels.files.find((pattern) => globToRegExp(pattern).test(path));
  if (glob) return `matches ${glob}`;
  const module = table.pixels.imports.find((name) => imports.some((spec) => spec === name || spec.startsWith(`${name}/`)));
  return module ? `imports ${module}` : null;
}

/**
 * @param {object} input
 * @param {string[]} input.changed paths the range touched, deleted ones included
 * @param {Map<string, string>} input.sources tracked code files at head, by path, with their text
 * @param {Set<string>} input.files every tracked path at head under apps/mobile and packages
 * @returns {{ areas: string[], pixels: string[], byFile: Map<string, string[]>, reasons: Map<string, string> }}
 *   the areas, the ones a change only pixels show reaches, each phone-reaching changed file's
 *   areas, and why render parity can't see a file's change
 */
export function affected({ changed, sources, files, packages, table, allAreas }) {
  const importers = new Map();
  for (const [path, source] of sources) {
    for (const spec of parseImports(source)) {
      const target = resolveImport(path, spec, files, packages);
      if (!target) continue;
      if (!importers.has(target)) importers.set(target, new Set());
      importers.get(target).add(path);
    }
  }
  const byFile = new Map();
  const reasons = new Map();
  const pixels = new Set();
  for (const start of changed) {
    const reached = new Set([start]);
    const queue = [start];
    while (queue.length) {
      for (const next of importers.get(queue.shift()) ?? []) {
        if (reached.has(next) || next.endsWith('/_layout.tsx')) continue;
        reached.add(next);
        queue.push(next);
      }
    }
    const areas = [...new Set([...reached].flatMap((path) => tableAreas(path, table, allAreas)))].sort();
    if (!areas.length) continue;
    byFile.set(start, areas);
    const reason = pixelReason(start, parseImports(sources.get(start) ?? ''), table);
    if (!reason) continue;
    reasons.set(start, reason);
    areas.forEach((area) => pixels.add(area));
  }
  const areas = [...new Set([...byFile.values()].flat())].sort();
  return { areas, pixels: areas.filter((area) => pixels.has(area)), byFile, reasons };
}

function git(...args) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/** Reads every code file under apps/mobile and packages at a commit in one `git cat-file`. */
function readTree(head) {
  const files = git('ls-tree', '-r', '--name-only', head, '--', 'apps/mobile', 'packages').split('\n').filter(Boolean);
  const code = files.filter((path) => CODE.test(path) && !/(^|\/)(__tests__|scripts)\//.test(path));
  const blob = execFileSync('git', ['-C', ROOT, 'cat-file', '--batch'], {
    input: code.map((path) => `${head}:${path}`).join('\n') + '\n',
    maxBuffer: 256 * 1024 * 1024,
  });
  const sources = new Map();
  let at = 0;
  for (const path of code) {
    const headerEnd = blob.indexOf(10, at);
    const size = Number(blob.subarray(at, headerEnd).toString().split(' ')[2]);
    sources.set(path, blob.subarray(headerEnd + 1, headerEnd + 1 + size).toString('utf8'));
    at = headerEnd + 1 + size + 1;
  }
  const packages = {};
  for (const path of files.filter((file) => /^packages\/[^/]+\/package\.json$/.test(file))) {
    packages[path.split('/')[1]] = JSON.parse(git('show', `${head}:${path}`));
  }
  return { files: new Set(files), sources, packages };
}

function main(argv) {
  const args = { head: 'HEAD', list: false, bad: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') args.base = argv[++i];
    else if (argv[i] === '--head') args.head = argv[++i];
    else if (argv[i] === '--list') args.list = true;
    else args.bad = true;
  }
  if (!args.base || args.bad) {
    console.error('usage: affected.mjs --base <ref> [--head <ref>] [--list]');
    process.exit(2);
  }
  const head = git('rev-parse', '--verify', `${args.head}^{commit}`).trim();
  const changed = git('diff', '--name-only', args.base, head).split('\n').filter(Boolean);
  const table = JSON.parse(readFileSync(join(ROOT, TABLE_PATH), 'utf8'));
  const allAreas = git('ls-tree', '--name-only', '-d', `${head}:${FLOWS}`)
    .split('\n')
    .filter((area) => area && area !== 'perf');
  const result = affected({ changed, table, allAreas, ...readTree(head) });
  if (args.list) {
    console.log(result.areas.join(' '));
    return;
  }
  for (const [path, areas] of result.byFile) {
    const reason = result.reasons.get(path);
    console.log(`${path} → ${areas.join(' ')}${reason ? `, pixels: ${reason}` : ''}`);
  }
  const covered = result.areas.filter((area) => !result.pixels.includes(area));
  console.log(`${changed.length} files changed, ${result.byFile.size} reach a phone screen`);
  console.log(`render parity covers: ${covered.join(' ') || 'none'}`);
  console.log(`needs pixels: ${result.pixels.join(' ') || 'none'}`);
  console.log(`areas: ${result.areas.join(' ') || 'none'}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
