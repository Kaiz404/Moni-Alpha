import React from 'react';
import { View, Text } from 'react-native';
import { syncState } from '@legendapp/state';
import { useSelector } from '@legendapp/state/react';
import { transactions$ } from '@/lib/store';
import { Surface } from '@/components/ui/surface';
import { formatTimeAgo } from '@/lib/dates/relative-time';

type SyncStatusProps = {
  className?: string;
};

function useSyncStatus() {
  return useSelector(() => {
    const state = syncState(transactions$).get();
    const pendingSets = state.numPendingSets ?? 0;
    const pendingGets = state.numPendingGets ?? 0;
    const isSyncing = Boolean(
      state.isGetting ||
      state.isSetting ||
      pendingSets > 0 ||
      pendingGets > 0,
    );
    const isLoaded = state.isPersistLoaded && state.isLoaded;
    const hasError = Boolean(state.error);

    if (hasError) {
      return { text: 'Offline', colorClass: 'text-danger' };
    }
    if (isSyncing) {
      return { text: 'Syncing', colorClass: 'text-warning' };
    }
    if (isLoaded) {
      return { text: 'Connected', colorClass: 'text-success' };
    }
    return { text: 'Loading', colorClass: 'text-warning' };
  });
}

export function SyncStatus({ className }: SyncStatusProps = {}) {
  const status = useSyncStatus();
  const syncMeta = useSelector(() => {
    const state = syncState(transactions$).get();
    return {
      lastSync: state.lastSync as number | undefined,
      pendingSets: state.numPendingSets ?? 0,
      isSyncEnabled: state.isSyncEnabled !== false,
      errorMessage: state.error?.message as string | undefined,
    };
  });

  return (
    <Surface
      className={['mb-6 p-4', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <Text className="mb-3 text-lg font-semibold text-foreground">
        Sync Status
      </Text>

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">Status:</Text>
          <Text
            className={`text-sm font-medium ${status.colorClass}`}
          >
            {status.text}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">Remote sync:</Text>
          <Text className="text-sm text-foreground">
            {syncMeta.isSyncEnabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted">Last Sync:</Text>
          <Text className="text-sm text-foreground">
            {formatTimeAgo(syncMeta.lastSync, {
              style: 'short',
              fallback: 'Never',
            })}
          </Text>
        </View>

        {syncMeta.pendingSets > 0 ? (
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted">
              Pending uploads:
            </Text>
            <Text className="text-sm text-foreground">
              {syncMeta.pendingSets}
            </Text>
          </View>
        ) : null}

        {syncMeta.errorMessage ? (
          <Text className="mt-1 text-xs text-danger">
            {syncMeta.errorMessage}
          </Text>
        ) : null}
      </View>
    </Surface>
  );
}
