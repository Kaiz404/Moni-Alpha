import type { MinorAmount } from '@repo/types';

import type { FinanceTransaction } from '../types';
import { balanceHistory } from '../balance-history';

type Row = Pick<
  FinanceTransaction,
  'walletId' | 'transferToWalletId' | 'amountMinor' | 'type' | 'transactionDate'
>;

function row(
  type: Row['type'],
  walletId: string,
  amount: number,
  date: Date,
  transferToWalletId: string | null = null,
): Row {
  return {
    type,
    walletId,
    transferToWalletId,
    amountMinor: amount as MinorAmount,
    transactionDate: date.toISOString(),
  };
}

const noon = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12);
const old = noon(2020, 1, 1).toISOString();

describe('balanceHistory', () => {
  it('walks back from the live balance so the last point equals it', () => {
    const history = balanceHistory({
      now: noon(2026, 10, 4),
      range: 'month',
      wallets: [{ id: 'maybank', balanceMinor: 10000, createdAt: old }],
      transactions: [
        row('expense', 'maybank', 500, noon(2026, 10, 3)),
        row('income', 'maybank', 2000, noon(2026, 10, 2)),
        row('expense', 'maybank', 999, noon(2026, 9, 30)),
      ],
    });
    expect(history).toEqual({
      days: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
      total: [8500, 10500, 10000, 10000],
      byWallet: { maybank: [8500, 10500, 10000, 10000] },
    });
  });

  it('moves two lines and leaves the total alone on a transfer between wallets', () => {
    const history = balanceHistory({
      now: noon(2026, 10, 3),
      range: 'month',
      wallets: [
        { id: 'maybank', balanceMinor: 7000, createdAt: old },
        { id: 'tng', balanceMinor: 3000, createdAt: old },
      ],
      transactions: [row('transfer', 'maybank', 1000, noon(2026, 10, 2), 'tng')],
    });
    expect(history.total).toEqual([10000, 10000, 10000]);
    expect(history.byWallet).toEqual({
      maybank: [8000, 7000, 7000],
      tng: [2000, 3000, 3000],
    });
  });

  it('counts only the end of a transfer that is a listed wallet', () => {
    const history = balanceHistory({
      now: noon(2026, 10, 2),
      range: 'month',
      wallets: [{ id: 'maybank', balanceMinor: 7000, createdAt: old }],
      transactions: [row('transfer', 'wise', 1000, noon(2026, 10, 2), 'maybank')],
    });
    expect(history.total).toEqual([6000, 7000]);
  });

  it('crosses a year boundary with thirty days ending today', () => {
    const history = balanceHistory({
      now: noon(2027, 1, 5),
      range: '30d',
      wallets: [{ id: 'maybank', balanceMinor: 5000, createdAt: old }],
      transactions: [row('expense', 'maybank', 700, noon(2027, 1, 1))],
    });
    expect(history.days).toHaveLength(30);
    expect(history.days[0]).toBe('2026-12-07');
    expect(history.days[25]).toBe('2027-01-01');
    expect(history.days[29]).toBe('2027-01-05');
    expect(history.total[24]).toBe(5700);
    expect(history.total[25]).toBe(5000);
  });

  it('runs ninety days and a full year back on the calendar', () => {
    const on = (range: '90d' | '1y') =>
      balanceHistory({
        now: noon(2026, 11, 2),
        range,
        wallets: [{ id: 'maybank', balanceMinor: 100, createdAt: old }],
        transactions: [],
      }).days;
    expect(on('90d')).toHaveLength(90);
    expect(on('90d')[0]).toBe('2026-08-05');
    expect(on('1y')).toHaveLength(366);
    expect(on('1y')[0]).toBe('2025-11-02');
  });

  it('gives each local day exactly once across a daylight saving change', () => {
    // 8 March and 1 November 2026 are the US changes. Run with TZ=America/New_York to feel them.
    const days = (now: Date) =>
      balanceHistory({
        now,
        range: '30d',
        wallets: [{ id: 'maybank', balanceMinor: 100, createdAt: old }],
        transactions: [],
      }).days;
    const spring = days(noon(2026, 3, 20));
    expect(spring.slice(16, 21)).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
    ]);
    const autumn = days(noon(2026, 11, 10));
    expect(autumn.slice(19, 23)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
    expect(new Set(autumn).size).toBe(30);
  });

  it('keeps a transaction dated after today out of today', () => {
    const history = balanceHistory({
      now: noon(2026, 10, 2),
      range: 'month',
      wallets: [{ id: 'maybank', balanceMinor: 9000, createdAt: old }],
      transactions: [
        row('expense', 'maybank', 1000, noon(2026, 10, 9)),
        row('expense', 'maybank', 400, noon(2026, 11, 1)),
      ],
    });
    expect(history.total).toEqual([10400, 10400]);
  });

  it('counts a transaction later today in today', () => {
    const history = balanceHistory({
      now: noon(2026, 10, 2),
      range: 'month',
      wallets: [{ id: 'maybank', balanceMinor: 9000, createdAt: old }],
      transactions: [row('expense', 'maybank', 1000, new Date(2026, 9, 2, 23, 30))],
    });
    expect(history.total).toEqual([10000, 9000]);
  });

  it('starts the axis on the day the first wallet began and draws no line before a later one', () => {
    const history = balanceHistory({
      now: noon(2026, 10, 10),
      range: '1y',
      wallets: [
        { id: 'maybank', balanceMinor: 5000, createdAt: noon(2026, 10, 7).toISOString() },
        { id: 'cash', balanceMinor: 200, createdAt: noon(2026, 10, 9).toISOString() },
      ],
      transactions: [],
    });
    expect(history).toEqual({
      days: ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'],
      total: [5000, 5000, 5200, 5200],
      byWallet: {
        maybank: [5000, 5000, 5000, 5000],
        cash: [null, null, 200, 200],
      },
    });
  });

  it('begins a wallet on a transaction backdated before it was created', () => {
    const history = balanceHistory({
      now: noon(2026, 10, 10),
      range: 'month',
      wallets: [{ id: 'maybank', balanceMinor: 900, createdAt: noon(2026, 10, 9).toISOString() }],
      transactions: [row('expense', 'maybank', 100, noon(2026, 10, 8))],
    });
    expect(history.days).toEqual(['2026-10-08', '2026-10-09', '2026-10-10']);
    expect(history.total).toEqual([900, 900, 900]);
  });

  it('treats a wallet the server has not dated yet as beginning today', () => {
    const history = balanceHistory({
      now: noon(2026, 10, 10),
      range: '30d',
      wallets: [{ id: 'new', balanceMinor: 300 }],
      transactions: [row('expense', 'new', 50, noon(2026, 10, 12))],
    });
    expect(history).toEqual({
      days: ['2026-10-10'],
      total: [350],
      byWallet: { new: [350] },
    });
  });
});
