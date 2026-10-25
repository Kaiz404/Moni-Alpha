import type { MinorAmount, RecurringOverride, UpcomingBill } from '@repo/types';

import { tx } from '@/lib/ai/facts/__tests__/synthetic-ledger';
import { selectBillsAhead } from '@/lib/finance/bills';

import { billReminders, reminderAt, syncBillReminders } from '../bill-reminder';

type Request = { identifier: string; content: { title: string; body: string; data: object } };
jest.mock('expo-notifications', () => {
  const held = new Map<string, unknown>();
  return {
    held,
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationChannelAsync: jest.fn(async () => null),
    getAllScheduledNotificationsAsync: jest.fn(async () => [...held.values()]),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
      held.delete(id);
    }),
    scheduleNotificationAsync: jest.fn(async (request: { identifier: string }) => {
      held.set(request.identifier, request);
      return request.identifier;
    }),
  };
});
const notifications = jest.requireMock('expo-notifications') as {
  held: Map<string, Request>;
  scheduleNotificationAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
};

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

describe('billReminders across the month boundary', () => {
  const firstOf = (month: number) => new Date(2026, month - 1, 1, 9);
  const astro = [8, 9, 10].map((month) => tx(firstOf(month), 'expense', '89.90', 'Astro'));
  const astroOn = [remind('MYR|expense|astro')];
  const plan = (now: Date) => billReminders(selectBillsAhead(now, astro, astroOn), astroOn, now);
  const astroReminder = (at: Date) => ({
    id: 'bill:MYR|expense|astro',
    at,
    title: 'Astro is due tomorrow',
    body: 'RM89.90',
  });

  it('reminds on the 31st for a bill due on the 1st, from the 30th', () => {
    expect(plan(new Date(2026, 9, 30, 14))).toEqual([astroReminder(new Date(2026, 9, 31, 9))]);
  });

  it('reminds on the 31st itself until 9:00 am', () => {
    expect(plan(new Date(2026, 9, 31, 8))).toEqual([astroReminder(new Date(2026, 9, 31, 9))]);
    expect(plan(new Date(2026, 9, 31, 10))).toEqual([]);
  });

  it('reminds on the 30th of a 30-day month for a bill the user added on the 1st', () => {
    const unifi = {
      ...remind('MYR|expense|unifi'),
      status: 'confirmed',
      kind: 'bill',
      expectedDay: 1,
      expectedAmountMinor: 12900 as MinorAmount,
      currency: 'MYR',
    } as RecurringOverride;
    const now = new Date(2026, 8, 30, 7);
    expect(billReminders(selectBillsAhead(now, [], [unifi]), [unifi], now)).toEqual([
      {
        id: 'bill:MYR|expense|unifi',
        at: new Date(2026, 8, 30, 9),
        title: 'unifi is due tomorrow',
        body: 'RM129.00',
      },
    ]);
  });

  it('reminds on 31 December for a bill due on 1 January', () => {
    const december = [10, 11, 12].map((month) => tx(firstOf(month), 'expense', '89.90', 'Astro'));
    const now = new Date(2026, 11, 30, 20);
    expect(billReminders(selectBillsAhead(now, december, astroOn), astroOn, now)).toEqual([
      astroReminder(new Date(2026, 11, 31, 9)),
    ]);
  });

  it('plans next month’s reminder for a bill skipped this month', () => {
    const now = new Date(2026, 9, 5, 10);
    const skipped = [
      {
        ...remind('MYR|expense|astro'),
        status: 'confirmed',
        kind: 'bill',
        expectedDay: 20,
        expectedAmountMinor: 8990 as MinorAmount,
        currency: 'MYR',
        skipPeriod: '2026-10',
      } as RecurringOverride,
    ];
    expect(billReminders(selectBillsAhead(now, [], skipped), skipped, now)).toEqual([
      { ...astroReminder(new Date(2026, 10, 19, 9)), title: 'astro is due tomorrow' },
    ]);
  });

  it('plans next month’s reminder once this month’s bill is paid', () => {
    const now = new Date(2026, 9, 20, 10);
    const netflix = [7, 8, 9, 10].map((month) =>
      tx(new Date(2026, month - 1, 15, 9), 'expense', '54.90', 'Netflix'),
    );
    const on = [remind('MYR|expense|netflix')];
    expect(billReminders(selectBillsAhead(now, netflix, on), on, now)).toEqual([
      {
        id: 'bill:MYR|expense|netflix',
        at: new Date(2026, 10, 14, 9),
        title: 'Netflix is due tomorrow',
        body: 'RM54.90',
      },
    ]);
  });
});

describe('syncBillReminders', () => {
  const on = [remind('MYR|expense|netflix')];
  const shown = () =>
    [...notifications.held.values()].map((request) => [request.identifier, request.content.title]);

  beforeEach(() => {
    notifications.held.clear();
    notifications.held.set('review:p1', {
      identifier: 'review:p1',
      content: { title: 'Maybank alert', body: 'GRAB', data: {} },
    });
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(WED_14_OCT.getTime());
  });
  afterEach(() => jest.restoreAllMocks());

  it('schedules a reminder once however many times it runs', async () => {
    const wanted = billReminders([bill({ dueDate: '2026-10-22' })], on, WED_14_OCT);
    await syncBillReminders(wanted);
    await syncBillReminders(wanted);
    await Promise.all([syncBillReminders(wanted), syncBillReminders(wanted)]);

    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(shown()).toEqual([
      ['review:p1', 'Maybank alert'],
      ['bill:MYR|expense|netflix', 'Netflix is due tomorrow'],
    ]);
  });

  it('moves the reminder when the due day changes', async () => {
    await syncBillReminders(billReminders([bill({ dueDate: '2026-10-22' })], on, WED_14_OCT));
    await syncBillReminders(billReminders([bill({ dueDate: '2026-10-25' })], on, WED_14_OCT));

    const held = notifications.held.get('bill:MYR|expense|netflix');
    expect(held?.content.data).toEqual({ kind: 'bill', at: new Date(2026, 9, 24, 9).toISOString() });
    expect(notifications.held.size).toBe(2);
  });

  it('never schedules a reminder whose time passed while the plan was stale', async () => {
    const plannedMondayMorning = billReminders(
      [bill({ dueDate: '2026-10-15' })],
      on,
      new Date(2026, 9, 13, 8),
    );
    await syncBillReminders(plannedMondayMorning);

    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels it on Remind off or Stop tracking and leaves other notifications alone', async () => {
    await syncBillReminders(billReminders([bill({ dueDate: '2026-10-22' })], on, WED_14_OCT));
    await syncBillReminders(billReminders([bill({ dueDate: '2026-10-22' })], [], WED_14_OCT));

    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'bill:MYR|expense|netflix',
    );
    expect(shown()).toEqual([['review:p1', 'Maybank alert']]);
  });
});
