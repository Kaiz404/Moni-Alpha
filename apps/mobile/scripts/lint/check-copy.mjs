import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { termsIn } from './copy-rules.mjs';
import {
  MOBILE_ROOT,
  baseList,
  ratchet,
  readList,
  writeList,
} from './ratchet.mjs';

const REPO_ROOT = join(MOBILE_ROOT, '..', '..');

// Each app's copy, with its own allow list. The packages both apps share are checked with the phone.
const TARGETS = {
  mobile: {
    roots: [
      'apps/mobile/app',
      'apps/mobile/components',
      'apps/mobile/lib',
      ...readdirSync(join(REPO_ROOT, 'packages')).map(
        (name) => `packages/${name}/src`,
      ),
    ],
    allow: join(MOBILE_ROOT, 'scripts', 'lint', 'copy-allow.txt'),
    command: 'pnpm --filter moni lint:copy',
  },
  web: {
    roots: ['apps/web/src'],
    allow: join(REPO_ROOT, 'apps', 'web', 'scripts', 'copy-allow.txt'),
    command: 'pnpm --filter web lint:copy',
  },
};

function sourceFiles(roots) {
  const files = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['__tests__', 'node_modules', 'generated'].includes(entry.name))
          walk(path);
      } else if (
        /\.(tsx?|m?js)$/.test(entry.name) &&
        !/\.(d|test|spec)\.[tj]sx?$/.test(entry.name)
      ) {
        files.push(relative(REPO_ROOT, path).split(sep).join('/'));
      }
    }
  };
  for (const root of roots) walk(join(REPO_ROOT, root));
  return files.sort();
}

// Slots whose string is shown or read aloud. Any other attribute or property (className, name of an
// icon, testID, route names) holds code, not copy.
const DISPLAY_SLOT =
  /(label|title|text|placeholder|hint|message|description|caption|heading|alt|children)$/i;

const PASS_THROUGH = new Set([
  ts.SyntaxKind.ParenthesizedExpression,
  ts.SyntaxKind.AsExpression,
  ts.SyntaxKind.SatisfiesExpression,
  ts.SyntaxKind.NonNullExpression,
  ts.SyntaxKind.TemplateSpan,
  ts.SyntaxKind.TemplateExpression,
  ts.SyntaxKind.ArrayLiteralExpression,
  ts.SyntaxKind.ObjectLiteralExpression,
]);

const VALUE_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.PlusToken,
]);

// A string reaches the screen when its value flows, unchanged, into JSX children or a display
// attribute. A call argument, a comparison operand, or a condition does not.
function displaySlot(node) {
  let slot = null;
  for (
    let child = node, parent = node.parent;
    parent;
    child = parent, parent = parent.parent
  ) {
    if (PASS_THROUGH.has(parent.kind)) continue;
    switch (parent.kind) {
      case ts.SyntaxKind.ConditionalExpression:
        if (child === parent.condition) return null;
        continue;
      case ts.SyntaxKind.BinaryExpression:
        if (!VALUE_OPERATORS.has(parent.operatorToken.kind))
          return null;
        continue;
      case ts.SyntaxKind.PropertyAssignment:
        if (child !== parent.initializer) return null;
        slot ??= parent.name.getText();
        continue;
      case ts.SyntaxKind.JsxAttribute:
        slot ??= parent.name.getText();
        return DISPLAY_SLOT.test(slot) ? slot : null;
      case ts.SyntaxKind.JsxExpression:
        if (parent.parent.kind === ts.SyntaxKind.JsxAttribute)
          continue;
        slot ??= 'children';
        return DISPLAY_SLOT.test(slot) ? slot : null;
      default:
        return null;
    }
  }
  return null;
}

function templateText(node) {
  if (node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral)
    return node.text;
  return (
    node.head.text +
    node.templateSpans
      .map((span) => `{}${span.literal.text}`)
      .join('')
  );
}

function copyTexts(fileName, source) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const texts = [];
  const add = (node, text, shown) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    texts.push({ line: line + 1, text: clean, shown });
  };
  const visit = (node) => {
    switch (node.kind) {
      case ts.SyntaxKind.JsxText:
        add(node, node.text, true);
        break;
      case ts.SyntaxKind.StringLiteral:
        add(node, node.text, Boolean(displaySlot(node)));
        break;
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.TemplateExpression:
        add(node, templateText(node), Boolean(displaySlot(node)));
        break;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return texts;
}

export function copyHits(file, source) {
  return copyTexts(file, source).flatMap(({ line, text, shown }) =>
    termsIn(text, { shown }).map(({ term, reason }) => ({
      file,
      line,
      term,
      reason,
      text,
    })),
  );
}

export const allowKey = ({ file, term, text }) =>
  `${file}: ${term}: ${text}`;

export function checkCopy({ hits, allow, base }) {
  const result = ratchet({
    current: hits.map(allowKey),
    listed: allow,
    base,
  });
  const unlisted = new Set(result.unlisted);
  return {
    ...result,
    newHits: hits.filter((hit) => unlisted.has(allowKey(hit))),
  };
}

function main() {
  const name = process.argv.find((arg) => arg in TARGETS) ?? 'mobile';
  const target = TARGETS[name];
  const hits = sourceFiles(target.roots).flatMap((file) =>
    copyHits(file, readFileSync(join(REPO_ROOT, file), 'utf8')),
  );
  if (process.argv.includes('--write')) {
    writeList(
      target.allow,
      [
        'v1 copy that breaks docs/redesign/glossary.md and may stay until its screen is rebuilt.',
        'Entries are `<file>: <term>: <text>`. The list only shrinks.',
        `Regenerate: ${target.command} --write`,
      ],
      hits.map(allowKey),
    );
  }
  const { ref, entries: base } = baseList(target.allow);
  const { newHits, stale, grownBy } = checkCopy({
    hits,
    allow: readList(target.allow),
    base,
  });
  for (const hit of newHits) {
    console.log(
      `${hit.file}:${hit.line}: ${hit.term}: ${hit.text}  (${hit.reason})`,
    );
  }
  for (const entry of stale)
    console.log(`stale allow entry: ${entry}`);
  if (grownBy)
    console.log(
      `${relative(REPO_ROOT, target.allow)} grew by ${grownBy} entries over ${ref}`,
    );
  const allowed = hits.length - newHits.length;
  console.log(
    `${name}: ${newHits.length} new copy hits, ${allowed} allowed v1 hits`,
  );
  process.exitCode =
    newHits.length || stale.length || grownBy ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
)
  main();
