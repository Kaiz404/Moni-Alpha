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

test('the Record a debt button #137 built from the form fails, and a fixed verb passes', () => {
  const before = `const words = { record: (name, amount) => \`Record: \${name} owes you \${amount}\` };
const A = () => (
  <AmountPage action={{ label: ready ? words.record(who, amount) : 'Add an amount', onPress }} />
);
const B = () => <Button label={\`Skip \${monthName(period)}\`} />;
const C = () => <Button label={ready ? 'Record' : 'Add an amount'} />;`;
  assert.deepEqual(rules(before), ['3 value in button', '5 value in button']);

  const web = `const label = ready ? \`Record: \${who} owes you \${money}\` : 'Add who and an amount';
const A = () => <button type="button" className="btn btn-ink press">{label}<span className="kbd">Enter</span></button>;
const B = () => <button type="button" className="chip press">{name}</button>;
const C = () => <button type="button" className="btn btn-sand press">{open ? 'Record' : 'Done'}</button>;`;
  assert.deepEqual(rules(web, 'web'), ['2 value in button']);
});

test('an allow entry names the file and rule, not the line', () => {
  assert.equal(allowKey({ file: 'a.tsx', line: 9, rule: 'text arrow' }), 'a.tsx: text arrow');
});
