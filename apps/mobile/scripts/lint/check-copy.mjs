import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { termsIn } from './copy-rules.mjs';
import {
  MOBILE_ROOT,
  baseList,
  ratchet,
  readList,
  readSource,
  sourceFiles,
  writeList,
} from './ratchet.mjs';

const ALLOW_PATH = join(
  MOBILE_ROOT,
  'scripts',
  'lint',
  'copy-allow.txt',
);

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
  const add = (node, text) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    texts.push({ line: line + 1, text: clean });
  };
  const visit = (node) => {
    switch (node.kind) {
      case ts.SyntaxKind.JsxText:
        add(node, node.text);
        break;
      case ts.SyntaxKind.StringLiteral:
        if (displaySlot(node)) add(node, node.text);
        break;
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.TemplateExpression:
        if (displaySlot(node)) add(node, templateText(node));
        break;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return texts;
}

export function copyHits(file, source) {
  return copyTexts(file, source).flatMap(({ line, text }) =>
    termsIn(text).map(({ term, reason }) => ({
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
  const hits = sourceFiles().flatMap((file) =>
    copyHits(file, readSource(file)),
  );
  if (process.argv.includes('--write')) {
    writeList(
      ALLOW_PATH,
      [
        'v1 copy that breaks docs/redesign/glossary.md and may stay until its screen is rebuilt.',
        'Entries are `<file>: <term>: <text>`. The list only shrinks.',
        'Regenerate: pnpm --filter moni lint:copy --write',
      ],
      hits.map(allowKey),
    );
  }
  const { ref, entries: base } = baseList(ALLOW_PATH);
  const { newHits, stale, grownBy } = checkCopy({
    hits,
    allow: readList(ALLOW_PATH),
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
      `copy-allow.txt grew by ${grownBy} entries over ${ref}`,
    );
  if (base === null)
    console.log(
      `no copy-allow.txt at ${ref}, nothing to compare its size with`,
    );
  const allowed = hits.length - newHits.length;
  console.log(
    `${newHits.length} new copy hits, ${allowed} allowed v1 hits`,
  );
  process.exitCode =
    newHits.length || stale.length || grownBy ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
)
  main();
