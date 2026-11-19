// Turns a test renderer's JSON tree into what a screen shows, one node a line in document order,
// so two commits' dumps diff line by line. Layout numbers and animated values are left out: they
// move with every refactor and no person reads them.

const PROPS = ['testID', 'accessibilityLabel', 'accessibilityRole', 'placeholder', 'value', 'name', 'className'];
const STYLE = [
  'color',
  'backgroundColor',
  'borderColor',
  'tintColor',
  'fill',
  'stroke',
  'fontFamily',
  'fontWeight',
  'fontSize',
  'lineHeight',
  'letterSpacing',
];

function round(value) {
  return typeof value === 'number' ? Math.round(value * 1000) / 1000 : value;
}

function flatStyle(style) {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatStyle));
  return style && typeof style === 'object' ? style : {};
}

function pick(source, keys) {
  const out = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') out[key] = round(value);
  }
  return out;
}

function nodeLine(node) {
  const props = node.props ?? {};
  const line = { type: node.type, ...pick(props, PROPS) };
  const state = Object.fromEntries(
    Object.entries(props.accessibilityState ?? {}).filter(([, value]) => value === true),
  );
  if (Object.keys(state).length) line.state = state;
  const style = pick({ ...flatStyle(props.style), ...pick(props, ['fill', 'stroke', 'tintColor']) }, STYLE);
  if (Object.keys(style).length) line.style = style;
  const text = (node.children ?? []).filter((child) => typeof child === 'string').join('');
  if (text) line.text = text;
  return Object.keys(line).length > 1 ? line : null;
}

/** @returns {object[]} the shown nodes, in order. */
function serialize(tree) {
  const lines = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const line = nodeLine(node);
    if (line) lines.push(line);
    (node.children ?? []).forEach(walk);
  };
  walk(tree);
  return lines;
}

/** A JSON array with one node a line, so `diff` reads it node by node. */
function format(lines) {
  return lines.length ? `[\n${lines.map((line) => JSON.stringify(line)).join(',\n')}\n]\n` : '[]\n';
}

module.exports = { serialize, format };
