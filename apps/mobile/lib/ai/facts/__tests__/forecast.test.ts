import { decimalToMinor } from '@repo/types';
import { gigLedger } from '@/lib/ai/chat/bench/fixture';
import { backtestForecast, forecastCurrency, type FactsWallet } from '../forecast';
import { detectRecurring, pickPayday, type FactsTransaction } from '../recurring';
import { salariedLedger, tx, wallet } from './synthetic-ledger';

const NOW = new Date(2026, 9, 12, 10);
const confirmed = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

/** Jul 20 to Oct 11: RM30 a day on meals, salary on the 25th, rent on the 1st, Netflix on the 15th. */
function steadyLedger(): FactsTransaction[] {
  const rows: FactsTransaction[] = [];
  for (let d = new Date(2026, 6, 20, 12); d < NOW; d.setDate(d.getDate() + 1)) {
    rows.push(tx(new Date(d), 'expense', '30', 'Mamak Corner'));
  }
  for (const [m, d] of [
    [6, 24],
    [7, 25],
    [8, 25],
  ])
    rows.push(tx(new Date(2026, m, d, 7), 'income', '4000', 'Acme Sdn Bhd'));
  for (const m of [7, 8, 9]) rows.push(tx(new Date(2026, m, 1, 8), 'expense', '1200', 'Landlord'));
  for (const m of [6, 7, 8]) rows.push(tx(new Date(2026, m, 15, 8), 'expense', '54.90', 'Netflix'));
  return rows;
}

function forecast(
  transactions: FactsTransaction[],
  wallets: FactsWallet[] = [wallet({ balanceConfirmedAt: confirmed(3) })],
  now = NOW,
  extra?: string,
) {
  const series = detectRecurring(transactions, [], now);
  return forecastCurrency({
    currency: 'MYR',
    wallets,
    transactions,
    series,
    payday: pickPayday(series),
    now,
    extraSpendMinor: extra ? decimalToMinor(extra) : null,
  });
}

describe('forecastCurrency', () => {
  it('runs to payday: balance minus bills due before it minus day-to-day spend', () => {
    expect(forecast(steadyLedger(), undefined, NOW, '800')).toEqual({
      status: 'ready',
      horizon: 'payday',
      horizonDate: '2026-10-25',
      daysLeft: 13,
      startBalance: 8715.3,
      bills: [{ name: 'Netflix', amount: 54.9, date: '2026-10-15' }],
      billsTotal: 54.9,
      income: [],
      incomeTotal: 0,
      variableSpend: { low: 390, likely: 390, high: 390 },
      endBalance: { low: 8270.4, likely: 8270.4, high: 8270.4 },
      afford: { amount: 800, worstCaseAfter: 7470.4, likelyAfter: 7470.4, fitsWorstCase: true },
      historyDays: 89,
      coveragePct: 100,
      balanceConfirmedDaysAgo: 3,
    });
  });

  it('says a purchase does not fit when the worst case would go below zero', () => {
    const result = forecast(steadyLedger(), undefined, NOW, '9000');
    expect(result.status === 'ready' && result.afford).toEqual({
      amount: 9000,
      worstCaseAfter: -729.6,
      likelyAfter: -729.6,
      fitsWorstCase: false,
    });
  });

  it('runs to month end when no payday is known', () => {
    const noSalary = steadyLedger().filter((t) => t.type !== 'income');
    const result = forecast(noSalary, [
      wallet({ initialBalanceMinor: decimalToMinor('20000'), balanceConfirmedAt: confirmed(0) }),
    ]);
    expect(result).toMatchObject({
      status: 'ready',
      horizon: 'month_end',
      horizonDate: '2026-10-31',
      daysLeft: 20,
    });
    expect(result.status === 'ready' && result.bills).toEqual([
      { name: 'Netflix', amount: 54.9, date: '2026-10-15' },
    ]);
  });

  it.each([
    [
      'short history',
      new Date(2026, 7, 20, 10),
      [wallet({ balanceConfirmedAt: '2026-08-19T00:00:00.000Z' })],
      'not enough history yet',
    ],
    [
      'a stale balance',
      NOW,
      [wallet({ balanceConfirmedAt: confirmed(40) })],
      'wallet balances not confirmed recently',
    ],
    [
      'a never-confirmed wallet',
      NOW,
      [wallet(), wallet({ id: 'cash', type: 'cash', balanceConfirmedAt: confirmed(1) })],
      'wallet balances not confirmed recently',
    ],
    [
      'only a credit card',
      NOW,
      [wallet({ type: 'credit', balanceConfirmedAt: confirmed(1) })],
      'no cash, bank or e-wallet account in this currency',
    ],
  ])('refuses with %s', (_, now, wallets, reason) => {
    const result = forecast(
      steadyLedger().filter((t) => new Date(t.transactionDate) <= now),
      wallets,
      now,
    );
    expect(result.status).toBe('insufficient');
    expect(result.status === 'insufficient' && result.reasons).toContain(reason);
  });

  it('ignores a dormant empty wallet the user never confirmed', () => {
    const result = forecast(steadyLedger(), [
      wallet({ balanceConfirmedAt: confirmed(3) }),
      wallet({ id: 'cash', type: 'cash', initialBalanceMinor: decimalToMinor('0') }),
    ]);
    expect(result).toMatchObject({ status: 'ready', balanceConfirmedDaysAgo: 3 });
  });

  it('still needs an empty wallet confirmed once it was used in the last eight weeks', () => {
    const rows = [
      ...steadyLedger(),
      tx(new Date(2026, 8, 20), 'transfer', '50', null, { transferToWalletId: 'cash' }),
      tx(new Date(2026, 8, 21), 'expense', '50', 'Kopitiam', { walletId: 'cash' }),
    ];
    const result = forecast(rows, [
      wallet({ balanceConfirmedAt: confirmed(3) }),
      wallet({ id: 'cash', type: 'cash', initialBalanceMinor: decimalToMinor('0') }),
    ]);
    expect(result).toMatchObject({
      status: 'insufficient',
      reasons: ['wallet balances not confirmed recently'],
    });
  });

  it('refuses without a payday when unscheduled income is over a fifth of spending', () => {
    const { wallets, transactions } = gigLedger();
    expect(forecast(transactions, wallets)).toMatchObject({
      status: 'insufficient',
      reasons: ['income arrives without a regular payday'],
    });
  });

  it('refuses when balance corrections show most spending went unlogged', () => {
    const rows = [
      ...steadyLedger(),
      tx(new Date(2026, 9, 5), 'expense', '3000', null, { analysisExcluded: true }),
    ];
    const result = forecast(rows);
    expect(result).toMatchObject({
      status: 'insufficient',
      reasons: ['too much spending not logged'],
      coveragePct: 58,
    });
  });

  it('refuses a range wider than 40% of the starting balance', () => {
    const lumpy: FactsTransaction[] = [];
    for (let d = new Date(2026, 6, 20, 12); d < NOW; d.setDate(d.getDate() + 10))
      lumpy.push(tx(new Date(d), 'expense', '400', 'Shopee'));
    const result = forecast(lumpy, [
      wallet({ initialBalanceMinor: decimalToMinor('4600'), balanceConfirmedAt: confirmed(1) }),
    ]);
    expect(result).toMatchObject({
      status: 'insufficient',
      reasons: ['spending too uneven for a useful range'],
    });
  });

  it('counts transfers between wallets once and leaves credit cards out of the balance', () => {
    const rows = [
      ...steadyLedger(),
      tx(new Date(2026, 9, 11), 'transfer', '500', null, { transferToWalletId: 'tng' }),
      tx(new Date(2026, 9, 11), 'transfer', '300', null, { transferToWalletId: 'card' }),
    ];
    const result = forecast(rows, [
      wallet({ balanceConfirmedAt: confirmed(1) }),
      wallet({
        id: 'tng',
        type: 'ewallet',
        initialBalanceMinor: decimalToMinor('0'),
        balanceConfirmedAt: confirmed(1),
      }),
      wallet({ id: 'card', type: 'credit', initialBalanceMinor: decimalToMinor('0') }),
    ]);
    expect(result.status === 'ready' && result.startBalance).toBe(8415.3);
  });
});

describe('backtestForecast', () => {
  it('lands the real pre-payday balance inside [low, high] at least 75% of the time', () => {
    let inside = 0;
    let evaluated = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      const { wallets, transactions } = salariedLedger(seed);
      const days: Date[] = [];
      for (
        let d = new Date(2026, 6, 1, 8);
        d <= new Date(2026, 8, 30, 8);
        d.setDate(d.getDate() + 1)
      )
        days.push(new Date(d));
      const result = backtestForecast({ currency: 'MYR', wallets, transactions, days });
      inside += result.inside;
      evaluated += result.evaluated;
    }
    expect(evaluated).toBeGreaterThan(800);
    expect(inside / evaluated).toBeGreaterThanOrEqual(0.75);
  });

  it('only scores forecasts whose horizon has already happened', () => {
    const { wallets, transactions } = salariedLedger();
    expect(
      backtestForecast({ currency: 'MYR', wallets, transactions, days: [new Date(2026, 9, 1, 8)] }),
    ).toEqual({ evaluated: 0, inside: 0, share: 0 });
  });
});
