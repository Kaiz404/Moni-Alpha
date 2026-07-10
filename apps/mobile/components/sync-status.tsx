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
    const isSyncing = Boolean(state.isGetting || state.isSetting || pendingSets > 0 || pendingGets > 0);
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
  const lastSync = useSelector(() => syncState(transactions$).get().lastSync);

  const formatLastSyncTime = () => {
    if (!lastSync) return 'Never';
    const diffMs = Date.now() - lastSync;
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
      className={[
        'mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Text className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
        Sync Status
      </Text>

      <View className="space-y-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-600 dark:text-gray-400">Status:</Text>
          <Text className={`text-sm font-medium ${status.colorClass}`}>{status.text}</Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-600 dark:text-gray-400">Last Sync:</Text>
          <Text className="text-sm text-gray-900 dark:text-white">{formatLastSyncTime()}</Text>
        </View>
      </View>
    </View>
  );
}
