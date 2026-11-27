import { describe, expect, it } from 'vitest';
import type { MinorAmount, RecurringOverride } from '@repo/types';

import { createCalendar } from '../../calendar';
import { billDueFrom, paymentBill, selectBillsAhead, selectUpcomingBills } from '../bills';
import { BANK, on, tx } from './facts-rows';

const KL = createCalendar('Asia/Kuala_Lumpur');
const WED_14_OCT = new Date('2026-10-14T10:00:00+08:00');
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
    expect(selectUpcomingBills(WED_14_OCT, netflix([7, 8, 9]), [], KL)).toEqual([
      {
        seriesKey: 'MYR|expense|netflix',
        name: 'Netflix',
        amountMinor: 5490,
        currency: 'MYR',
        dueDate: '2026-10-15',
        status: 'due',
        walletId: BANK,
        categoryId: null,
      },
    ]);
  });

  it('marks the bill paid once this month’s charge landed', () => {
    const [bill] = selectUpcomingBills(new Date('2026-10-20T10:00:00+08:00'), netflix([7, 8, 9, 10]), [], KL);
    expect(bill).toMatchObject({ dueDate: '2026-10-15', status: 'paid' });
  });

  it('adds a confirmed bill that has no history yet, due on its expected day', () => {
    expect(selectUpcomingBills(WED_14_OCT, [], [override({})], KL)).toEqual([
      {
        seriesKey: 'MYR|expense|unifi',
        name: 'unifi',
        amountMinor: 12900,
        currency: 'MYR',
        dueDate: '2026-10-20',
        status: 'due',
        walletId: null,
        categoryId: null,
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
      KL,
    );
    expect(bills).toEqual([]);
  });

  it('skips a bill for the month its skipPeriod names', () => {
    const [bill] = selectUpcomingBills(WED_14_OCT, netflix([7, 8, 9]), [
      override({ seriesKey: 'MYR|expense|netflix', kind: 'subscription', skipPeriod: '2026-10' }),
    ], KL);
    expect(bill).toMatchObject({ seriesKey: 'MYR|expense|netflix', status: 'skipped' });
  });

  it('dates a bill with no payments on its expected day', () => {
    const [bill] = selectUpcomingBills(WED_14_OCT, [], [override({ expectedDay: 20 })], KL);
    expect(bill!.dueDate).toBe('2026-10-20');
  });

  it('marks a bill the user added paid once a payment under its name lands this month', () => {
    const [bill] = selectUpcomingBills(
      WED_14_OCT,
      [tx(on(10, 14), 'expense', '129.00', 'Unifi')],
      [override({ name: 'Unifi fibre' })],
      KL,
    );
    expect(bill).toMatchObject({ name: 'Unifi fibre', status: 'paid', walletId: BANK });
  });

  it('shows a bill due once only in its own month', () => {
    const once = override({ dueOnce: '2026-11-03', expectedDay: 3 });
    expect(selectUpcomingBills(WED_14_OCT, [], [once], KL)).toEqual([]);
    expect(
      selectUpcomingBills(new Date('2026-11-01T09:00:00+08:00'), [], [once], KL),
    ).toMatchObject([{ dueDate: '2026-11-03', status: 'due' }]);
  });

  it('uses the name, amount and wallet the user gave a detected bill', () => {
    const [bill] = selectUpcomingBills(WED_14_OCT, netflix([7, 8, 9]), [
      override({
        seriesKey: 'MYR|expense|netflix',
        kind: 'subscription',
        name: 'Netflix Premium',
        expectedAmountMinor: 6290 as MinorAmount,
        expectedDay: 15,
        walletId: 'wallet-2',
      }),
    ], KL);
    expect(bill).toMatchObject({
      name: 'Netflix Premium',
      amountMinor: 6290,
      dueDate: '2026-10-15',
      walletId: 'wallet-2',
      status: 'due',
    });
  });

  it('reads this month and its payments in the calendar zone', () => {
    const rent = ['08', '09', '10'].map((m) =>
      tx(`2026-${m}-01T07:00:00+08:00`, 'expense', '1500', 'Landlord'),
    );
    const due = (zone: string) =>
      selectUpcomingBills(WED_14_OCT, rent, [], createCalendar(zone)).map((bill) => [
        bill.dueDate,
        bill.status,
      ]);
    expect(due('Asia/Kuala_Lumpur')).toEqual([['2026-10-01', 'paid']]);
    expect(due('UTC')).toEqual([['2026-10-31', 'due']]);
  });
});

describe('selectBillsAhead', () => {
  it("adds next month's round of a bill already paid this month, in any zone", () => {
    const thirtieth = new Date('2026-10-30T10:00:00+08:00');
    for (const zone of ['Asia/Kuala_Lumpur', 'Europe/London']) {
      expect(
        selectBillsAhead(thirtieth, netflix([7, 8, 9, 10]), [], createCalendar(zone)).map(
          (bill) => [bill.dueDate, bill.status],
        ),
      ).toEqual([
        ['2026-10-15', 'paid'],
        ['2026-11-15', 'due'],
      ]);
    }
  });
});

describe('paymentBill', () => {
  const unifi = tx(on(10, 3), 'expense', '129.00', 'Unifi');

  it('offers a lone payment quietly, and loudly when its category reads as a bill', () => {
    for (const zone of ['Asia/Kuala_Lumpur', 'Europe/London']) {
      const calendar = createCalendar(zone);
      expect(paymentBill(unifi, [unifi], [], WED_14_OCT, calendar, 'Shopping')).toEqual({
        kind: 'offer',
        seriesKey: 'MYR|expense|unifi',
        likely: false,
      });
      expect(paymentBill(unifi, [unifi], [], WED_14_OCT, calendar, 'Utilities')).toEqual({
        kind: 'offer',
        seriesKey: 'MYR|expense|unifi',
        likely: true,
      });
    }
  });

  it('reads a payment to the same merchant about a month before as a bill', () => {
    const september = tx(on(9, 4), 'expense', '129.00', 'Unifi');
    expect(paymentBill(unifi, [september, unifi], [], WED_14_OCT, KL, null)).toMatchObject({ likely: true });
    const lastWeek = tx(on(9, 26), 'expense', '129.00', 'Unifi');
    expect(paymentBill(unifi, [lastWeek, unifi], [], WED_14_OCT, KL, null)).toMatchObject({ likely: false });
  });

  it('says a payment is already a bill once one of this month holds its merchant', () => {
    expect(paymentBill(unifi, [unifi], [override({})], WED_14_OCT, KL, null)).toEqual({
      kind: 'bill',
      seriesKey: 'MYR|expense|unifi',
      once: false,
    });
    const charges = netflix([7, 8, 9, 10]);
    expect(paymentBill(charges[3]!, charges, [], WED_14_OCT, KL, null)).toEqual({
      kind: 'bill',
      seriesKey: 'MYR|expense|netflix',
      once: false,
    });
  });

  it('offers nothing for income, a transfer or a payment with no merchant', () => {
    expect(paymentBill(tx(on(10, 1), 'income', '4200', 'Acme'), [], [], WED_14_OCT, KL, null)).toBeNull();
    expect(paymentBill(tx(on(10, 1), 'transfer', '50', 'Wise'), [], [], WED_14_OCT, KL, null)).toBeNull();
    expect(paymentBill(tx(on(10, 1), 'expense', '12', null), [], [], WED_14_OCT, KL, null)).toBeNull();
  });
});

describe('billDueFrom', () => {
  it("is next month's day for a payment this month, and this month's when the day is still ahead", () => {
    expect(billDueFrom('2026-10-03', '2026-10-14')).toBe('2026-11-03');
    expect(billDueFrom('2026-10-14', '2026-10-14')).toBe('2026-11-14');
    expect(billDueFrom('2026-09-20', '2026-10-14')).toBe('2026-10-20');
    expect(billDueFrom('2026-09-14', '2026-10-14')).toBe('2026-10-14');
    expect(billDueFrom('2026-08-31', '2026-10-14')).toBe('2026-10-31');
    expect(billDueFrom('2026-10-31', '2026-11-02')).toBe('2026-11-30');
  });
});
