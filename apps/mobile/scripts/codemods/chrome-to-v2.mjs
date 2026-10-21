#!/usr/bin/env node
/**
 * Moves callers off the v1 chrome (ScreenShell + BrandHeader, PrimaryButton,
 * IconAction, TactilePressable, Surface, SquircleView) onto Page, Button,
 * HeaderIconButton, Press, and plain Views, giving each control a tid() testID.
 * It prints what it leaves for a hand edit.
 * Run: node scripts/codemods/chrome-to-v2.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

import { MOBILE_ROOT, sourceFiles } from '../lint/ratchet.mjs';
import { attribute, partsFor, screenFor, tidCall } from './test-id-names.mjs';

const LEGACY = {
  'tactile-pressable': ['TactilePressable'],
  'primary-button': ['PrimaryButton'],
  'icon-action': ['IconAction'],
  'brand-header': ['BrandHeader'],
  'screen-shell': ['ScreenShell'],
  surface: ['Surface'],
  'squircle-view': ['SquircleView', 'squircleSmoothing'],
};
const LEGACY_FILES = new Set(Object.keys(LEGACY).map((name) => `components/ui/${name}.tsx`));

const NEW_IMPORTS = {
  Page: "import { Page } from '@/components/ui/page';",
  Button: "import { Button } from '@/components/ui/button';",
  HeaderIconButton: "import { HeaderIconButton } from '@/components/ui/header-icon-button';",
  Press: "import { Press } from '@/components/ui/press';",
  tid: "import { tid } from '@/lib/test-ids';",
};

// Surface tones as v2 roles; Surface drew a 22 squircle, v2 cards are 26.
const SURFACE_TONE = {
  default: 'bg-card',
  muted: 'bg-sand',
  raised: 'bg-card',
  tray: 'bg-sand-light',
  aqua: 'bg-accent-aqua/30',
  lilac: 'bg-accent-lilac/30',
  peach: 'bg-accent-peach/30',
  lemon: 'bg-accent-lemon/30',
  coral: 'bg-accent-coral/30',
};

// One step darker than the rest fill, per V2F-Components.
const PRESSED_FILL = [
  [/\bbg-primary\b(?!-)/, 'bg-primary-pressed'],
  [/\bbg-(sand|surface-2|primary-muted)\b/, 'bg-hairline'],
];

const TASK_PAGES = new Set(['app/proposal/[id].tsx']);

function legacyModule(specifier) {
  const match = /(?:^@\/components\/ui\/|^\.\/)([\w-]+)$/.exec(specifier);
  return match && LEGACY[match[1]] ? match[1] : null;
}

function literalText(initializer) {
  if (!initializer) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  const expression = initializer.expression;
  if (expression && (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)))
    return expression.text;
  return null;
}

// Page lifts BrandHeader props as text, so it runs after the controls inside them are rewritten.
const PHASES = [
  (tag) => tag !== 'ScreenShell' && tag !== 'BrandHeader',
  (tag) => tag === 'ScreenShell' || tag === 'BrandHeader',
];

function transform(file, source, inPhase) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const notes = [];
  const used = new Set();
  const needs = new Set();
  const screen = screenFor(file);
  let needsView = false;

  const edit = (start, end, text) => edits.push({ start, end, text });
  const remove = (node) => edit(node.getFullStart(), node.getEnd(), '');
  const rename = (element, name) => {
    const opening = ts.isJsxElement(element) ? element.openingElement : element;
    edit(opening.tagName.getStart(sf), opening.tagName.getEnd(), name);
    if (ts.isJsxElement(element))
      edit(element.closingElement.tagName.getStart(sf), element.closingElement.tagName.getEnd(), name);
  };
  const attributesOf = (element) =>
    (ts.isJsxElement(element) ? element.openingElement : element).attributes;
  const addAttribute = (element, text) => {
    const opening = ts.isJsxElement(element) ? element.openingElement : element;
    edit(opening.tagName.getEnd(), opening.tagName.getEnd(), ` ${text}`);
  };
  const addTestId = (element, fallback) => {
    if (attribute(element, 'testID')) return;
    needs.add('tid');
    addAttribute(element, `testID={${tidCall(screen, partsFor(element, fallback), used)}}`);
  };
  const prefixClass = (element, classes) => {
    const found = attribute(element, 'className');
    const existing = found?.initializer?.getText(sf) ?? '';
    // The caller's own radius or fill wins, as it did over Surface's.
    const prefix = classes
      .split(' ')
      .filter((c) => !new RegExp(`[\\s"'\`]${c.split('-')[0]}-`).test(existing))
      .join(' ');
    if (!prefix) return;
    if (!found) return addAttribute(element, `className="${prefix}"`);
    const init = found.initializer;
    if (ts.isStringLiteral(init)) return edit(init.getStart(sf) + 1, init.getStart(sf) + 1, `${prefix} `);
    const expression = init.expression;
    if (ts.isTemplateExpression(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
      return edit(expression.getStart(sf) + 1, expression.getStart(sf) + 1, `${prefix} `);
    edit(expression.getStart(sf), expression.getEnd(), `\`${prefix} \${${expression.getText(sf)}}\``);
  };
  const classText = (element) => {
    const found = attribute(element, 'className');
    return found?.initializer ? found.initializer.getText(sf) : '';
  };

  const visitElement = (element) => {
    const tag = (ts.isJsxElement(element) ? element.openingElement : element).tagName.getText(sf);
    if (!inPhase(tag)) return;
    switch (tag) {
      case 'SquircleView':
      case 'Surface': {
        rename(element, 'View');
        needsView = true;
        for (const name of ['cornerSmoothing', 'smoothing']) {
          const found = attribute(element, name);
          if (found) remove(found);
        }
        if (tag === 'Surface') {
          const tone = attribute(element, 'tone');
          const toneName = tone ? literalText(tone.initializer) : 'default';
          if (tone && !toneName) {
            notes.push(`${file}:${sf.getLineAndCharacterOfPosition(tone.getStart(sf)).line + 1}: Surface tone is an expression`);
          }
          if (tone) remove(tone);
          prefixClass(element, `rounded-card ${SURFACE_TONE[toneName ?? 'default']}`);
        }
        break;
      }
      case 'TactilePressable': {
        rename(element, 'Press');
        needs.add('Press');
        const pressed = PRESSED_FILL.find(([pattern]) => pattern.test(classText(element)));
        if (pressed) addAttribute(element, `pressedClassName="${pressed[1]}"`);
        addTestId(element, 'press');
        break;
      }
      case 'PrimaryButton': {
        rename(element, 'Button');
        needs.add('Button');
        const variant = attribute(element, 'variant');
        const variantName = variant ? literalText(variant.initializer) : null;
        if (variantName === 'quiet') edit(variant.initializer.getStart(sf), variant.initializer.getEnd(), '"secondary"');
        const className = attribute(element, 'className');
        if (className && /\bbg-card\b/.test(className.getText(sf))) {
          edit(className.getStart(sf), className.getEnd(), className.getText(sf).replace(/\s*\bbg-card\b/, ''));
          if (!variant) addAttribute(element, 'variant="secondary"');
        }
        addTestId(element, 'button');
        break;
      }
      case 'IconAction': {
        rename(element, 'HeaderIconButton');
        needs.add('HeaderIconButton');
        for (const name of ['tone', 'size', 'style']) {
          const found = attribute(element, name);
          if (found) remove(found);
        }
        addTestId(element, 'action');
        break;
      }
      case 'ScreenShell': {
        if (!ts.isJsxElement(element)) break;
        for (const name of ['className', 'style', 'edges']) {
          if (attribute(element, name))
            notes.push(`${file}:${sf.getLineAndCharacterOfPosition(element.getStart(sf)).line + 1}: ScreenShell ${name} needs a hand edit`);
        }
        const header = element.children.find(
          (child) => ts.isJsxSelfClosingElement(child) && child.tagName.getText(sf) === 'BrandHeader',
        );
        const props = [`screen="${screen}"`];
        if (header) {
          props.push(TASK_PAGES.has(file) ? 'kind="task"' : 'kind="pushed"');
          for (const [from, to] of [['title', 'title'], ['rightAction', 'trailing'], ['onBack', TASK_PAGES.has(file) ? 'onClose' : 'onBack']]) {
            const found = attribute(header, from);
            if (found) props.push(`${to}=${found.initializer.getText(sf)}`);
          }
          edit(header.getFullStart(), header.getEnd(), '');
        } else props.push('kind="bare"');
        needs.add('Page');
        const opening = element.openingElement;
        edit(opening.getStart(sf), opening.getEnd(), `<Page ${props.join(' ')}>`);
        edit(element.closingElement.tagName.getStart(sf), element.closingElement.tagName.getEnd(), 'Page');
        break;
      }
      case 'BrandHeader':
        if (!ts.isJsxElement(element.parent) || element.parent.openingElement.tagName.getText(sf) !== 'ScreenShell')
          notes.push(`${file}:${sf.getLineAndCharacterOfPosition(element.getStart(sf)).line + 1}: BrandHeader outside ScreenShell needs a hand edit`);
        break;
    }
  };

  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) visitElement(node);
    node.forEachChild(visit);
  };
  visit(sf);

  let lastImport = null;
  const reactNativeImports = [];
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    lastImport = statement;
    const specifier = statement.moduleSpecifier.text;
    if (specifier === 'react-native' && !statement.importClause?.isTypeOnly)
      reactNativeImports.push(statement.importClause?.namedBindings);
    if (legacyModule(specifier)) remove(statement);
  }
  if (edits.length === 0) return { next: source, notes };

  const named = reactNativeImports.filter((b) => b && ts.isNamedImports(b));
  const viewImported = named.some((b) =>
    b.elements.some((e) => !e.isTypeOnly && e.name.text === 'View'),
  );
  const bindings = named[0];
  if (needsView && !viewImported) {
    if (bindings)
      edit(bindings.elements[0].getStart(sf), bindings.elements[0].getStart(sf), 'View, ');
    else edit(lastImport.getEnd(), lastImport.getEnd(), "\nimport { View } from 'react-native';");
  }
  const added = [...needs]
    .filter((name) => !new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(source))
    .map((name) => NEW_IMPORTS[name]);
  if (added.length) edit(lastImport.getEnd(), lastImport.getEnd(), `\n${added.join('\n')}`);

  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let next = source;
  let floor = Infinity;
  for (const { start, end, text } of edits) {
    if (end > floor) throw new Error(`${file}: overlapping edits at ${start}`);
    next = next.slice(0, start) + text + next.slice(end);
    floor = start;
  }
  return { next, notes };
}

const check = process.argv.includes('--check');
const changed = [];
const notes = [];
for (const file of sourceFiles()) {
  if (LEGACY_FILES.has(file)) continue;
  const path = join(MOBILE_ROOT, file);
  const source = readFileSync(path, 'utf8');
  let next = source;
  for (const inPhase of PHASES) {
    const result = transform(file, next, inPhase);
    notes.push(...result.notes);
    next = result.next;
  }
  if (next === source) continue;
  changed.push(file);
  if (!check) writeFileSync(path, next);
}

console.log(`${check ? 'would change' : 'changed'} ${changed.length} files`);
for (const file of changed) console.log(`  ${file}`);
if (notes.length) console.log(`hand edits:\n${notes.map((n) => `  ${n}`).join('\n')}`);
if (check && changed.length > 0) process.exitCode = 1;
