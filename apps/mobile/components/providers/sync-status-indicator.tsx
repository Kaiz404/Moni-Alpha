import React from 'react';
import { Text, View } from 'react-native';
import { syncState } from '@legendapp/state';
import { useSelector } from '@legendapp/state/react';

import { transactions$ } from '@/lib/store';

type SyncTone = 'offline' | 'syncing' | 'online' | 'loading';

function useSyncTone(): { text: string; tone: SyncTone } {
  return useSelector(() => {
    const state = syncState(transactions$).get();
    const pendingSets = state.numPendingSets ?? 0;
    const pendingGets = state.numPendingGets ?? 0;
    const syncing = Boolean(
      state.isGetting ||
      state.isSetting ||
      pendingSets > 0 ||
      pendingGets > 0,
    );
    if (state.error) return { text: 'Offline', tone: 'offline' };
    if (syncing) return { text: 'Syncing', tone: 'syncing' };
    if (state.isPersistLoaded && state.isLoaded) {
      return { text: 'Online', tone: 'online' };
    }
    return { text: 'Loading', tone: 'loading' };
  });
}

/** Compact status cue; state remains legible without relying on the dot colour. */
export function SyncStatusIndicator() {
  const status = useSyncTone();
  const styleByTone: Record<SyncTone, string> = {
    offline: 'bg-danger/10 text-danger',
    syncing: 'bg-primary-muted text-primary',
    online: 'bg-primary-muted text-success',
    loading: 'bg-accent-lemon/20 text-warning',
  };
  const dotByTone: Record<SyncTone, string> = {
    offline: 'bg-danger',
    syncing: 'bg-primary',
    online: 'bg-success',
    loading: 'bg-warning',
  };

  return (
    <View
      className={[
        'flex-row items-center rounded-full px-3 py-1',
        styleByTone[status.tone],
      ].join(' ')}
      accessibilityLabel={['Sync status:', status.text].join(' ')}
    >
      <View
        className={['mr-2 h-2 w-2 rounded-full', dotByTone[status.tone]].join(
          ' ',
        )}
      />
      <Text className="text-xs font-semibold">{status.text}</Text>
    </View>
  );
}
