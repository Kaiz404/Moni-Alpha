import type { CurrencyCode, MinorAmount } from '@repo/types';

import { rangeGeometry } from '@/components/charts/pace-geometry';
import { netWorthGeometry } from '@/components/wallets/net-worth-geometry';
import { balanceHistory } from '@/lib/finance/balance-history';
import { spendHistory } from '@/lib/finance/spend-history';
import type { FinanceTransaction } from '@/lib/finance/types';

const now = new Date(2026, 10, 12, 12);
const currency = 'MYR' as CurrencyCode;
const WALLETS = ['a', 'b', 'c', 'd'];
const DAYS = 3 * 365;

function fixture(): FinanceTransaction[] {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 6000 }, (_, index) => {
    const back = Math.floor(random() * DAYS);
    const kind = random();
    return {
      id: `t${index}`,
      type: kind < 0.85 ? 'expense' : kind < 0.95 ? 'income' : 'transfer',
      currency,
      amountMinor: Math.round(500 + random() * 20000) as MinorAmount,
      walletId: WALLETS[index % 4]!,
      transferToWalletId: kind >= 0.95 ? WALLETS[(index + 1) % 4]! : null,
      transactionDate: new Date(2026, 10, 12 - back, 9).toISOString(),
      analysisExcluded: false,
      debtActivityId: null,
    } as FinanceTransaction;
  });
}

/** Median of `runs` timings in ms. */
function time(runs: number, work: () => unknown): number {
  const samples = Array.from({ length: runs }, () => {
    const start = performance.now();
    work();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return Number(samples[Math.floor(runs / 2)]!.toFixed(2));
}

describe('chart build timing (logged, not asserted)', () => {
  it('builds the All range for 6,000 transactions over 3 years and 4 wallets', () => {
    const transactions = fixture();
    const wallets = WALLETS.map((id) => ({
      id,
      balanceMinor: 500000,
      createdAt: new Date(2023, 0, 1).toISOString(),
    }));
    const spend = () => spendHistory({ now, range: 'all', transactions, currency });
    const balance = () => balanceHistory({ now, range: 'all', wallets, transactions });
    const history = spend();
    const balances = balance();
    const result = {
      spendIndexMs: time(9, spend),
      balanceIndexMs: time(9, balance),
      spendAllPathMs: time(9, () =>
        rangeGeometry({ mode: 'pace', history, currency, width: 314 }),
      ),
      netWorthAllPathMs: time(9, () =>
        netWorthGeometry({
          history: balances,
          view: 'by-wallet',
          names: Object.fromEntries(WALLETS.map((id) => [id, id])),
          width: 314,
          currency,
        }),
      ),
      days: balances.days.length,
    };
    console.log(JSON.stringify(result));
    expect(result.days).toBeGreaterThan(DAYS);
  });
});
