import { decimalToMinor } from '@repo/types';
import {
  buildCalendarMonthTrendSnapshot,
  buildFinanceAssistantToolSnapshotByCurrency,
  PACE_MIN_DAY_OF_MONTH,
} from '@/lib/ai/snapshot/finance-metrics';

describe('currency-scoped chat snapshot', () => {
  it('never combines metrics from different currencies', () => {
    const snapshot = buildFinanceAssistantToolSnapshotByCurrency(
      [
        {
          amountMinor: decimalToMinor('10'),
          currency: 'USD',
          type: 'expense',
          analysisExcluded: false,
          categoryId: null,
          merchant: null,
          transactionDate: new Date().toISOString(),
        },
        {
          amountMinor: decimalToMinor('20'),
          currency: 'SGD',
          type: 'expense',
          analysisExcluded: false,
          categoryId: null,
          merchant: null,
          transactionDate: new Date().toISOString(),
        },
      ],
      {},
      [],
    );
    expect(snapshot.schema).toBe('finance_assistant_tool_v4');
    expect(Object.keys(snapshot.currencies)).toEqual(['SGD', 'USD']);
    expect(snapshot.currencies.USD.rolling30.current.expenseTotal).toBe(10);
    expect(snapshot.currencies.SGD.rolling30.current.expenseTotal).toBe(20);
  });
});

const expense = (amount: string, date: Date, currency: string | null = 'MYR') => ({
  amountMinor: decimalToMinor(amount),
  currency,
  type: 'expense' as const,
  analysisExcluded: false,
  categoryId: null,
  merchant: null,
  transactionDate: date.toISOString(),
});

describe('calendar month pace', () => {
  const september = [expense('3000', new Date(2026, 8, 15))];

  it('stays null in the first days of a month, so rent on day 1 is not a +1450% forecast', () => {
    const snapshot = buildCalendarMonthTrendSnapshot(
      [...september, expense('1500', new Date(2026, 9, 1, 9))],
      'MYR',
      new Date(2026, 9, 1, 10),
    );
    expect(snapshot.expenseCurrentMonthToDate).toBe(1500);
    expect(snapshot.dailyPaceVsPreviousMonthPct).toBeNull();
    expect(snapshot).not.toHaveProperty('pctExpenseChangeVsPreviousFullMonth');
    for (let day = 2; day < PACE_MIN_DAY_OF_MONTH; day += 1) {
      const later = buildCalendarMonthTrendSnapshot(september, 'MYR', new Date(2026, 9, day, 10));
      expect(later.dailyPaceVsPreviousMonthPct).toBeNull();
    }
  });

  const daily = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => expense('100', new Date(2026, 9, from + i, 9)));

  it('compares average daily spend from day 7 when spending is spread out', () => {
    const snapshot = buildCalendarMonthTrendSnapshot(
      [...september, ...daily(1, 7)],
      'MYR',
      new Date(2026, 9, 7, 10),
    );
    expect(snapshot.dailyPaceVsPreviousMonthPct).toBe(0);
  });

  it.each([8, 12])('stays null on day %i while rent paid on day 1 dominates the month', (day) => {
    const snapshot = buildCalendarMonthTrendSnapshot(
      [...september, expense('1500', new Date(2026, 9, 1, 9)), ...daily(2, day)],
      'MYR',
      new Date(2026, 9, day, 10),
    );
    expect(snapshot.dailyPaceVsPreviousMonthPct).toBeNull();
  });
});

describe('snapshot currency handling', () => {
  it('skips rows without a currency instead of filing them under USD', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const snapshot = buildFinanceAssistantToolSnapshotByCurrency(
      [expense('10', new Date()), expense('99', new Date(), null)],
      {},
      [],
    );
    expect(Object.keys(snapshot.currencies)).toEqual(['MYR']);
    expect(snapshot.currencies.MYR.rolling30.current.expenseTotal).toBe(10);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipped 1 transactions'));
    warn.mockRestore();
  });

  it('leaves the rolling change null when the prior 30 days had nothing to compare with', () => {
    const snapshot = buildFinanceAssistantToolSnapshotByCurrency(
      [expense('10', new Date())],
      {},
      [],
    );
    expect(snapshot.currencies.MYR.rolling30.deltas.expensePctVsPrior).toBeNull();
  });

  it('reports pending proposals per currency without per-row data', () => {
    const snapshot = buildFinanceAssistantToolSnapshotByCurrency(
      [expense('10', new Date())],
      {},
      [],
      [
        { amountMinor: decimalToMinor('12'), currency: 'MYR', type: 'expense' },
        { amountMinor: decimalToMinor('3.50'), currency: 'MYR', type: 'expense' },
        { amountMinor: decimalToMinor('200'), currency: 'MYR', type: 'income' },
        { amountMinor: decimalToMinor('8'), currency: 'SGD', type: 'expense' },
      ],
    );
    expect(snapshot.currencies.MYR.pendingProposals).toEqual({
      count: 3,
      expenseTotal: 15.5,
      incomeTotal: 200,
    });
    expect(snapshot.currencies.SGD.pendingProposals).toEqual({
      count: 1,
      expenseTotal: 8,
      incomeTotal: 0,
    });
    expect(snapshot.currencies.SGD.rolling30.current.expenseTotal).toBe(0);
  });
});
