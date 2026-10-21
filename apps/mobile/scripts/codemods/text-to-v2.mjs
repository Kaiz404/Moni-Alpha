#!/usr/bin/env node
/**
 * Weight classes become font families because Android picks a custom font
 * file by family name, not fontWeight.
 * Run: node scripts/codemods/text-to-v2.mjs [--check]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TEXT_MODULE = join(ROOT, 'components/ui/text.tsx');

const WEIGHT_TO_FAMILY = [
  [/(?<![\w-])font-(?:thin|extralight|light|normal)(?![\w-])/g, 'font-display'],
  [/(?<![\w-])font-(?:medium|semibold)(?![\w-])/g, 'font-display-semibold'],
  [/(?<![\w-])font-(?:bold|extrabold|black)(?![\w-])/g, 'font-display-bold'],
];

const RN_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'react-native';?\n/g;

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function moveTextImport(source) {
  let textSpecifier = null;
  const rewritten = source.replace(RN_IMPORT, (statement, list) => {
    const specifiers = list
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const text = specifiers.find((s) => /^Text(\s+as\s+\w+)?$/.test(s));
    if (!text) return statement;
    textSpecifier = text;
    const rest = specifiers.filter((s) => s !== text);
    const multiline = list.includes('\n');
    const restImport =
      rest.length === 0
        ? ''
        : multiline
          ? `import {\n${rest.map((s) => `  ${s},`).join('\n')}\n} from 'react-native';\n`
          : `import { ${rest.join(', ')} } from 'react-native';\n`;
    return `${restImport}import { ${text} } from '@/components/ui/text';\n`;
  });
  return { rewritten, moved: textSpecifier !== null };
}

function transform(source) {
  let { rewritten } = moveTextImport(source);
  for (const [pattern, family] of WEIGHT_TO_FAMILY) rewritten = rewritten.replace(pattern, family);
  return rewritten;
}

const check = process.argv.includes('--check');
const changed = [];
for (const file of ['app', 'components'].flatMap((dir) => sourceFiles(join(ROOT, dir)))) {
  if (file === TEXT_MODULE) continue;
  const source = readFileSync(file, 'utf8');
  const next = transform(source);
  if (next === source) continue;
  changed.push(relative(ROOT, file));
  if (!check) writeFileSync(file, next);
}

console.log(`${check ? 'would change' : 'changed'} ${changed.length} files`);
for (const file of changed) console.log(`  ${file}`);
if (check && changed.length > 0) process.exit(1);
