#!/usr/bin/env node
/**
 * Puts every flow under .maestro/flows on the shared layout: it starts with
 * subflows/launch.yaml, which signs in when needed, and carries one seed tag.
 * Run: node scripts/codemods/maestro-flows.mjs [--check]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const FLOWS = join(ROOT, '.maestro/flows');
const LAUNCH = '- runFlow: ../../subflows/launch.yaml';
const SIGN_OUT = '- runFlow: ../../subflows/sign-out.yaml';
const SEED_TAGS = {
  'needs-default-seed': 'seed-full',
  'needs-pending-proposals': 'seed-full',
  'needs-heavy-seed': 'seed-full',
  'needs-empty-seed': 'seed-empty',
};
const SEED_ANY = new Set(['account/sign-in-states.yaml', 'review/notification.yaml']);
// The e2e mock answers these flows' AI calls (lib/ai/client/mock-fixtures.ts).
const MOCK_AI = new Set(['capture/say.yaml', 'capture/scan.yaml']);
const SIGNED_OUT_START = new Set(['account/sign-in-states.yaml']);

function blockEnd(lines, start) {
  let end = start + 1;
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++;
  return end;
}

export function migrate(name, source) {
  const [header, body] = source.split(/^---$/m);
  let lines = body.split('\n');

  const launch = lines.findIndex((line) => line === '- launchApp');
  if (launch >= 0) {
    const replacement = SIGNED_OUT_START.has(name) ? [LAUNCH, SIGN_OUT] : [LAUNCH];
    const next = launch + 1;
    const waitEnd = lines[next] === '- extendedWaitUntil:' ? blockEnd(lines, next) : next;
    const waitsForHome = waitEnd > next && lines.slice(next, waitEnd).some((line) => /id: home\.avatar$/.test(line));
    lines = [...lines.slice(0, launch), ...replacement, ...lines.slice(waitsForHome ? waitEnd : next)];
  }

  const headerLines = header.split('\n');
  const tagsAt = headerLines.indexOf('tags:');
  const tagLines = [];
  let tagsEnd = tagsAt + 1;
  if (tagsAt >= 0) while (/^\s+- /.test(headerLines[tagsEnd] ?? '')) tagLines.push(headerLines[tagsEnd++].trim().slice(2));
  let tags = tagLines.map((tag) => SEED_TAGS[tag] ?? tag).filter((tag) => !(MOCK_AI.has(name) && tag === 'needs-ai'));
  if (!tags.some((tag) => tag.startsWith('seed-'))) tags.push(SEED_ANY.has(name) ? 'seed-any' : 'seed-full');
  tags = [...new Set(tags)];
  const tagBlock = ['tags:', ...tags.map((tag) => `  - ${tag}`)];
  const newHeader =
    tagsAt >= 0
      ? [...headerLines.slice(0, tagsAt), ...tagBlock, ...headerLines.slice(tagsEnd)]
      : [...headerLines.slice(0, -1), ...tagBlock, headerLines.at(-1)];

  const run = newHeader.map((line) =>
    line.replace(/^# Run: scripts\/device\/with-device\.sh --lane \S+ -- maestro test (?:-e \S+ )*(\S+\.yaml)$/, '# Run: scripts/device/run-flows.sh $1'),
  );
  return `${run.join('\n')}---${lines.join('\n')}`;
}

function flowFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? flowFiles(join(dir, entry.name)) : entry.name.endsWith('.yaml') ? [join(dir, entry.name)] : [],
  );
}

const check = process.argv.includes('--check');
let changed = 0;
for (const path of flowFiles(FLOWS)) {
  const name = relative(FLOWS, path);
  const before = readFileSync(path, 'utf8');
  const after = migrate(name, before);
  if (after === before) continue;
  changed++;
  if (check) console.log(`would change ${name}`);
  else writeFileSync(path, after);
}
console.log(`${changed} flows ${check ? 'need' : 'got'} the shared layout`);
process.exitCode = check && changed ? 1 : 0;
