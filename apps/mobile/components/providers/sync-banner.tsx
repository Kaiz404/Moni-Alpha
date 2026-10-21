import { syncState } from '@legendapp/state';
import { useSelector } from '@legendapp/state/react';

import { Banner } from '@/components/ui/banner';
import { transactions$ } from '@/lib/store';
import { tid, type Screen } from '@/lib/test-ids';

export function SyncBanner({
  screen,
  className,
}: {
  screen: Screen;
  className?: string;
}) {
  const failed = useSelector(() => {
    const state = syncState(transactions$).get();
    return state.error ? (state.numPendingSets ?? 0) : null;
  });
  if (failed === null) return null;
  return (
    <Banner
      tone="syncError"
      className={className}
      title={
        failed > 0
          ? `Couldn't sync ${failed} ${failed === 1 ? 'change' : 'changes'}.`
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
