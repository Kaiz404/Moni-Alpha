import { openSheet } from '@/lib/sheet/sheet-store';

import { askForNotificationAccess, isListenerUnbound, REBIND_GRACE_MS } from '../permission';

jest.mock('@/lib/sheet/sheet-store', () => ({ openSheet: jest.fn(async () => null) }));

describe('isListenerUnbound', () => {
  const NOW = 1_800_000_000_000;
  const state = {
    connected: false,
    rebindRequestedAt: NOW - REBIND_GRACE_MS,
    connectedAt: NOW - 86_400_000,
    disconnectedAt: NOW - 60_000,
  };

  it('is unbound once a rebind has had its time and Android still has not connected', () => {
    expect(isListenerUnbound(state, NOW)).toBe(true);
  });

  it('waits out a rebind still in flight, and a process Android is about to connect', () => {
    expect(isListenerUnbound({ ...state, rebindRequestedAt: NOW - 1000 }, NOW)).toBe(false);
    expect(isListenerUnbound({ ...state, rebindRequestedAt: null }, NOW)).toBe(false);
  });

  it('is bound once Android connects', () => {
    expect(isListenerUnbound({ ...state, connected: true }, NOW)).toBe(false);
  });
});

describe('asking for notification access', () => {
  it('says what happens to alerts in one sentence, in the app, first', async () => {
    await askForNotificationAccess();
    expect(openSheet).toHaveBeenCalledWith({
      kind: 'confirm',
      title: 'Let Moni read alerts?',
      message:
        'One-time codes never leave this phone, and other payment alerts from the apps you link go to a cloud AI model that reads them.',
      confirmLabel: 'Open settings',
      cancelLabel: 'Not now',
    });
  });
});
