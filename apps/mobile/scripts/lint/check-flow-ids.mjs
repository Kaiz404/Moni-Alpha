import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { MOBILE_ROOT } from './ratchet.mjs';

const CODE_ROOTS = ['app', 'components', 'lib'];
const FLOW_ROOT = '.maestro';
// tid() kebab-cases every part, so a part computed at runtime renders as one of these.
const DYNAMIC_PART = '[a-z0-9-]+';
const DYNAMIC_SCREEN = '[a-z-]+';
const SAMPLE_PART = 'abc-123';

function walk(dir, keep) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '__tests__')
        files.push(...walk(path, keep));
    } else if (keep(entry.name)) files.push(path);
  }
  return files;
}

function kebab(part) {
  return String(part)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function partValues(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return [kebab(node.text)];
  if (ts.isNumericLiteral(node)) return [kebab(node.text)];
  if (ts.isParenthesizedExpression(node)) return partValues(node.expression);
  if (ts.isConditionalExpression(node)) {
    const a = partValues(node.whenTrue);
    const b = partValues(node.whenFalse);
    return a && b ? [...a, ...b] : null;
  }
  return null;
}

// tid(testID, 'edit') extends an id the caller passed in, so it can render under any prefix.
function isPassedTestId(node) {
  return ts.isIdentifier(node) && /testid$/i.test(node.text);
}

export function tidTemplates(file, source) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const templates = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'tid' &&
      node.arguments.length >= 2
    ) {
      const parts = node.arguments.map((arg, index) =>
        ts.isSpreadElement(arg) || (index === 0 && isPassedTestId(arg))
          ? 'spread'
          : index === 0 && !partValues(arg)
            ? 'screen'
            : partValues(arg),
      );
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      templates.push({ file, line: line + 1, parts });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return templates;
}

function partPattern(part) {
  if (part === 'spread') return '.+';
  if (part === 'screen') return DYNAMIC_SCREEN;
  if (part === null) return DYNAMIC_PART;
  return `(?:${part.map(escapeRegex).join('|')})`;
}

export function compileTemplate(template) {
  return { ...template, regex: new RegExp(`^${template.parts.map(partPattern).join('\\.')}$`) };
}

function renderings(parts, pool, spreadPool = pool) {
  let ids = [''];
  for (const part of parts) {
    const values = part === 'spread' ? spreadPool : part === null || part === 'screen' ? pool : part;
    ids = ids.flatMap((prefix) => values.map((value) => (prefix ? `${prefix}.${value}` : value))).slice(0, 4096);
  }
  return ids;
}

// Maestro reads `id:` as a regex.
export function idMatches(flowId, compiled) {
  const literal = flowId.replace(/\\\./g, '.');
  if (/^[A-Za-z0-9._-]+$/.test(literal))
    return compiled.some((template) => template.regex.test(literal));
  let pattern;
  try {
    pattern = new RegExp(`^(?:${flowId})$`);
  } catch {
    return false;
  }
  const segments = flowId.split('\\.').filter((segment) => /^[a-z0-9-]+$/.test(segment));
  const pool = [...new Set([...segments, SAMPLE_PART, '2026-10', '0'])];
  const prefixes = segments.map((_, end) => segments.slice(0, end + 1).join('.'));
  const spreadPool = [...new Set([...pool, ...prefixes, ...prefixes.map((prefix) => `${prefix}.${SAMPLE_PART}`)])];
  return compiled.some((template) =>
    renderings(template.parts, pool, spreadPool).some((id) => pattern.test(id)),
  );
}

export function flowIds(source) {
  const ids = [];
  source.split('\n').forEach((text, index) => {
    const match = /^\s*(?:-\s+)?id:\s*(.+?)\s*$/.exec(text);
    if (!match) return;
    const value = match[1].replace(/\s+#.*$/, '');
    const unquoted = /^'(.*)'$/.exec(value)?.[1].replace(/''/g, "'") ?? /^"(.*)"$/.exec(value)?.[1].replace(/\\\\/g, '\\') ?? value;
    ids.push({ line: index + 1, id: unquoted });
  });
  return ids;
}

export function unknownFlowIds(flowFiles, codeFiles) {
  const compiled = codeFiles.flatMap(({ file, source }) => tidTemplates(file, source)).map(compileTemplate);
  return flowFiles.flatMap(({ file, source }) =>
    flowIds(source)
      .filter(({ id }) => !idMatches(id, compiled))
      .map(({ line, id }) => ({ file, line, id })),
  );
}

function main() {
  const rel = (path) => relative(MOBILE_ROOT, path).split(sep).join('/');
  const codeFiles = CODE_ROOTS.flatMap((root) =>
    walk(join(MOBILE_ROOT, root), (name) => /\.tsx?$/.test(name) && !name.endsWith('.d.ts')),
  ).map((path) => ({ file: rel(path), source: readFileSync(path, 'utf8') }));
  const flowFiles = walk(join(MOBILE_ROOT, FLOW_ROOT), (name) => name.endsWith('.yaml')).map((path) => ({
    file: rel(path),
    source: readFileSync(path, 'utf8'),
  }));
  const unknown = unknownFlowIds(flowFiles, codeFiles);
  for (const { file, line, id } of unknown) console.log(`${file}:${line}: no tid() renders ${id}`);
  const total = flowFiles.reduce((sum, { source }) => sum + flowIds(source).length, 0);
  console.log(`${unknown.length} of ${total} flow ids in ${flowFiles.length} flows match no tid() call`);
  process.exitCode = unknown.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
