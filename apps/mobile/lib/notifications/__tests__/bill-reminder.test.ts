import type { MinorAmount, RecurringOverride, UpcomingBill } from '@repo/types';

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
  });

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

  it('cancels it on Remind off or Stop tracking and leaves other notifications alone', async () => {
    await syncBillReminders(billReminders([bill({ dueDate: '2026-10-22' })], on, WED_14_OCT));
    await syncBillReminders(billReminders([bill({ dueDate: '2026-10-22' })], [], WED_14_OCT));

    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'bill:MYR|expense|netflix',
    );
    expect(shown()).toEqual([['review:p1', 'Maybank alert']]);
  });
});
