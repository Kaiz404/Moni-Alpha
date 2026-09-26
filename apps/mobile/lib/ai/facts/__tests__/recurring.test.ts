import type { MinorAmount, RecurringOverride } from '@repo/types';
import { dayKey } from '../days';
import { detectRecurring, pickPayday, type RecurringSeries } from '../recurring';
import { tx } from './synthetic-ledger';

const NOW = new Date(2026, 9, 12, 10);
const on = (month: number, day: number) => new Date(2026, month - 1, day, 9);
const monthly = (
  merchant: string,
  amount: string,
  day: number,
  months: number[],
  type: 'income' | 'expense' = 'expense',
  currency = 'MYR',
) => months.map((m) => tx(on(m, day), type, amount, merchant, { currency }));

function override(over: Partial<RecurringOverride>): RecurringOverride {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    userId: '00000000-0000-4000-8000-000000000002',
    seriesKey: 'MYR|expense|netflix',
    status: 'confirmed',
    kind: null,
    expectedAmountMinor: null,
    expectedDay: null,
    currency: 'MYR',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...over,
  };
}

const labels = (series: RecurringSeries[]) => series.map((s) => s.label).sort();

describe('detectRecurring', () => {
  it('finds a monthly salary that lands early on weekends and makes it payday', () => {
    const salary = [
      tx(on(7, 24), 'income', '4500', 'ACME SDN BHD'),
      tx(on(8, 25), 'income', '4500', 'Acme Sdn Bhd'),
      tx(on(9, 25), 'income', '4500', 'Acme Sdn Bhd'),
    ];
    const series = detectRecurring(salary, [], NOW);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      key: 'MYR|income|acme sdn bhd',
      kind: 'income',
      cadence: 'monthly',
      expectedAmountMinor: 450000,
      occurrences: 3,
      confidence: 0.6,
      needsConfirm: true,
    });
    expect(dayKey(series[0].nextExpectedDay)).toBe('2026-10-25');
    expect(pickPayday(series)?.label).toBe('Acme Sdn Bhd');
  });

  it('keeps one series through a price rise and labels subscriptions by category', () => {
    const netflix = [
      ...monthly('Netflix', '54.90', 10, [6, 7, 8, 9]),
      tx(on(10, 10), 'expense', '59.90', 'NETFLIX'),
    ].map((t) => ({ ...t, categoryId: 'subs' }));
    const [series] = detectRecurring(netflix, [], NOW, { subs: 'Subscriptions' });
    expect(series).toMatchObject({
      kind: 'subscription',
      occurrences: 5,
      confidence: 0.8,
      needsConfirm: false,
    });
    expect(dayKey(series.nextExpectedDay)).toBe('2026-11-10');
  });

  it('finds weekly and biweekly cadences', () => {
    const gym = [on(9, 28), on(10, 5), on(10, 12)].map((d) =>
      tx(d, 'expense', '25', 'Anytime Fitness'),
    );
    const gig = [8, 22].map((d) => tx(on(9, d), 'income', '600', 'Foodpanda Rider'));
    gig.push(tx(on(10, 6), 'income', '640', 'Foodpanda Rider'));
    const series = detectRecurring([...gym, ...gig], [], NOW);
    expect(series.map((s) => [s.label, s.cadence]).sort()).toEqual([
      ['Anytime Fitness', 'weekly'],
      ['Foodpanda Rider', 'biweekly'],
    ]);
    expect(pickPayday(series)).toBeNull();
  });

  it('does not flag one-off purchases, even at a recurring merchant', () => {
    const series = detectRecurring(
      [tx(on(9, 3), 'expense', '2499', 'Apple Store'), tx(on(10, 2), 'expense', '89.90', 'Lazada')],
      [],
      NOW,
    );
    expect(series).toEqual([]);
  });

  it('does not flag weekly groceries whose amounts vary', () => {
    const groceries = [
      ['9', '6', '182.40'],
      ['9', '13', '176.10'],
      ['9', '20', '214.75'],
      ['9', '27', '168.30'],
      ['10', '4', '231.90'],
      ['10', '11', '190.05'],
    ].map(([m, d, amount]) => tx(on(Number(m), Number(d)), 'expense', amount, 'Jaya Grocer'));
    expect(detectRecurring(groceries, [], NOW)).toEqual([]);
  });

  it('does not invent a payday from irregular gig income', () => {
    const gig = [
      [8, 2, '320'],
      [8, 9, '85'],
      [8, 27, '410'],
      [9, 1, '150'],
      [9, 19, '600'],
      [9, 24, '95'],
      [10, 9, '275'],
    ].map(([m, d, amount]) =>
      tx(on(Number(m), Number(d)), 'income', String(amount), 'Grab Driver'),
    );
    const series = detectRecurring(gig, [], NOW);
    expect(series).toEqual([]);
    expect(pickPayday(series)).toBeNull();
  });

  it('needs three payments and never merges two merchants with similar amounts', () => {
    const series = detectRecurring(
      [
        ...monthly('Spotify', '15.90', 5, [8, 9]),
        ...monthly('YouTube Premium', '15.90', 5, [8]),
        tx(on(10, 5), 'expense', '16.90', 'YouTube Premium'),
      ],
      [],
      NOW,
    );
    expect(series).toEqual([]);
  });

  it('retires a series once an expected payment is missed', () => {
    const gym = monthly('Celebrity Fitness', '159', 3, [5, 6, 7, 8]);
    expect(detectRecurring(gym, [], NOW)).toEqual([]);
    expect(labels(detectRecurring(gym, [], new Date(2026, 8, 6)))).toEqual(['Celebrity Fitness']);
  });

  it('keeps currencies apart', () => {
    const series = detectRecurring(
      [
        ...monthly('Spotify', '15.90', 5, [8, 9, 10]),
        ...monthly('Spotify', '9.90', 7, [8, 9, 10], 'expense', 'SGD'),
      ],
      [],
      NOW,
    );
    expect(series.map((s) => [s.key, s.expectedAmountMinor]).sort()).toEqual([
      ['MYR|expense|spotify', 1590],
      ['SGD|expense|spotify', 990],
    ]);
  });

  it('ignores transfers, balance adjustments and debt mirrors', () => {
    const rows = [6, 7, 8, 9, 10].flatMap((m) => [
      tx(on(m, 1), 'transfer', '500', 'Savings', { transferToWalletId: 'savings' }),
      tx(on(m, 2), 'expense', '20', 'Balance fix', { analysisExcluded: true }),
      tx(on(m, 3), 'expense', '100', 'Ali', { debtActivityId: 'debt', analysisExcluded: true }),
    ]);
    expect(detectRecurring(rows, [], NOW)).toEqual([]);
  });
});

describe('recurring overrides', () => {
  const netflix = monthly('Netflix', '54.90', 10, [8, 9, 10]);

  it('hides a dismissed series', () => {
    expect(detectRecurring(netflix, [override({ status: 'dismissed' })], NOW)).toEqual([]);
  });

  it('trusts a confirmed series and applies its kind, amount and day', () => {
    const [series] = detectRecurring(
      netflix,
      [override({ kind: 'bill', expectedAmountMinor: 5990 as MinorAmount, expectedDay: 12 })],
      NOW,
    );
    expect(series).toMatchObject({
      confirmed: true,
      confidence: 1,
      needsConfirm: false,
      kind: 'bill',
      expectedAmountMinor: 5990,
    });
    expect(dayKey(series.nextExpectedDay)).toBe('2026-11-12');
  });

  it('prefers a confirmed income series for payday over a more regular one', () => {
    const series = detectRecurring(
      [
        ...monthly('Acme Sdn Bhd', '4500', 25, [4, 5, 6, 7, 8, 9], 'income'),
        ...monthly('Tuition Centre', '800', 1, [8, 9, 10], 'income'),
      ],
      [override({ seriesKey: 'MYR|income|tuition centre' })],
      NOW,
    );
    expect(pickPayday(series)?.label).toBe('Tuition Centre');
    expect(pickPayday(series.filter((s) => !s.confirmed))?.label).toBe('Acme Sdn Bhd');
  });
});
