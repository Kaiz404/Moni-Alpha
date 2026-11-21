import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowKey, tasteHits } from './check-taste.mjs';

const rules = (source, app = 'mobile', file = 'app/sample.tsx') =>
  tasteHits(file, source, app).map(({ line, rule }) => `${line} ${rule}`);

test('the sparkle Moni marks 520f8df8 replaced with the cat fail', () => {
  assert.deepEqual(
    rules(`const A = () => <Icon name="creation" />;\nconst B = [{ text: 'What can you do?', icon: 'creation' }];`),
    ['1 sparkle icon', '2 sparkle icon'],
  );
  assert.deepEqual(rules(`import { mdiCreation } from '@mdi/js';`, 'web'), ['1 sparkle icon']);
  assert.deepEqual(rules(`const A = () => <MoniGlyph size={18} />;`), []);
});

test('the Alert.alert confirmation 3b0830bc moved to the confirm sheet fails, and an error alert passes', () => {
  const before = `Alert.alert(
  'Archive category?',
  \`\${name} will be hidden from new transactions and budgets.\`,
  [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive' }],
);`;
  assert.deepEqual(rules(before), ['1 confirm dialog']);
  assert.deepEqual(rules(`Alert.alert('Not saved', 'Try again.');`), []);
  assert.deepEqual(rules(`if (window.confirm('Delete?')) go();`, 'web'), ['1 confirm dialog']);
  assert.deepEqual(rules(`const f = confirm('price');`, 'web'), []);
});

test('the transfer text arrow 9d736cb1 replaced with an icon fails, outside comments and console', () => {
  assert.deepEqual(rules('const meta = (row) => `${row.wallet} → ${row.toWallet}`;'), ['1 text arrow']);
  assert.deepEqual(rules(`/** 0 → 1 */\nconsole.warn('Dashboard → Storage');`), []);
});

test('native selects and date inputs fail on the web only', () => {
  const source = `const A = () => (<>
<select value={m} />
<input type="date" value={d} />
<input type="text" />
</>);`;
  assert.deepEqual(rules(source, 'web'), ['2 native control', '3 native control']);
  assert.deepEqual(rules(source, 'mobile'), []);
});

test('an allow entry names the file and rule, not the line', () => {
  assert.equal(allowKey({ file: 'a.tsx', line: 9, rule: 'text arrow' }), 'a.tsx: text arrow');
});
