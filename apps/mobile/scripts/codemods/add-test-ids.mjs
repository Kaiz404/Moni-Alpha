#!/usr/bin/env node
/**
 * Gives every control in CONTROLS (check-test-ids.mjs) that has no testID a
 * tid() testID named from its label, accessibilityLabel, placeholder, text, or
 * handler. A control with nothing to name it by is listed, not guessed.
 * Run: node scripts/codemods/add-test-ids.mjs [--check] [files...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

import { CONTROLS } from '../lint/check-test-ids.mjs';
import { MOBILE_ROOT, sourceFiles } from '../lint/ratchet.mjs';
import {
  attribute,
  partsFor,
  screenFor,
  tidCall,
} from './test-id-names.mjs';

const TID_IMPORT = "import { tid } from '@/lib/test-ids';";

function transform(file, source) {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const screen = screenFor(file);
  const used = new Set();
  const inserts = [];
  const unnamed = [];
  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : node;
      const control = opening.tagName.getText(sf).split('.').pop();
      if (CONTROLS.includes(control) && !attribute(node, 'testID')) {
        const parts = partsFor(node, null);
        if (parts.part) {
          inserts.push({
            at: opening.tagName.getEnd(),
            text: ` testID={${tidCall(screen, parts, used)}}`,
          });
        } else {
          const { line } = sf.getLineAndCharacterOfPosition(
            opening.getStart(sf),
          );
          unnamed.push(`${file}:${line + 1}: ${control}`);
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
  if (inserts.length === 0) return { next: source, unnamed };

  if (
    !/import\s*\{[^}]*\btid\b[^}]*\}\s*from\s*'@\/lib\/test-ids'/.test(
      source,
    )
  ) {
    const lastImport = sf.statements
      .filter(ts.isImportDeclaration)
      .at(-1);
    inserts.push({
      at: lastImport.getEnd(),
      text: `\n${TID_IMPORT}`,
    });
  }
  let next = source;
  for (const { at, text } of inserts.sort((a, b) => b.at - a.at))
    next = next.slice(0, at) + text + next.slice(at);
  return { next, unnamed };
}

const check = process.argv.includes('--check');
const only = process.argv
  .slice(2)
  .filter((arg) => !arg.startsWith('--'));
const changed = [];
const unnamed = [];
for (const file of only.length ? only : sourceFiles()) {
  const path = join(MOBILE_ROOT, file);
  const source = readFileSync(path, 'utf8');
  const result = transform(file, source);
  unnamed.push(...result.unnamed);
  if (result.next === source) continue;
  changed.push(file);
  if (!check) writeFileSync(path, result.next);
}

console.log(
  `${check ? 'would change' : 'changed'} ${changed.length} files`,
);
for (const file of changed) console.log(`  ${file}`);
if (unnamed.length)
  console.log(
    `nothing to name these by, add a testID by hand:\n${unnamed.map((u) => `  ${u}`).join('\n')}`,
  );
if (check && changed.length > 0) process.exitCode = 1;
