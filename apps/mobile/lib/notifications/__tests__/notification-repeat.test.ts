import { isRepeatedNotification } from '../notification-repeat.core';

const NOW = Date.parse('2026-10-07T10:00:00.000Z');

const stored = {
  packageName: 'com.bank.app',
  title: 'Payment sent',
  text: 'You paid RM12.50 to Kopi',
  bigText: 'You paid RM12.50 to Kopi at 09:59',
  receivedAt: '2026-10-07T09:59:30.000Z',
};

const incoming = {
  packageName: 'com.bank.app',
  title: 'Payment sent',
  text: 'You paid RM12.50 to Kopi',
  bigText: 'You paid RM12.50 to Kopi at 09:59',
};

describe('isRepeatedNotification', () => {
  it('flags an identical notification within two minutes', () => {
    expect(isRepeatedNotification([stored], incoming, NOW)).toBe(true);
  });

  it('does not flag the same text three minutes later', () => {
    const old = { ...stored, receivedAt: '2026-10-07T09:57:00.000Z' };
    expect(isRepeatedNotification([old], incoming, NOW)).toBe(false);
  });

  it('does not flag a different text, title or package', () => {
    expect(
      isRepeatedNotification([stored], { ...incoming, text: 'You paid RM13.00 to Kopi' }, NOW),
    ).toBe(false);
    expect(isRepeatedNotification([stored], { ...incoming, title: 'Payment received' }, NOW)).toBe(
      false,
    );
    expect(
      isRepeatedNotification([stored], { ...incoming, packageName: 'com.other.bank' }, NOW),
    ).toBe(false);
  });

  it('does not flag anything against an empty list', () => {
    expect(isRepeatedNotification([], incoming, NOW)).toBe(false);
  });

  it('treats a missing bigText as an empty one', () => {
    const noBigText = { ...stored, bigText: undefined };
    expect(isRepeatedNotification([noBigText], { ...incoming, bigText: '' }, NOW)).toBe(true);
  });

  it('falls back to app when packageName is missing', () => {
    const byApp = { ...stored, packageName: undefined, app: 'com.bank.app' };
    expect(isRepeatedNotification([byApp], incoming, NOW)).toBe(true);
  });
});
