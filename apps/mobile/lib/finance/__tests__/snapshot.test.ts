import { decimalToMinor } from '@repo/types';
import { buildFinanceAssistantToolSnapshotByCurrency } from '@/lib/ai/snapshot/finance-metrics';

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
    expect(snapshot.schema).toBe('finance_assistant_tool_v2');
    expect(Object.keys(snapshot.currencies)).toEqual(['SGD', 'USD']);
    expect(snapshot.currencies.USD.rolling30.current.expenseTotal).toBe(10);
    expect(snapshot.currencies.SGD.rolling30.current.expenseTotal).toBe(20);
  });
});
