import { syncBannerState } from '@/lib/store/sync-banner-state';

const ok = { error: false, pending: 0 };
const failing = { error: true, pending: 2 };

describe('syncBannerState', () => {
  it('shows nothing while online and syncing', () => {
    expect(syncBannerState({ isConnected: true, isInternetReachable: true }, ok)).toBeNull();
    expect(syncBannerState({ isConnected: true, isInternetReachable: true }, failing)).toEqual({
      kind: 'syncError',
      pending: 2,
    });
  });

  it('says offline with no connection or no internet, even when sync failed', () => {
    expect(syncBannerState({ isConnected: false, isInternetReachable: false }, ok)).toEqual({
      kind: 'offline',
    });
    expect(syncBannerState({ isConnected: true, isInternetReachable: false }, failing)).toEqual({
      kind: 'offline',
    });
  });

  it('treats a network state not yet known as online', () => {
    expect(syncBannerState({}, ok)).toBeNull();
    expect(syncBannerState({ isConnected: true }, failing)).toEqual({ kind: 'syncError', pending: 2 });
  });
});
