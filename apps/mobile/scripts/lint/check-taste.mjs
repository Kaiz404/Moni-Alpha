import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import {
  MOBILE_ROOT,
  baseList,
  ratchet,
  readList,
  writeList,
} from './ratchet.mjs';

// The owner's design rules a parser can see, from .claude/skills/moni-taste/SKILL.md. Copy rules
// (words, money format) live in copy-rules.mjs; this file checks code shapes on both apps.

const REPO_ROOT = join(MOBILE_ROOT, '..', '..');
const ALLOW_PATH = join(MOBILE_ROOT, 'scripts', 'lint', 'taste-allow.txt');
const ROOTS = {
  mobile: ['apps/mobile/app', 'apps/mobile/components', 'apps/mobile/lib'],
  web: ['apps/web/src'],
};

const SPARKLE_NAME =
  /^(creation(-outline)?|star-four-points(-outline|-small)?|shimmer|auto-fix|robot(-outline|-happy(-outline)?)?)$/;
const SPARKLE_MDI = /^mdi(Creation|StarFourPoints|Shimmer|AutoFix|Robot)/;
const NATIVE_INPUT_TYPES = new Set(['date', 'month', 'week', 'time', 'datetime-local']);

const isString = (node) =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

const stringParts = (node) => {
  if (isString(node) || ts.isJsxText(node)) return [node.text];
  if (ts.isTemplateExpression(node))
    return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
  return [];
};

const inConsole = (node) => {
  for (let n = node.parent; n; n = n.parent)
    if (ts.isCallExpression(n) && n.expression.getText().startsWith('console.'))
      return true;
  return false;
};

const jsxTag = (node) =>
  ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
    ? node.tagName.getText()
    : null;

const jsxAttr = (node, name) => {
  const attr = node.attributes.properties.find(
    (p) => ts.isJsxAttribute(p) && p.name.getText() === name,
  );
  const init = attr?.initializer;
  if (!init) return null;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression && isString(init.expression))
    return init.expression.text;
  return null;
};

/** The `const name = …` this file declares, so a label held in a variable is read through it. */
const declared = (node, name) => {
  let found = null;
  const visit = (n) => {
    if (found) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer)
      found = n.initializer;
    else ts.forEachChild(n, visit);
  };
  visit(node.getSourceFile());
  return found;
};

/** A label built from the form's values: a template with a value in it, a call given one, or a variable holding either. */
const carriesValue = (node, depth = 0) => {
  if (!node || depth > 4) return false;
  if (ts.isParenthesizedExpression(node)) return carriesValue(node.expression, depth);
  if (ts.isTemplateExpression(node)) return true;
  if (ts.isCallExpression(node)) return node.arguments.length > 0;
  if (ts.isConditionalExpression(node))
    return carriesValue(node.whenTrue, depth) || carriesValue(node.whenFalse, depth);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)
    return !isString(node.left) || !isString(node.right);
  if (ts.isIdentifier(node)) return carriesValue(declared(node, node.text), depth + 1);
  return false;
};

const attrExpression = (node, name) => {
  const attr = node.attributes.properties.find(
    (p) => ts.isJsxAttribute(p) && p.name.getText() === name,
  );
  const init = attr?.initializer;
  return init && ts.isJsxExpression(init) ? init.expression : null;
};

/** The phone's primary buttons: `<Button label>` and a page's pinned `action={{ label }}`. */
const phoneButtonLabel = (node) => {
  const tag = jsxTag(node);
  if (!tag) return null;
  if (tag === 'Button') return attrExpression(node, 'label');
  const action = attrExpression(node, 'action');
  if (!action || !ts.isObjectLiteralExpression(action)) return null;
  const label = action.properties.find(
    (p) => ts.isPropertyAssignment(p) && p.name.getText() === 'label',
  );
  return label?.initializer ?? null;
};

/** The web's buttons: a `<button className="btn …">` and the words inside it. */
const webButtonLabels = (node) => {
  if (!ts.isJsxElement(node) || node.openingElement.tagName.getText() !== 'button') return [];
  if (!/(^|\s)btn(\s|$)/.test(jsxAttr(node.openingElement, 'className') ?? '')) return [];
  return node.children.flatMap((child) =>
    ts.isJsxExpression(child) && child.expression ? [child.expression] : [],
  );
};

export const RULES = [
  {
    rule: 'value in button',
    apps: ['mobile', 'web'],
    reason:
      "a button says a short fixed verb, never the form's values (a name, an amount, a date): the page shows them, and a long one truncates the button (#137)",
    test: (node, app) =>
      app === 'web'
        ? webButtonLabels(node).some((label) => carriesValue(label))
        : carriesValue(phoneButtonLabel(node)),
  },
  {
    rule: 'sparkle icon',
    apps: ['mobile', 'web'],
    reason:
      "Moni's mark is the cat (Mascot, MoniGlyph, webkit.moni()); never a sparkle, wand or robot glyph",
    test: (node) =>
      (isString(node) && SPARKLE_NAME.test(node.text)) ||
      (ts.isIdentifier(node) && SPARKLE_MDI.test(node.text)),
  },
  {
    rule: 'confirm dialog',
    apps: ['mobile', 'web'],
    reason:
      "a confirmation is the confirm sheet (openSheet({ kind: 'confirm' }) on the phone, the web's confirm sheet), never a system dialog",
    test: (node) => {
      if (!ts.isCallExpression(node)) return false;
      const callee = node.expression.getText();
      if (callee === 'Alert.alert') return node.arguments.length >= 3;
      return callee === 'window.confirm';
    },
  },
  {
    rule: 'text arrow',
    apps: ['mobile', 'web'],
    reason: 'no → in copy; draw the arrow-right icon between the two parts (#39)',
    test: (node) =>
      stringParts(node).some((text) => text.includes('→')) && !inConsole(node),
  },
  {
    rule: 'native control',
    apps: ['web'],
    reason:
      "no browser <select> or date input; use the app's picker popover and calendar (#99 #101 #107)",
    test: (node) => {
      const tag = jsxTag(node);
      if (tag === 'select') return true;
      return tag === 'input' && NATIVE_INPUT_TYPES.has(jsxAttr(node, 'type'));
    },
  },
];

export function tasteHits(file, source, app) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const rules = RULES.filter(({ apps }) => apps.includes(app));
  const hits = [];
  const visit = (node) => {
    for (const { rule, reason, test } of rules) {
      if (!test(node, app)) continue;
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      hits.push({ file, line: line + 1, rule, reason });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return hits;
}

function sourceFiles(roots) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['__tests__', 'node_modules'].includes(entry.name)) walk(path);
      } else if (
        /\.tsx?$/.test(entry.name) &&
        !/\.(d|test|spec|generated)\.tsx?$/.test(entry.name)
      ) {
        files.push(relative(REPO_ROOT, path).split(sep).join('/'));
      }
    }
  };
  for (const root of roots) walk(join(REPO_ROOT, root));
  return files.sort();
}

// One entry per file and rule, so another lane rewording a listed line does not trip the ratchet.
export const allowKey = ({ file, rule }) => `${file}: ${rule}`;

function main() {
  const hits = Object.entries(ROOTS).flatMap(([app, roots]) =>
    sourceFiles(roots).flatMap((file) =>
      tasteHits(file, readFileSync(join(REPO_ROOT, file), 'utf8'), app),
    ),
  );
  if (process.argv.includes('--write')) {
    writeList(
      ALLOW_PATH,
      [
        'Known breaks of the moni-taste rules. Open issues: text arrow #110, native control #99 #101 #107. The list only shrinks.',
        'Entries are `<file>: <rule>`. Regenerate: pnpm --filter moni lint:taste --write',
      ],
      hits.map(allowKey),
    );
  }
  const listed = readList(ALLOW_PATH);
  const { ref, entries: base } = baseList(ALLOW_PATH);
  const { unlisted, stale, grownBy } = ratchet({
    current: hits.map(allowKey),
    listed,
    base,
  });
  const fresh = new Set(unlisted);
  const newHits = hits.filter((hit) => fresh.has(allowKey(hit)));
  for (const hit of newHits)
    console.log(`${hit.file}:${hit.line}: ${hit.rule} (${hit.reason})`);
  for (const entry of stale) console.log(`stale allow entry: ${entry}`);
  if (grownBy) console.log(`taste-allow.txt grew by ${grownBy} entries over ${ref}`);
  console.log(
    `${newHits.length} new taste hits, ${hits.length - newHits.length} allowed`,
  );
  process.exitCode = newHits.length || stale.length || grownBy ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
