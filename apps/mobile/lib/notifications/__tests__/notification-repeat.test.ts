import { isRepeatedNotification } from '../notification-repeat.core';

const KEY = '0|com.bank.app|7|null|10123';

const incoming = {
  packageName: 'com.bank.app',
  title: 'Payment sent',
  text: 'You paid RM12.50 to Kopi',
  bigText: 'You paid RM12.50 to Kopi at 09:59',
  key: KEY,
  time: '1791000000000',
};

const queued = { ...incoming, queued: true, receivedAt: '2026-10-07T09:59:30.000Z' };

describe('isRepeatedNotification', () => {
  it('flags a redelivery of a queued notification: same key, same post time', () => {
    expect(isRepeatedNotification([queued], incoming)).toBe(true);
  });

  it('flags it at any age', () => {
    const old = { ...queued, receivedAt: '2026-09-01T00:00:00.000Z' };
    expect(isRepeatedNotification([old], incoming)).toBe(true);
  });

  it('queues a second payment with the same words a minute later', () => {
    expect(
      isRepeatedNotification([queued], { ...incoming, key: `${KEY}1`, time: '1791000060000' }),
    ).toBe(false);
  });

  it('queues a redelivery whose first copy was logged but never queued', () => {
    expect(isRepeatedNotification([{ ...queued, queued: false }], incoming)).toBe(false);
    const { queued: _queued, ...loggedByAnOlderBuild } = queued;
    expect(isRepeatedNotification([loggedByAnOlderBuild], incoming)).toBe(false);
  });

  it('queues the same key posted again later, which Android does when the app updates it', () => {
    expect(isRepeatedNotification([queued], { ...incoming, time: '1791000099000' })).toBe(false);
  });

  it('matches by words when either copy has no key', () => {
    const { key: _key, ...noKey } = incoming;
    expect(isRepeatedNotification([{ ...queued, key: undefined }], noKey)).toBe(true);
    expect(isRepeatedNotification([queued], noKey)).toBe(true);
    expect(isRepeatedNotification([queued], { ...noKey, text: 'You paid RM13.00 to Kopi' })).toBe(
      false,
    );
    expect(isRepeatedNotification([queued], { ...noKey, packageName: 'com.other.bank' })).toBe(
      false,
    );
  });

  it('never flags a notification with no post time', () => {
    const { time: _time, ...noTime } = incoming;
    expect(isRepeatedNotification([{ ...queued, time: undefined }], noTime)).toBe(false);
  });

  it('does not flag anything against an empty list', () => {
    expect(isRepeatedNotification([], incoming)).toBe(false);
  });
});
