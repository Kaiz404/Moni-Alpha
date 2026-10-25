import { syncState } from '@legendapp/state';
import { useSelector } from '@legendapp/state/react';
import { useNetworkState } from 'expo-network';

import { Banner } from '@/components/ui/banner';
import { transactions$ } from '@/lib/store';
import { syncBannerState } from '@/lib/store/sync-banner-state';
import { tid, type Screen } from '@/lib/test-ids';

export function SyncBanner({
  screen,
  className,
}: {
  screen: Screen;
  className?: string;
}) {
  const network = useNetworkState();
  const failed = useSelector(() => {
    const state = syncState(transactions$).get();
    return state.error ? (state.numPendingSets ?? 0) : null;
  });
  const banner = syncBannerState(network, {
    error: failed !== null,
    pending: failed ?? 0,
  });
  if (!banner) return null;
  if (banner.kind === 'offline') {
    return (
      <Banner
        tone="offline"
        className={className}
        title="You're offline."
        body="New spends save here and sync later."
      />
    );
  }
  const { pending } = banner;
  return (
    <Banner
      tone="syncError"
      className={className}
      title={
        pending > 0
          ? `Couldn't sync ${pending} ${pending === 1 ? 'change' : 'changes'}.`
          : "Couldn't sync."
      }
      body="It's safe on this phone."
      action={{
        testID: tid(screen, 'sync', 'retry'),
        label: 'Retry',
        onPress: () => void syncState(transactions$).sync(),
      }}
    />
  );
}
