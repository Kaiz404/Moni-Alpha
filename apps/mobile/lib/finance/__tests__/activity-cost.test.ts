import type { CurrencyCode, MinorAmount } from '@repo/types';

import { filterActivity, groupActivityDays, withinRange } from '@/lib/finance/activity-filter';
import { flowSeries } from '@/lib/finance/flow-series';
import { pageOf } from '@/lib/finance/paged';
import type { FinanceTransaction } from '@/lib/finance/types';

const MYR = 'MYR' as CurrencyCode;
const COUNT = 10_000;
const MERCHANTS = ['Grab', 'Tesco', 'Kopitiam Ali', 'Shell', 'Touch n Go', 'Mamak Corner'];

const rows: FinanceTransaction[] = Array.from({ length: COUNT }, (_, index) => {
  const at = new Date(Date.UTC(2023, 0, 1) + ((index * 7919) % 1400) * 86_400_000).toISOString();
  return {
    id: `t${index}`,
    userId: 'kai',
    walletId: index % 3 ? 'maybank' : 'tng',
    amountMinor: (100 + (index % 9000)) as MinorAmount,
    currency: MYR,
    type: index % 11 ? 'expense' : 'income',
    analysisExcluded: false,
    debtActivityId: null,
    categoryId: `c${index % 12}`,
    transferToWalletId: null,
    linkedTransactionId: null,
    description: `Payment number ${index}`,
    merchant: MERCHANTS[index % MERCHANTS.length],
    notes: index % 5 ? null : 'With Mei',
    transactionDate: at,
    locationLatitude: null,
    locationLongitude: null,
    locationName: null,
    autoAdded: false,
    balanceCorrection: false,
    createdAt: at,
  };
});
const categoryNames = Object.fromEntries(
  Array.from({ length: 12 }, (_, index) => [`c${index}`, `Category ${index}`]),
);
const filter = {
  walletId: null,
  mainCurrency: MYR,
  kind: 'all' as const,
  categoryNames,
};
const now = new Date(2026, 9, 14, 12);
const range = { from: '2025-01-01', to: '2025-12-31' };

function median(work: () => unknown): number {
  const runs = Array.from({ length: 7 }, () => {
    const start = performance.now();
    work();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return runs[3];
}

/** A guard against a slow path coming back. Node is faster than Hermes, so the ceilings are loose. */
describe('Activity over 10,000 rows', () => {
  it('stays cheap at each step, and search reaches every row', () => {
    const sorted = filterActivity(rows, { ...filter, query: '' });
    const costs = {
      filterAndSort: median(() => filterActivity(rows, { ...filter, query: '' })),
      search: median(() => filterActivity(rows, { ...filter, query: 'number 9999' })),
      amountSearch: median(() => filterActivity(rows, { ...filter, query: '18.90' })),
      range: median(() => withinRange(sorted, range)),
      chart: median(() => flowSeries({ transactions: sorted, range, now, currency: MYR })),
      dayTotals: median(() => groupActivityDays(sorted)),
      page: median(() => pageOf(sorted, 250)),
    };
    if (process.env.MEASURE) process.stdout.write(`${JSON.stringify(costs)}\n`);
    for (const cost of Object.values(costs)) expect(cost).toBeLessThan(250);
    expect(sorted).toHaveLength(COUNT);
    expect(filterActivity(rows, { ...filter, query: 'number 9999' }).map((row) => row.id)).toEqual([
      't9999',
    ]);
  });
});
