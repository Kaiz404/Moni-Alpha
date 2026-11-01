import type { CurrencyCode, MinorAmount } from '@repo/types';

import {
  filterActivity,
  groupActivityDays,
  orderRange,
  rangeLabel,
  rangePresets,
  withinRange,
  type ActivityFilter,
} from '@/lib/finance/activity-filter';
import type { FinanceTransaction } from '@/lib/finance/types';

function row(
  id: string,
  merchant: string | null,
  date: Date,
  over: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id,
    userId: 'kai',
    walletId: 'maybank',
    amountMinor: 1000 as MinorAmount,
    currency: 'MYR' as CurrencyCode,
    type: 'expense',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: null,
    transferToWalletId: null,
    linkedTransactionId: null,
    description: null,
    merchant,
    notes: null,
    transactionDate: date.toISOString(),
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    autoAdded: false,
    balanceCorrection: false,
    createdAt: date.toISOString(),
    ...over,
  };
}

const MYR = 'MYR' as CurrencyCode;
const all: ActivityFilter = {
  query: '',
  walletId: null,
  mainCurrency: MYR,
  kind: 'all',
  categoryNames: { food: 'Food & Dining' },
};

const grab = row('grab', 'Grab', new Date(2026, 9, 12, 9));
const grabFood = row('grab-food', 'GrabFood', new Date(2026, 9, 14, 12));
const tesco = row('tesco', 'Tesco', new Date(2026, 9, 13, 18));
const ids = (rows: FinanceTransaction[]) => rows.map((r) => r.id);

describe('filterActivity', () => {
  it('keeps the two Grab rows for "grab", newest first', () => {
    expect(ids(filterActivity([grab, tesco, grabFood], { ...all, query: 'grab' }))).toEqual([
      'grab-food',
      'grab',
    ]);
  });

  it('drops a USD wallet row when the main currency is MYR', () => {
    const wise = row('wise', 'Grab', new Date(2026, 9, 14, 8), {
      currency: 'USD' as CurrencyCode,
      walletId: 'wise',
    });
    expect(ids(filterActivity([grab, wise], all))).toEqual(['grab']);
  });

  it('matches the category name, the note, and the start of the amount', () => {
    const lunch = row('lunch', 'Mamak Ali', new Date(2026, 9, 14, 13), {
      categoryId: 'food',
      notes: 'With Mei',
      amountMinor: 1890 as MinorAmount,
    });
    const rows = [lunch, tesco];
    expect(ids(filterActivity(rows, { ...all, query: 'food & dining' }))).toEqual(['lunch']);
    expect(ids(filterActivity(rows, { ...all, query: 'mei' }))).toEqual(['lunch']);
    expect(ids(filterActivity(rows, { ...all, query: 'RM18.9' }))).toEqual(['lunch']);
    expect(ids(filterActivity(rows, { ...all, query: '8.90' }))).toEqual([]);
  });

  it('keeps a transfer into the chosen wallet and filters by kind', () => {
    const reload = row('reload', null, new Date(2026, 9, 13, 8), {
      type: 'transfer',
      transferToWalletId: 'tng',
    });
    const rows = [grabFood, reload, tesco, grab];
    expect(ids(filterActivity(rows, { ...all, walletId: 'tng' }))).toEqual(['reload']);
    expect(ids(filterActivity(rows, { ...all, kind: 'transfer' }))).toEqual(['reload']);
  });

  it('orders by the moment, whichever way the date is written', () => {
    const later = row('later', null, new Date(Date.UTC(2026, 9, 14, 12)));
    const earlier = { ...row('earlier', null, new Date(0)), transactionDate: '2026-10-14T19:00:00+08:00' };
    expect(ids(filterActivity([earlier, later], all))).toEqual(['later', 'earlier']);
  });
});

describe('withinRange', () => {
  const sep30Late = row('sep30', null, new Date(2026, 8, 30, 23, 59));
  const oct1Early = row('oct1', null, new Date(2026, 9, 1, 0, 0));
  const oct14Late = row('oct14', null, new Date(2026, 9, 14, 23, 59, 59));
  const oct15Early = row('oct15', null, new Date(2026, 9, 15, 0, 0));
  const rows = [oct15Early, oct14Late, oct1Early, sep30Late];

  it('includes both end days, whole, and nothing past them', () => {
    expect(ids([...withinRange(rows, { from: '2026-10-01', to: '2026-10-14' })])).toEqual([
      'oct14',
      'oct1',
    ]);
  });

  it('holds one day', () => {
    expect(ids([...withinRange(rows, { from: '2026-10-14', to: '2026-10-14' })])).toEqual(['oct14']);
  });

  it('keeps every row for all time', () => {
    expect(ids([...withinRange(rows, null)])).toEqual(['oct15', 'oct14', 'oct1', 'sep30']);
  });
});

describe('orderRange', () => {
  it('swaps reversed ends', () => {
    expect(orderRange('2026-10-14', '2026-10-01')).toEqual({ from: '2026-10-01', to: '2026-10-14' });
    expect(orderRange('2026-10-01', '2026-10-14')).toEqual({ from: '2026-10-01', to: '2026-10-14' });
  });
});

describe('rangePresets', () => {
  it('gives the sheet its six choices for a day in the month', () => {
    expect(rangePresets(new Date(2026, 9, 14, 12)).map(({ label, range }) => [label, range])).toEqual([
      ['This month', { from: '2026-10-01', to: '2026-10-31' }],
      ['Last month', { from: '2026-09-01', to: '2026-09-30' }],
      ['Last 30 days', { from: '2026-09-15', to: '2026-10-14' }],
      ['Last 3 months', { from: '2026-07-15', to: '2026-10-14' }],
      ['This year', { from: '2026-01-01', to: '2026-12-31' }],
      ['All time', null],
    ]);
  });

  it('keeps the last 3 months sensible from a day a shorter month lacks', () => {
    const lastThree = rangePresets(new Date(2026, 4, 31, 12))[3];
    expect(lastThree.range).toEqual({ from: '2026-03-01', to: '2026-05-31' });
  });

  it('crosses into last year in January', () => {
    expect(rangePresets(new Date(2027, 0, 5))[1].range).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });
});

describe('rangeLabel', () => {
  const now = new Date(2026, 9, 14, 12);
  it.each([
    [{ from: '2026-10-01', to: '2026-10-31' }, 'Oct 2026'],
    [{ from: '2026-01-01', to: '2026-12-31' }, '2026'],
    [{ from: '2026-10-01', to: '2026-10-14' }, '1 Oct to 14 Oct'],
    [{ from: '2026-09-14', to: '2026-09-14' }, 'Mon 14 Sep'],
    [{ from: '2026-09-15', to: '2026-10-14' }, 'Last 30 days'],
    [{ from: '2026-07-15', to: '2026-10-14' }, 'Last 3 months'],
    [{ from: '2025-03-01', to: '2025-03-09' }, '1 Mar to 9 Mar 2025'],
    [{ from: '2025-12-20', to: '2026-01-02' }, '20 Dec 2025 to 2 Jan 2026'],
  ])('reads %j as %s', (range, label) => {
    expect(rangeLabel(range, now)).toBe(label);
  });
});

describe('groupActivityDays', () => {
  it('totals spending and money in per local day, leaving transfers out', () => {
    const salary = row('salary', 'Salary', new Date(2026, 9, 14, 9), {
      type: 'income',
      amountMinor: 420000 as MinorAmount,
    });
    const reload = row('reload', null, new Date(2026, 9, 14, 8), {
      type: 'transfer',
      amountMinor: 10000 as MinorAmount,
    });
    const days = groupActivityDays(filterActivity([grab, grabFood, salary, reload, tesco], all));
    expect(
      days.map((day) => [day.key, ids(day.transactions), day.spentMinor, day.inMinor]),
    ).toEqual([
      ['2026-10-14', ['grab-food', 'salary', 'reload'], 1000, 420000],
      ['2026-10-13', ['tesco'], 1000, 0],
      ['2026-10-12', ['grab'], 1000, 0],
    ]);
  });
});
