import type { NetworkState } from 'expo-network';

/** What the banner under a tab root's header says (V2F-States, Offline and sync). */
export type SyncBannerState =
  | { kind: 'offline' }
  | { kind: 'syncError'; pending: number }
  | null;

/**
 * Offline wins over a sync error: without a network every sync fails, and the
 * offline banner already says changes wait on this phone. An unknown network
 * state counts as online so the banner never flashes while the phone checks.
 */
export function syncBannerState(
  network: Pick<NetworkState, 'isConnected' | 'isInternetReachable'>,
  sync: { error: boolean; pending: number },
): SyncBannerState {
  if (network.isConnected === false || network.isInternetReachable === false) {
    return { kind: 'offline' };
  }
  return sync.error ? { kind: 'syncError', pending: sync.pending } : null;
}
