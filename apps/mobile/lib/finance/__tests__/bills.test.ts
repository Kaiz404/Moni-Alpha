import type { MinorAmount, RecurringOverride } from '@repo/types';
import { tx } from '@/lib/ai/facts/__tests__/synthetic-ledger';
import { selectUpcomingBills } from '../bills';

const WED_14_OCT = new Date(2026, 9, 14, 10);
const on = (month: number, day: number) => new Date(2026, month - 1, day, 9);
const netflix = (months: number[]) =>
  months.map((m) => tx(on(m, 15), 'expense', '54.90', 'Netflix'));

function override(over: Partial<RecurringOverride>): RecurringOverride {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    userId: '00000000-0000-4000-8000-000000000002',
    seriesKey: 'MYR|expense|unifi',
    status: 'confirmed',
    kind: 'bill',
    expectedAmountMinor: 12900 as MinorAmount,
    expectedDay: 20,
    currency: 'MYR',
    createdAt: WED_14_OCT.toISOString(),
    updatedAt: WED_14_OCT.toISOString(),
    ...over,
  };
}

describe('selectUpcomingBills', () => {
  it('lists a monthly Netflix charge as due tomorrow', () => {
    expect(selectUpcomingBills(WED_14_OCT, netflix([7, 8, 9]), [])).toEqual([
      {
        seriesKey: 'MYR|expense|netflix',
        name: 'Netflix',
        amountMinor: 5490,
        currency: 'MYR',
        dueDate: '2026-10-15',
        status: 'due',
      },
    ]);
  });

  it('marks the bill paid once this month’s charge landed', () => {
    const [bill] = selectUpcomingBills(new Date(2026, 9, 20, 10), netflix([7, 8, 9, 10]), []);
    expect(bill).toMatchObject({ dueDate: '2026-10-15', status: 'paid' });
  });

  it('adds a confirmed bill that has no history yet, due on its expected day', () => {
    expect(selectUpcomingBills(WED_14_OCT, [], [override({})])).toEqual([
      {
        seriesKey: 'MYR|expense|unifi',
        name: 'unifi',
        amountMinor: 12900,
        currency: 'MYR',
        dueDate: '2026-10-20',
        status: 'due',
      },
    ]);
  });

  it('leaves out income, dismissed series, and verdicts that are not bills', () => {
    const salary = [7, 8, 9].map((m) => tx(on(m, 25), 'income', '4500', 'Acme'));
    const bills = selectUpcomingBills(
      WED_14_OCT,
      [...salary, ...netflix([7, 8, 9])],
      [
        override({ seriesKey: 'MYR|expense|netflix', status: 'dismissed', kind: null }),
        override({ seriesKey: 'MYR|income|acme', kind: 'income' }),
      ],
    );
    expect(bills).toEqual([]);
  });
});
