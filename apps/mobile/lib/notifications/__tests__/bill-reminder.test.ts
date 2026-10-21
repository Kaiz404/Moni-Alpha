import type { MinorAmount, RecurringOverride, UpcomingBill } from '@repo/types';

import { billReminders, reminderAt } from '../bill-reminder';

const WED_14_OCT = new Date(2026, 9, 14, 14, 6);

function bill(over: Partial<UpcomingBill>): UpcomingBill {
  return {
    seriesKey: 'MYR|expense|netflix',
    name: 'Netflix',
    amountMinor: 5490 as MinorAmount,
    currency: 'MYR',
    dueDate: '2026-10-15',
    status: 'due',
    walletId: null,
    categoryId: null,
    ...over,
  };
}

const remind = (seriesKey: string) => ({ seriesKey, remind: true }) as RecurringOverride;

describe('billReminders', () => {
  it('reminds at 9:00 am the day before', () => {
    expect(reminderAt('2026-10-15')).toEqual(new Date(2026, 9, 14, 9));
  });

  it('plans one reminder for a bill due later with Remind on', () => {
    expect(
      billReminders([bill({ dueDate: '2026-10-22' })], [remind('MYR|expense|netflix')], WED_14_OCT),
    ).toEqual([
      {
        id: 'bill:MYR|expense|netflix',
        at: new Date(2026, 9, 21, 9),
        title: 'Netflix is due tomorrow',
        body: 'RM54.90',
      },
    ]);
  });

  it('skips bills with Remind off, already paid or skipped, or whose time has passed', () => {
    const on = [remind('MYR|expense|netflix'), remind('MYR|expense|spotify')];
    expect(
      billReminders(
        [
          bill({}),
          bill({ seriesKey: 'MYR|expense|spotify', dueDate: '2026-10-22', status: 'skipped' }),
          bill({ seriesKey: 'MYR|expense|unifi', dueDate: '2026-10-25' }),
        ],
        on,
        WED_14_OCT,
      ),
    ).toEqual([]);
  });
});
