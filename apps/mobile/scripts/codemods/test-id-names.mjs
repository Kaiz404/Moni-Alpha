// Names tid() testIDs for codemods: the screen from the file path, the part from what the
// control says (its label, accessibilityLabel, text child, or handler), the key inside a map.
import ts from 'typescript';

const SCREEN_BY_PATH = [
  [/^app\/\(auth\)\//, 'auth'],
  [/^app\/\(tabs\)\/index\.tsx$/, 'home'],
  [/^app\/\(tabs\)\/summary\.tsx$/, 'budget'],
  [/^app\/\(tabs\)\/chat\.tsx$/, 'chat'],
  [/^app\/\(tabs\)\/profile\.tsx$/, 'profile'],
  [/^app\/transaction\/index\.tsx$/, 'activity'],
  [/^app\/transaction\/new\.tsx$/, 'capture'],
  [/^app\/transaction\//, 'txn'],
  [/^app\/categories\//, 'activity'],
  [/^app\/wallet\//, 'wallet'],
  [/^app\/(debts\.tsx|debt\/)/, 'debts'],
  [/^app\/budget\//, 'budget'],
  [/^app\/proposal\//, 'review'],
  [/^app\/(notifications|debug)\//, 'profile'],
  [/^app\/heatmap\.tsx$/, 'map'],
  [/^app\/scan\//, 'capture'],
  [/^app\//, 'nav'],
  [/^components\/(categories|finance)\/.*picker/, 'sheet'],
  [/^components\/wallets\/.*picker/, 'sheet'],
  [/^components\/(auth)\//, 'auth'],
  [/^components\/chat\//, 'chat'],
  [/^components\/proposal\//, 'review'],
  [/^components\/wallets\//, 'wallet'],
  [/^components\/(profile|debug)\//, 'profile'],
  [/^components\/(nav)\//, 'nav'],
  [/^components\/(receipt|scan)\//, 'capture'],
  [/^components\/transaction\//, 'txn'],
  [/^components\/(budgets|charts)\//, 'budget'],
  [/^components\/finance\//, 'txn'],
  [/^components\//, 'nav'],
];

export function screenFor(file) {
  return SCREEN_BY_PATH.find(([pattern]) => pattern.test(file))[1];
}

const MAX_WORDS = 3;

export function kebab(text) {
  return text
    .replace(/[’']/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, MAX_WORDS)
    .join('-');
}

function firstText(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text || null;
  if (ts.isJsxText(node)) return node.text.trim() || null;
  if (ts.isConditionalExpression(node)) return firstText(node.whenTrue);
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) return null;
  let found = null;
  node.forEachChild((child) => {
    found ??= firstText(child);
  });
  return found;
}

export function attribute(element, name) {
  const attributes = ts.isJsxElement(element)
    ? element.openingElement.attributes
    : element.attributes;
  return attributes.properties.find(
    (a) => ts.isJsxAttribute(a) && a.name.getText() === name,
  );
}

function attributeText(element, name) {
  const found = attribute(element, name);
  if (!found?.initializer) return null;
  return firstText(found.initializer);
}

function handlerName(element) {
  const found = attribute(element, 'onPress');
  const expression = found?.initializer?.expression;
  if (!expression) return null;
  let name = null;
  if (ts.isIdentifier(expression)) name = expression.text;
  else if (ts.isPropertyAccessExpression(expression)) name = expression.name.text;
  else if (ts.isArrowFunction(expression)) {
    const body = ts.isBlock(expression.body)
      ? expression.body.statements[0]?.expression
      : expression.body;
    const call = body && (ts.isVoidExpression(body) ? body.expression : body);
    if (call && ts.isCallExpression(call)) {
      const callee = call.expression;
      name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null;
      if (name === 'push' || name === 'navigate') {
        const target = firstText(call.arguments[0]);
        if (target) return kebab(target.split('/').filter((s) => s && !s.startsWith('[')).join(' '));
      }
    }
  }
  if (!name) return null;
  return kebab(name.replace(/^(handle|on)(?=[A-Z])/, ''));
}

function childText(element) {
  if (!ts.isJsxElement(element)) return null;
  for (const child of element.children) {
    const text = firstText(child);
    if (text) return text;
  }
  return null;
}

/** The parts after the screen, e.g. ['save-changes'] or ['color', 'item'] (an expression). */
export function partsFor(element, fallback) {
  const words =
    attributeText(element, 'label') ??
    attributeText(element, 'accessibilityLabel') ??
    attributeText(element, 'placeholder') ??
    childText(element);
  const part = (words && kebab(words)) || handlerName(element) || fallback;
  const key = attribute(element, 'key')?.initializer;
  const keyExpression =
    key && ts.isJsxExpression(key) && key.expression ? key.expression.getText() : null;
  return { part, keyExpression };
}

/** Formats `tid('screen', 'part', key)`, making `part` unique within `used`. */
export function tidCall(screen, { part, keyExpression }, used) {
  let unique = part;
  for (let n = 2; used.has(`${unique}|${keyExpression}`); n += 1) unique = `${part}-${n}`;
  used.add(`${unique}|${keyExpression}`);
  const args = [`'${screen}'`, `'${unique}'`];
  if (keyExpression) args.push(keyExpression);
  return `tid(${args.join(', ')})`;
}
