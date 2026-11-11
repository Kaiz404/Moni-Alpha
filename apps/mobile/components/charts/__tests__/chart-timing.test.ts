import type { CurrencyCode, MinorAmount } from '@repo/types';

import { spendTarget } from '@/components/charts/spend-geometry';
import { frameFor, linePath } from '@/components/charts/zoom';
import { netWorthTarget } from '@/components/wallets/net-worth-geometry';
import { balanceIndex } from '@/lib/finance/balance-history';
import { spendIndex } from '@/lib/finance/spend-history';
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

/** Median over 7 batches of the mean ms per call. Batches, since this clock ticks in whole ms. */
function time(perBatch: number, work: () => unknown): number {
  work();
  const samples = Array.from({ length: 7 }, () => {
    const start = Date.now();
    for (let run = 0; run < perBatch; run++) work();
    return (Date.now() - start) / perBatch;
  }).sort((a, b) => a - b);
  return Number(samples[3]!.toFixed(3));
}

describe('chart build timing (logged, not asserted)', () => {
  it('builds the All range for 6,000 transactions over 3 years and 4 wallets', () => {
    const transactions = fixture();
    const wallets = WALLETS.map((id) => ({
      id,
      balanceMinor: 500000,
      createdAt: new Date(2023, 0, 1).toISOString(),
    }));
    const spend = () => spendIndex({ now, transactions, currency });
    const balance = () => balanceIndex({ now, wallets, transactions });
    const index = spend();
    const balances = balance();
    const frame = frameFor(314, 44, 142);
    const month = { name: 'November', daysInMonth: 30, budget: 180000, safePerDay: null };
    const all = spendTarget({ index, now, range: 'all', mode: 'pace', month, currency });
    const names = Object.fromEntries(WALLETS.map((id) => [id, id]));
    const worth = netWorthTarget({ index: balances, now, range: 'all', view: 'by-wallet', names, currency });
    const result = {
      spendIndexMs: time(20, spend),
      balanceIndexMs: time(20, balance),
      spendAllTargetMs: time(20, () =>
        spendTarget({ index, now, range: 'all', mode: 'pace', month, currency }),
      ),
      spendAllPathMs: time(500, () =>
        linePath(index.cumulative, all.from, all.to, 0, all.high, all.shift, frame, 1),
      ),
      netWorthAllTargetMs: time(20, () =>
        netWorthTarget({ index: balances, now, range: 'all', view: 'by-wallet', names, currency }),
      ),
      netWorthAllPathMs: time(500, () =>
        linePath(balances.total, worth.from, worth.to, worth.low, worth.high, 0, frame, 1),
      ),
      pathPoints: linePath(index.cumulative, all.from, all.to, 0, all.high, all.shift, frame, 1).d.split(' ').length,
      days: balances.days,
    };
    console.log(JSON.stringify(result));
    expect(result.days).toBeGreaterThan(DAYS);
  });
});
