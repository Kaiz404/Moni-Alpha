import React from 'react';
import { View, Text } from 'react-native';
import { syncState } from '@legendapp/state';
import { useSelector } from '@legendapp/state/react';
import { transactions$ } from '@/lib/store';

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
      return { text: 'Offline', colorClass: 'text-red-500' };
    }
    if (isSyncing) {
      return { text: 'Syncing', colorClass: 'text-yellow-500' };
    }
    if (isLoaded) {
      return { text: 'Connected', colorClass: 'text-green-500' };
    }
    return { text: 'Loading', colorClass: 'text-yellow-500' };
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

  const formatLastSyncTime = () => {
    if (!syncMeta.lastSync) return 'Never';
    const diffMs = Date.now() - syncMeta.lastSync;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <View
      className={['mb-6 rounded-lg bg-card p-4', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <Text className="mb-3 text-lg font-semibold text-foreground">
        Sync Status
      </Text>

      <View className="space-y-2">
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
            {formatLastSyncTime()}
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
          <Text className="text-xs text-red-500 dark:text-red-400 mt-1">
            {syncMeta.errorMessage}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
