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
  it('shows the disclosure sheet in the app before Android settings', async () => {
    await askForNotificationAccess();
    expect(openSheet).toHaveBeenCalledWith({ kind: 'notificationAccess' });
  });
});
