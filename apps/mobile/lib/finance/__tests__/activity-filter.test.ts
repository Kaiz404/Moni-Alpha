import type { CurrencyCode, MinorAmount } from '@repo/types';

import {
  filterActivity,
  groupActivityDays,
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
  day: null,
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

  it('keeps a transfer into the chosen wallet and filters by kind and day', () => {
    const reload = row('reload', null, new Date(2026, 9, 13, 8), {
      type: 'transfer',
      transferToWalletId: 'tng',
    });
    const rows = [grabFood, reload, tesco, grab];
    expect(ids(filterActivity(rows, { ...all, walletId: 'tng' }))).toEqual(['reload']);
    expect(ids(filterActivity(rows, { ...all, kind: 'transfer' }))).toEqual(['reload']);
    expect(ids(filterActivity(rows, { ...all, day: '2026-10-13' }))).toEqual(['tesco', 'reload']);
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
