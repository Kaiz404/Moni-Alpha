import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY,
  activityQueryString,
  checkReason,
  nextSort,
  noMatchLine,
  deleteWords,
  pageOf,
  parseActivityQuery,
  parseSavedViews,
  selectActivity,
  type ActivityItem,
} from '../activity-query';

const item = (id: string, over: Partial<ActivityItem>): ActivityItem => ({
  id,
  at: `${over.day ?? '2026-10-14'}T04:00:00.000Z`,
  day: '2026-10-14',
  title: id,
  kind: 'expense',
  categoryId: 'food',
  category: 'Food & Dining',
  walletId: 'mb',
  toWalletId: null,
  wallet: 'Maybank',
  source: 'notification',
  auto: false,
  amountMinor: 1000,
  hasPlace: true,
  notes: null,
  ...over,
});

const rows = [
  item('Mamak Ali', { amountMinor: 1320, walletId: 'cash', wallet: 'Cash', source: 'manual' }),
  item('Shell', { day: '2026-10-12', categoryId: 'transport', category: 'Transport', amountMinor: 3040, hasPlace: false }),
  item('Grab', { day: '2026-10-09', categoryId: 'transport', category: 'Transport', amountMinor: 2310, walletId: 'tng', wallet: "Touch 'n Go" }),
  item("Touch 'n Go reload", { day: '2026-10-13', kind: 'transfer', categoryId: null, category: null, toWalletId: 'tng', amountMinor: 10000, auto: true }),
  item('Freelance', { day: '2026-10-09', kind: 'income', categoryId: 'work', category: 'Freelance', amountMinor: 35000 }),
  item('September rent', { day: '2026-09-30', amountMinor: 90000 }),
];
const october = { from: '2026-10-01', to: '2026-10-14' };
const titles = (list: readonly ActivityItem[]) => list.map((each) => each.title);

describe('the URL', () => {
  it('leaves every default out, so plain Activity stays /activity', () => {
    expect(activityQueryString(DEFAULT_QUERY)).toBe('');
  });

  it('round-trips a view, its filters, its sort and its page', () => {
    const query = { ...DEFAULT_QUERY, show: 'list' as const, saved: 'v1', sort: 'amount' as const, dir: 'asc' as const, page: 2, categories: ['transport'], q: 'Grab, Shell', min: 5 };
    const text = activityQueryString(query);
    expect(text).toBe('?show=list&view=v1&sort=amount&dir=asc&page=2&categories=transport&min=5&q=Grab%2C+Shell');
    expect(parseActivityQuery(new URLSearchParams(text.slice(1)))).toEqual(query);
  });

  it('keeps a docked shell pane and ignores what it cannot read', () => {
    expect(activityQueryString(DEFAULT_QUERY, new URLSearchParams('pane=chat'))).toBe('?pane=chat');
    expect(parseActivityQuery(new URLSearchParams('sort=colour&page=-3&from=yesterday&type=gift&min=abc'))).toEqual(DEFAULT_QUERY);
  });
});

describe('selectActivity', () => {
  it('shows this month so far, newest first, by default', () => {
    expect(titles(selectActivity(rows, DEFAULT_QUERY, october))).toEqual(['Mamak Ali', "Touch 'n Go reload", 'Shell', 'Grab', 'Freelance']);
  });

  it('matches any of the comma-separated words, inside one category', () => {
    expect(titles(selectActivity(rows, { ...DEFAULT_QUERY, categories: ['transport'], q: 'grab, shell' }, october))).toEqual(['Shell', 'Grab']);
  });

  it('counts a transfer into a wallet under that wallet', () => {
    expect(titles(selectActivity(rows, { ...DEFAULT_QUERY, wallets: ['tng'] }, october))).toEqual(["Touch 'n Go reload", 'Grab']);
  });

  it('finds the start of an amount', () => {
    expect(titles(selectActivity(rows, { ...DEFAULT_QUERY, q: 'rm30' }, october))).toEqual(['Shell']);
  });

  it('takes To check and Auto-added as their own rules', () => {
    expect(titles(selectActivity(rows, { ...DEFAULT_QUERY, saved: 'check' }, october))).toEqual(['Shell']);
    expect(titles(selectActivity(rows, { ...DEFAULT_QUERY, saved: 'auto' }, october))).toEqual(["Touch 'n Go reload"]);
    expect(checkReason({ kind: 'expense', categoryId: null, hasPlace: true })).toBe('No category');
  });

  it('sorts by amount as money moved, spending most first, and flips on a second click', () => {
    const sort = nextSort(DEFAULT_QUERY, 'amount');
    expect(sort).toEqual({ sort: 'amount', dir: 'desc' });
    expect(titles(selectActivity(rows, { ...DEFAULT_QUERY, ...sort }, october))).toEqual(['Freelance', "Touch 'n Go reload", 'Mamak Ali', 'Grab', 'Shell']);
    expect(nextSort(sort, 'amount')).toEqual({ sort: 'amount', dir: 'asc' });
  });
});

describe('pageOf', () => {
  it('cuts 25 a page and keeps a page past the end on the last one', () => {
    const many = Array.from({ length: 34 }, (_, index) => index);
    expect(pageOf(many, 2)).toMatchObject({ page: 2, pages: 2, first: 26, last: 34, total: 34 });
    expect(pageOf(many, 9).page).toBe(2);
    expect(pageOf([], 1)).toMatchObject({ page: 1, pages: 1, first: 0, last: 0 });
  });
});

describe('saved views', () => {
  it('reads back saved filters and drops what is not a view', () => {
    const raw = JSON.stringify([
      { id: 'v1', name: 'Grab and fuel', filters: { categories: ['transport'], q: 'Grab, Shell' } },
      { name: 'no id' },
    ]);
    expect(parseSavedViews(raw)).toEqual([
      {
        id: 'v1',
        name: 'Grab and fuel',
        filters: { from: null, to: null, kind: 'all', wallets: [], categories: ['transport'], sources: [], min: null, max: null, q: 'Grab, Shell' },
      },
    ]);
    expect(parseSavedViews('nope')).toEqual([]);
  });
});

describe('noMatchLine', () => {
  const names = { categories: { gifts: 'Gifts', food: 'Food & Dining' }, wallets: { tng: "Touch 'n Go" } };
  const none = { ...DEFAULT_QUERY };

  it('names the filters in plain words', () => {
    expect(noMatchLine({ ...none, categories: ['gifts'], wallets: ['tng'] }, { from: '2026-10-01', to: '2026-10-14' }, names)).toBe(
      "No Gifts paid with Touch 'n Go from 1 to 14 Oct.",
    );
    expect(noMatchLine({ ...none, categories: ['gifts', 'food'], q: ' grab ', from: '2026-09-28', to: '2026-10-03' }, { from: '2026-10-01', to: '2026-10-14' }, names)).toBe(
      'No Gifts or Food & Dining matching “grab” from 28 Sep to 3 Oct.',
    );
    expect(noMatchLine({ ...none, kind: 'income' }, { from: '2026-10-01', to: '2026-10-14' }, names)).toBe('No income from 1 to 14 Oct.');
  });
});

describe('deleteWords', () => {
  it('says what deleting does to the month, one row or many', () => {
    expect(deleteWords([{ kind: 'expense', amountMinor: 6000, day: '2026-10-02' }], 'MYR')).toEqual({
      title: 'Delete this transaction?',
      line: "October's spending goes down by RM60.00. You can undo it from the toast.",
      action: 'Delete',
    });
    expect(
      deleteWords(
        [
          { kind: 'expense', amountMinor: 1520, day: '2026-10-13' },
          { kind: 'expense', amountMinor: 2740, day: '2026-10-13' },
          { kind: 'income', amountMinor: 420000, day: '2026-10-01' },
        ],
        'MYR',
      ),
    ).toEqual({ title: 'Delete 3 transactions?', line: "RM42.60 comes off October's spending. Undo puts all 3 back.", action: 'Delete 3' });
    expect(deleteWords([{ kind: 'transfer', amountMinor: 10000, day: '2026-10-06' }], 'MYR').line).toBe('You can undo it from the toast.');
  });
});
