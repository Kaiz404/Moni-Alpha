import {
  countByStatus,
  filterCaptureLog,
  groupCaptureLog,
  type StoredCaptureEntry,
} from '../capture-log';

const now = new Date(2026, 9, 14, 14, 6);
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 9, day, hour, minute).toISOString();

const entries: StoredCaptureEntry[] = [
  {
    id: 'yesterday-auto',
    receivedAt: at(13, 19, 0),
    app: 'Maybank',
    packageName: 'com.maybank2u.life',
    text: "MAYBANK: RM100.00 transferred to Touch 'n Go eWallet on 13/10 19:00.",
    status: 'auto_added',
    transactionId: 'tx-1',
  },
  {
    id: 'today-review',
    receivedAt: at(14, 12, 50),
    app: 'Maybank',
    bigText: "MAYBANK: You've spent RM86.40 at JAYA GROCER on 14/10 12:50.",
    text: "MAYBANK: You've spent RM86.40",
    status: 'waiting_for_review',
  },
  {
    id: 'today-before-statuses',
    receivedAt: at(14, 9, 12),
    app: 'Shopee',
    text: 'Your parcel is out for delivery. Track it in the app.',
  },
  {
    id: 'monday-not-linked',
    receivedAt: at(12, 17, 50),
    app: 'Grab',
    text: 'Your ride receipt: RM23.10 paid.',
    status: 'not_linked',
  },
];

describe('groupCaptureLog', () => {
  it('groups today and yesterday under Today and Yesterday, newest first', () => {
    const days = groupCaptureLog(entries, now);

    expect(days.map((day) => day.label)).toEqual([
      'Today · Wed 14 Oct',
      'Yesterday · Tue 13 Oct',
      'Mon 12 Oct',
    ]);
    expect(days.map((day) => day.items.map((item) => item.id))).toEqual([
      ['today-review', 'today-before-statuses'],
      ['yesterday-auto'],
      ['monday-not-linked'],
    ]);
  });

  it('shows an entry with no stored status as Ignored', () => {
    const [today] = groupCaptureLog(entries, now);

    expect(today.items[1]).toEqual({
      id: 'today-before-statuses',
      app: 'Shopee',
      packageName: null,
      time: '9:12 am',
      text: 'Your parcel is out for delivery. Track it in the app.',
      status: 'ignored',
      label: 'Ignored',
      transactionId: null,
    });
  });

  it('quotes the full alert text and keeps the transaction link', () => {
    const [today, yesterday] = groupCaptureLog(entries, now);

    expect(today.items[0].text).toBe(
      "MAYBANK: You've spent RM86.40 at JAYA GROCER on 14/10 12:50.",
    );
    expect(today.items[0].label).toBe('Waiting for review');
    expect(today.items[0].time).toBe('12:50 pm');
    expect(yesterday.items[0]).toMatchObject({
      label: 'Auto-added',
      time: '7:00 pm',
      transactionId: 'tx-1',
    });
  });

  it('counts and filters by stored status', () => {
    const days = groupCaptureLog(entries, now);

    expect(countByStatus(days)).toEqual({
      added: 0,
      auto_added: 1,
      waiting_for_review: 1,
      ignored: 1,
      not_linked: 1,
    });
    expect(
      filterCaptureLog(days, 'waiting_for_review').map((day) => [
        day.label,
        day.items.map((item) => item.id),
      ]),
    ).toEqual([['Today · Wed 14 Oct', ['today-review']]]);
  });
});
