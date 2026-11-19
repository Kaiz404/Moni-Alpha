import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { format, serialize } = createRequire(import.meta.url)('./serialize.cjs');

const tree = {
  type: 'View',
  props: { style: { flex: 1, width: 320, transform: [{ translateY: 12.5 }] } },
  children: [
    {
      type: 'View',
      props: { testID: 'home.avatar', accessibilityLabel: 'Profile', accessibilityRole: 'button', className: 'h-11 w-11' },
      children: null,
    },
    {
      type: 'Text',
      props: {
        className: 'text-muted',
        style: [{ fontFamily: 'Funnel_400', fontSize: 36.96041, color: '#111' }, null, [{ color: '#222', height: 40 }]],
      },
      children: ['RM', '54.90', { type: 'Text', props: { className: 'font-bold' }, children: ['due'] }],
    },
    {
      type: 'View',
      props: { testID: 'nav.tab.index', accessibilityState: { selected: true, disabled: false } },
      children: [{ type: 'ViewManagerAdapter_SymbolModule', props: { name: 'home', tintColor: '#fff' }, children: null }],
    },
    { type: 'RNSScreen', props: { activityState: 2, style: { position: 'absolute' } }, children: null },
  ],
};

test('keeps what a person sees, in order, and drops layout and animation numbers', () => {
  assert.deepEqual(serialize(tree), [
    { type: 'View', testID: 'home.avatar', accessibilityLabel: 'Profile', accessibilityRole: 'button', className: 'h-11 w-11' },
    {
      type: 'Text',
      className: 'text-muted',
      style: { color: '#222', fontFamily: 'Funnel_400', fontSize: 36.96 },
      text: 'RM54.90',
    },
    { type: 'Text', className: 'font-bold', text: 'due' },
    { type: 'View', testID: 'nav.tab.index', state: { selected: true } },
    { type: 'ViewManagerAdapter_SymbolModule', name: 'home', style: { tintColor: '#fff' } },
  ]);
});

test('writes a JSON array with one node a line', () => {
  const text = format(serialize(tree).slice(0, 2));
  assert.equal(
    text,
    '[\n' +
      '{"type":"View","testID":"home.avatar","accessibilityLabel":"Profile","accessibilityRole":"button","className":"h-11 w-11"},\n' +
      '{"type":"Text","className":"text-muted","style":{"color":"#222","fontFamily":"Funnel_400","fontSize":36.96},"text":"RM54.90"}\n' +
      ']\n',
  );
  assert.deepEqual(JSON.parse(text), serialize(tree).slice(0, 2));
  assert.equal(format([]), '[]\n');
});
