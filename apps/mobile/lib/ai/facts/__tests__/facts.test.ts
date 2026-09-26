import { decimalToMinor } from '@repo/types';
import { buildFinanceAssistantToolSnapshotByCurrency } from '@/lib/ai/snapshot/finance-metrics';
import { buildFinanceFactsByCurrency, parseAskedAmount } from '../index';
import { salariedLedger, tx, wallet } from './synthetic-ledger';

const NOW = new Date(2026, 9, 11, 22);

describe('parseAskedAmount', () => {
  it.each([
    ['Can I afford RM800?', 80000, 'MYR'],
    ['can i afford rm 1,250.50 for a phone', 125050, 'MYR'],
    ['Should I buy 300 sgd of shoes this week?', 30000, 'SGD'],
    ['Can I spend S$45 on dinner?', 4500, 'SGD'],
    ['can I afford $20', 2000, 'USD'],
    ['Can I afford 800?', 80000, null],
  ])('%s', (message, minor, currency) => {
    expect(parseAskedAmount(message)).toEqual({ amountMinor: minor, currency });
  });

  it.each([
    'Will I make it to payday on the 25th?',
    'Did I spend RM50 on food?',
    'How much did I spend in September 2026?',
    'Is 300 sgd ok this week?',
  ])('ignores %s, which asks about no purchase', (message) => {
    expect(parseAskedAmount(message)).toBeNull();
  });
});

describe('buildFinanceFactsByCurrency', () => {
  const { wallets, transactions } = salariedLedger();
  const sgd = [8, 9, 10].map((m) =>
    tx(new Date(2026, m - 1, 3, 9), 'expense', '9.90', 'Spotify', {
      currency: 'SGD',
      walletId: 'sgd',
    }),
  );
  const facts = buildFinanceFactsByCurrency(
    {
      wallets: [
        ...wallets.map((w) => ({ ...w, balanceConfirmedAt: NOW.toISOString() })),
        wallet({ id: 'sgd', currency: 'SGD', initialBalanceMinor: decimalToMinor('100') }),
        wallet({ id: 'card', type: 'credit', initialBalanceMinor: decimalToMinor('0') }),
      ],
      transactions: [...transactions, ...sgd],
      overrides: [],
      askedAmount: { amountMinor: decimalToMinor('800'), currency: 'MYR' },
    },
    NOW,
  );

  it('keeps every currency on its own key with its own series and balance', () => {
    expect(Object.keys(facts)).toEqual(['MYR', 'SGD']);
    expect(facts.SGD.recurring.map((r) => [r.name, r.amount, r.kind])).toEqual([
      ['Spotify', 9.9, 'bill'],
    ]);
    expect(facts.SGD.balances).toEqual({ liquid: 70.3, changeLast30Days: -9.9, walletCount: 1 });
    expect(facts.SGD.payday).toBeNull();
    expect(facts.SGD.forecast).toMatchObject({
      status: 'insufficient',
      reasons: ['wallet balances not confirmed recently'],
    });
  });

  it('lists the salary first, names payday and forecasts to it with the asked amount', () => {
    expect(facts.MYR.recurring.map((r) => r.name)).toEqual([
      'Acme Sdn Bhd',
      'Landlord',
      'Unifi',
      'Netflix',
      'CelcomDigi',
    ]);
    expect(facts.MYR.payday).toEqual({
      name: 'Acme Sdn Bhd',
      amount: 4500,
      cadence: 'monthly',
      nextDate: '2026-10-25',
    });
    expect(facts.MYR.balances?.walletCount).toBe(2);
    expect(facts.MYR.forecast).toMatchObject({
      status: 'ready',
      horizon: 'payday',
      horizonDate: '2026-10-25',
    });
    expect(facts.MYR.forecast.status === 'ready' && facts.MYR.forecast.afford?.amount).toBe(800);
  });

  it('feeds snapshot v4, one facts block per currency', () => {
    const snapshot = buildFinanceAssistantToolSnapshotByCurrency([], {}, [], [], NOW, facts);
    expect(snapshot.schema).toBe('finance_assistant_tool_v4');
    expect(Object.keys(snapshot.currencies)).toEqual(['MYR', 'SGD']);
    expect(snapshot.currencies.MYR.facts).toBe(facts.MYR);
    expect(snapshot.currencies.SGD.facts).toBe(facts.SGD);
  });
});
