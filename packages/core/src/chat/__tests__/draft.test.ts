import { describe, expect, it } from 'vitest';

import { draftAfter, draftCategoryChange, draftIntro, type DraftRow } from '../draft';

const categories = [
  { id: 'food', name: 'Food & Dining' },
  { id: 'transport', name: 'Transport' },
  { id: 'shopping', name: 'Shopping' },
];
const aliases = [{ rawKey: 'grab', displayName: 'Grab' }];

const row = (id: string, day: string, merchant: string, categoryId: string | null, amountMinor: number, extra: Partial<DraftRow> = {}): DraftRow => ({
  id,
  day,
  merchant,
  categoryId,
  amountMinor,
  type: 'expense',
  analysisExcluded: false,
  debtActivityId: null,
  ...extra,
});

const food = [
  row('f1', '2026-10-14', 'Mamak Ali', 'food', 1320),
  row('f2', '2026-10-13', 'GRAB*FOOD', 'food', 4590),
  row('f3', '2026-10-07', 'GRAB*FOOD', 'food', 2740),
  row('f4', '2026-10-03', 'GRAB*FOOD', 'food', 3280),
  row('f5', '2026-10-09', 'Starbucks', 'food', 1890),
];
const rides = [row('t1', '2026-10-05', 'GRAB*A-3KX2', 'transport', 1850), row('t2', '2026-10-09', 'GRAB*A-3KX2', 'transport', 2310)];
const history = [...food, ...rides, row('x1', '2026-10-02', 'GRAB*FOOD', null, 900, { type: 'transfer' })];

const ids = (draft: ReturnType<typeof draftCategoryChange>) => draft?.rows.map((each) => each.id);

describe('draftCategoryChange', () => {
  it('moves the merchant out of the named category to where its other payments sit', () => {
    const draft = draftCategoryChange({ text: 'Move my Grab rides out of Food', rows: food, history, categories, aliases });
    expect(draft).toEqual({
      from: { id: 'food', name: 'Food & Dining' },
      to: { id: 'transport', name: 'Transport' },
      alreadyThere: { count: 2, names: 'Grab' },
      rows: [
        { ...food[1], name: 'GRAB*FOOD' },
        { ...food[2], name: 'GRAB*FOOD' },
        { ...food[3], name: 'GRAB*FOOD' },
      ],
      totalMinor: 10610,
    });
    expect(draftIntro(draft!)).toBe(
      'Your 2 Grab payments are already in Transport. I found 3 GRAB*FOOD rows in Food & Dining. If they belong there too:',
    );
  });

  it('takes a named target, with or without a source', () => {
    expect(ids(draftCategoryChange({ text: 'move grab from food & dining to shopping.', rows: food, history, categories, aliases }))).toEqual(['f2', 'f3', 'f4']);
    const draft = draftCategoryChange({ text: 'Put Starbucks in Shopping', rows: food, history, categories, aliases });
    expect(ids(draft)).toEqual(['f5']);
    expect(draft?.from).toEqual({ id: 'food', name: 'Food & Dining' });
    expect(draftIntro(draft!)).toBe('I found 1 Starbucks row in Food & Dining. To move it to Shopping:');
  });

  it('reads "these rows" as every row in view, and names the source only when they share one', () => {
    const view = [food[0]!, rides[0]!];
    const draft = draftCategoryChange({ text: 'change these rows to Shopping', rows: view, history, categories, aliases });
    expect(ids(draft)).toEqual(['f1', 't1']);
    expect(draft?.from).toBeNull();
    expect(draftIntro(draft!)).toBe('I found 2 Mamak Ali and Grab rows. To move them to Shopping:');
  });

  it('answers null when it is not a request, names nothing it knows, or has nothing to move', () => {
    const ask = (text: string, rows: readonly DraftRow[] = food) => draftCategoryChange({ text, rows, history, categories, aliases });
    expect(ask('Why is Food so high this month?')).toBeNull();
    expect(ask('Move my Grab rides out of Groceries')).toBeNull();
    expect(ask('Move Tesco out of Food')).toBeNull();
    expect(ask('Move my Grab rides to Transport', rides)).toBeNull();
    expect(ask('Move Starbucks out of Food')).toBeNull();
    expect(ask('Move my Grab rides out of Food', [row('d1', '2026-10-12', 'GRAB*FOOD', 'food', 500, { debtActivityId: 'debt' })])).toBeNull();
  });
});

describe('draftAfter', () => {
  it('moves only this month\'s rows between the two categories', () => {
    const draft = draftCategoryChange({
      text: 'Move my Grab rides out of Food',
      rows: [...food, row('f6', '2026-09-28', 'GRAB*FOOD', 'food', 1000)],
      history,
      categories,
      aliases,
    })!;
    const month = { food: { spentMinor: 34980, budgetMinor: 45000 }, transport: { spentMinor: 13550, budgetMinor: 12000 } };
    expect(draftAfter(draft, '2026-10', (id) => month[id as keyof typeof month])).toEqual({
      from: { name: 'Food & Dining', afterMinor: 24370, budgetMinor: 45000 },
      to: { name: 'Transport', afterMinor: 24160, budgetMinor: 12000 },
    });
  });
});
