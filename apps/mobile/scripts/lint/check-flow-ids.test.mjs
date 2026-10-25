import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flowIds, unknownFlowIds } from './check-flow-ids.mjs';

const code = [
  {
    file: 'components/row.tsx',
    source: `
      const a = tid('home', 'avatar');
      const b = tid('merchants', section, row.key, 'edit');
      const c = tid('sheet', 'option', value);
      const d = tid('nav', 'tab', active ? 'index' : 'activity');
      const e = tid(screen, 'back');
      const f = tid('budget', 'recordDebt');`,
  },
];

const unknown = (yaml) =>
  unknownFlowIds([{ file: 'flow.yaml', source: yaml }], code).map(({ line, id }) => `${line} ${id}`);

test('flowIds reads plain, quoted, and nested id selectors', () => {
  const yaml = [
    '- tapOn:',
    '    id: home.avatar',
    "- tapOn: { text: x }",
    "    id: 'sheet\\.option\\..*'",
    '      id: "nav.tab.index" # the tab',
  ].join('\n');
  assert.deepEqual(flowIds(yaml), [
    { line: 2, id: 'home.avatar' },
    { line: 4, id: 'sheet\\.option\\..*' },
    { line: 5, id: 'nav.tab.index' },
  ]);
});

test('literal ids match the tid() calls that render them, kebab-cased', () => {
  assert.deepEqual(
    unknown('id: home.avatar\nid: nav.tab.index\nid: budget.record-debt\nid: wallet.back\nid: sheet.option.2026-10'),
    [],
  );
});

test('a literal id that no tid() renders fails', () => {
  assert.deepEqual(unknown('id: home.transactions\nid: nav.tab.budget\nid: budget.recordDebt'), [
    '1 home.transactions',
    '2 nav.tab.budget',
    '3 budget.recordDebt',
  ]);
});

test('regex ids match when a rendering fits, using the pattern segments for runtime parts', () => {
  assert.deepEqual(
    unknown(
      [
        "id: 'merchants\\.to-name\\..*\\.edit'",
        "id: 'sheet\\.option\\.\\d{4}-\\d{2}'",
        "id: 'merchants\\.named\\..*\\.delete'",
        "id: 'home\\.recent\\..*'",
      ].join('\n'),
    ),
    ["3 merchants\\.named\\..*\\.delete", "4 home\\.recent\\..*"],
  );
});

test('parts appended to a passed-in testID match under any prefix', () => {
  const field = [{ file: 'components/ui/field.tsx', source: "const a = tid(testID, 'edit');" }];
  const ids = (yaml) => unknownFlowIds([{ file: 'flow.yaml', source: yaml }], field).map(({ id }) => id);
  assert.deepEqual(ids('id: chat.draft.amount.edit\nid: "merchants\\\\.named\\\\..*\\\\.edit"'), []);
  assert.deepEqual(ids('id: chat.draft.amount.save'), ['chat.draft.amount.save']);
});
