import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkTestIds, testIdViolations } from './check-test-ids.mjs';

const FILE = 'components/new-card.tsx';
const problems = (source) =>
  testIdViolations(FILE, source).map(
    ({ line, control, problem }) => `${line} ${control}: ${problem}`,
  );

test('a Pressable with no testID fails', () => {
  assert.deepEqual(
    problems(
      'const A = () => <Pressable onPress={f}><Text>Go</Text></Pressable>;',
    ),
    ['1 Pressable: no testID'],
  );
});

test('a raw string testID fails', () => {
  assert.deepEqual(
    problems('const A = () => <TextInput testID="raw" />;'),
    ['1 TextInput: testID is not a tid() call'],
  );
});

test("testID={tid('home', 'x')} and a forwarded testID prop pass", () => {
  const source = `
    const A = () => <Switch testID={tid('home', 'x')} />;
    const B = ({ testID }) => <Pressable testID={testID} />;
    const C = (props) => <Pressable testID={props.testID} />;
    const D = () => <Pressable testID={\`home.\${id}\`} />;
    const E = () => <Pressable testID={rowId} />;`;
  assert.deepEqual(problems(source), [
    '5 Pressable: testID is not a tid() call',
    '6 Pressable: testID is not a tid() call',
  ]);
});

test('an exempt file passes, and an exempt list with one more line than its base fails', () => {
  const violations = testIdViolations(
    FILE,
    'const A = () => <Pressable onPress={f} />;',
  );
  const exempt = [FILE];
  assert.deepEqual(
    checkTestIds({ violations, exempt, base: exempt }),
    {
      unlisted: [],
      stale: [],
      grownBy: 0,
      failing: [],
    },
  );
  assert.equal(
    checkTestIds({ violations, exempt, base: [] }).grownBy,
    1,
  );
  assert.equal(
    checkTestIds({ violations, exempt, base: null }).grownBy,
    0,
  );
});

test('a non-exempt file fails and an exempt file with no violations is stale', () => {
  const violations = testIdViolations(
    FILE,
    'const A = () => <Pressable onPress={f} />;',
  );
  const result = checkTestIds({
    violations,
    exempt: ['components/fixed.tsx'],
    base: null,
  });
  assert.deepEqual(result.failing, [
    {
      file: FILE,
      line: 1,
      control: 'Pressable',
      problem: 'no testID',
    },
  ]);
  assert.deepEqual(result.stale, ['components/fixed.tsx']);
});
