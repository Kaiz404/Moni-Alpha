import type { Observable } from '@legendapp/state';

import { captureSourceLabel } from '../capture-source';

jest.mock('@/lib/notifications/installed-apps', () => ({
  getCachedInstalledAppsMap: () => null,
}));
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ set: jest.fn(), getString: jest.fn(), remove: jest.fn() }),
}));
jest.mock('@/lib/store', () => {
  const { observable } = jest.requireActual('@legendapp/state');
  return { wallets$: observable({}) };
});

const { wallets$ } = jest.requireMock('@/lib/store') as {
  wallets$: Observable<Record<string, Record<string, unknown>>>;
};

const capture = {
  sourceType: 'notification',
  sourceApp: 'com.example.anybank',
  notificationTitle: 'Your payment was successful',
} as const;

describe('the source row of a capture from a freely linked app', () => {
  it("uses the name saved on the wallet, not the alert's title", () => {
    wallets$.set({
      w1: { id: 'w1', notification_package: 'com.example.anybank', notification_app_label: 'Any Bank' },
    });

    expect(captureSourceLabel(capture)).toBe('Any Bank alert');
  });

  it('falls back to the title once no wallet links the app', () => {
    wallets$.set({});

    expect(captureSourceLabel(capture)).toBe('Your payment was successful alert');
  });
});
