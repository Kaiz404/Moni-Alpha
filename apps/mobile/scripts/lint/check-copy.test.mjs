import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkCopy, copyHits } from './check-copy.mjs';

const FILE = 'app/sample.tsx';
const terms = (source) =>
  copyHits(FILE, source).map(({ term, text }) => `${term}: ${text}`);

test('JSX text Declined fails with term Decline', () => {
  assert.deepEqual(terms('const A = () => <Text>Declined</Text>;'), [
    'Decline: Declined',
  ]);
});

test('a U+2212 minus before RM passes and a hyphen fails', () => {
  assert.deepEqual(
    terms('const A = () => <Text>−RM45.90</Text>;'),
    [],
  );
  assert.deepEqual(terms('const A = () => <Text>-RM45.90</Text>;'), [
    'hyphen before RM: -RM45.90',
  ]);
});

test('a space after RM fails', () => {
  assert.deepEqual(terms('const A = () => <Text>{"RM 42"}</Text>;'), [
    'RM space: RM 42',
  ]);
});

test('identifiers and strings that do not reach the screen pass', () => {
  const source = `
    const insightsRoute = '/insights';
    const A = () => (
      <Pressable onPress={() => router.push('summary')} accessibilityLabel="Open Insights">
        <Text>{insightsRoute}</Text>
      </Pressable>
    );`;
  assert.deepEqual(terms(source), ['Insights: Open Insights']);
  assert.deepEqual(
    terms(
      `const A = () => <B onPress={() => router.push('Insights')} />;`,
    ),
    [],
  );
});

test('strings flow through conditionals, templates, and object slots', () => {
  const source = `
    const A = ({ done, n }) => (
      <>
        <Text>{done ? 'Queued' : \`\${n} merged\`}</Text>
        <Icon name="git-merge" />
        <Stack.Screen options={{ title: 'Plan', headerTintColor: 'Plan' }} />
        {kind === 'declined' && <Text>Not mine</Text>}
      </>
    );`;
  assert.deepEqual(terms(source), [
    'Queued: Queued',
    'Merge: {} merged',
    'Plan: Plan',
  ]);
});

test('an allowed hit passes, a new hit fails, and an allow entry with no hit is stale', () => {
  const hits = copyHits(
    FILE,
    'const A = () => <Text>Decline</Text>;',
  );
  const allow = [
    `${FILE}: Decline: Decline`,
    `${FILE}: Merge: Merge`,
  ];
  assert.deepEqual(checkCopy({ hits, allow, base: allow }), {
    unlisted: [],
    stale: [`${FILE}: Merge: Merge`],
    grownBy: 0,
    newHits: [],
  });
  const changed = copyHits(
    FILE,
    'const A = () => <Text>Declined</Text>;',
  );
  assert.deepEqual(
    checkCopy({
      hits: changed,
      allow: [`${FILE}: Decline: Decline`],
      base: null,
    }).newHits,
    [
      {
        file: FILE,
        line: 1,
        term: 'Decline',
        reason: 'use Not mine',
        text: 'Declined',
      },
    ],
  );
});

test('an allow list longer than its base fails', () => {
  const hits = [
    ...copyHits(FILE, 'const A = () => <Text>Decline</Text>;'),
    ...copyHits(FILE, 'const B = () => <Text>Merge</Text>;'),
  ];
  const allow = [
    `${FILE}: Decline: Decline`,
    `${FILE}: Merge: Merge`,
  ];
  assert.equal(
    checkCopy({ hits, allow, base: allow.slice(0, 1) }).grownBy,
    1,
  );
  assert.equal(checkCopy({ hits, allow, base: allow }).grownBy, 0);
});
