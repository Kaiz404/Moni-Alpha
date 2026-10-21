import { decimalToMinor } from '@repo/types';
import { rowAmount, rowMeta } from '@/components/ui/transaction-row';
import { expense } from '@/lib/wallets/__tests__/balance-fixture';
import { transactionRow } from '../row';

jest.mock('uniwind', () => ({
  useCSSVariable: (names: string[]) => names.map(() => undefined),
  useUniwind: () => ({ theme: 'light' }),
}));

const lookups = { categoriesById: {}, walletNames: { maybank: 'Maybank' } };

describe('transactionRow for a balance correction', () => {
  it('reads Balance correction, not in budgets, whatever the stored title', () => {
    const row = transactionRow(
      expense('c1', '2026-10-14T06:06:00.000Z', {
        merchant: null,
        description: 'Balance adjustment',
        amountMinor: decimalToMinor('3.60'),
        analysisExcluded: true,
        balanceCorrection: true,
      }),
      lookups,
    );
    expect([row.title, rowMeta(row, 'category'), rowAmount(row)]).toEqual([
      'Balance correction',
      'Not in budgets · Maybank',
      '−RM3.60',
    ]);
  });
});
