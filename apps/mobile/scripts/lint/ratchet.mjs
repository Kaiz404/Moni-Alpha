import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MOBILE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const SOURCE_ROOTS = ['app', 'components'];

export function sourceFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name !== '__tests__' &&
          entry.name !== 'node_modules'
        )
          walk(path);
      } else if (
        /\.tsx?$/.test(entry.name) &&
        !entry.name.endsWith('.d.ts')
      ) {
        files.push(relative(MOBILE_ROOT, path).split(sep).join('/'));
      }
    }
  };
  for (const root of SOURCE_ROOTS) walk(join(MOBILE_ROOT, root));
  return files.sort();
}

export function readSource(file) {
  return readFileSync(join(MOBILE_ROOT, file), 'utf8');
}

export function parseList(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

export function readList(listPath) {
  return existsSync(listPath)
    ? parseList(readFileSync(listPath, 'utf8'))
    : [];
}

export function writeList(listPath, header, entries) {
  const body = [...new Set(entries)].sort();
  writeFileSync(
    listPath,
    [...header.map((line) => `# ${line}`), ...body, ''].join('\n'),
  );
}

// The list a commit started from. LINT_BASE_REF names it in CI; locally it is origin/main.
// A ref or file that does not exist yet means the list is landing for the first time.
export function baseList(listPath) {
  const ref = process.env.LINT_BASE_REF || 'origin/main';
  const path = relative(MOBILE_ROOT, listPath).split(sep).join('/');
  try {
    const text = execFileSync('git', ['show', `${ref}:./${path}`], {
      cwd: MOBILE_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { ref, entries: parseList(text) };
  } catch {
    return { ref, entries: null };
  }
}

// A ratchet list names the known violations that may stay for now. Every current violation must be
// listed, every listed entry must still be a violation, and the list may not grow past its base.
export function ratchet({ current, listed, base }) {
  const listedSet = new Set(listed);
  const currentSet = new Set(current);
  return {
    unlisted: [...currentSet].filter((key) => !listedSet.has(key)),
    stale: [...listedSet].filter((key) => !currentSet.has(key)),
    grownBy:
      base === null ? 0 : Math.max(0, listed.length - base.length),
  };
}
