import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { usePowerSync } from '@powersync/react-native';

type PowerSyncStatusProps = {
  /** Merged with default container classes for layout in different screens */
  className?: string;
};

export function PowerSyncStatus({ className }: PowerSyncStatusProps = {}) {
  const powersync = usePowerSync();
  const [connected, setConnected] = useState(powersync.connected);
  const [status, setStatus] = useState(powersync.currentStatus);

  useEffect(() => {
    // Set initial status
    setConnected(powersync.connected);
    setStatus(powersync.currentStatus);

    // Register listener for status changes
    const unsubscribe = powersync.registerListener({
      statusChanged: (newStatus) => {
        setConnected(newStatus.connected);
        setStatus(newStatus);
      }
    });

    // Cleanup listener on unmount
    return unsubscribe;
  }, [powersync]);

  const getStatusText = () => {
    if (!connected) {
      return 'Offline';
    }

    if (status?.connecting) {
      return 'Connecting...';
    }

    const dataFlow = status?.dataFlowStatus;
    if (dataFlow?.uploading && dataFlow?.downloading) {
      return 'Syncing (Upload & Download)';
    }

    if (dataFlow?.uploading) {
      return 'Uploading...';
    }

    if (dataFlow?.downloading) {
      return 'Downloading...';
    }

    return 'Connected';
  };

  const getStatusColor = () => {
    if (!connected) {
      return 'text-red-500';
    }

    if (status?.connecting) {
      return 'text-yellow-500';
    }

    const dataFlow = status?.dataFlowStatus;
    if (dataFlow?.uploading || dataFlow?.downloading) {
      return 'text-yellow-500';
    }

    return 'text-green-500';
  };

  const formatLastSyncTime = () => {
    if (!status?.lastSyncedAt) {
      return 'Never';
    }

    const lastSync = new Date(status.lastSyncedAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  return (
    <View
      className={[
        'mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}>
      <Text className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
        Sync Status
      </Text>

      <View className="space-y-2">
        {/* Connection Status */}
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-600 dark:text-gray-400">Status:</Text>
          <Text className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </Text>
        </View>

        {/* Last Sync Time */}
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-gray-600 dark:text-gray-400">Last Sync:</Text>
          <Text className="text-sm text-gray-900 dark:text-white">
            {formatLastSyncTime()}
          </Text>
        </View>

        {/* Download Progress */}
        {status?.downloadProgress && (
          <View className="mt-3">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-sm text-gray-600 dark:text-gray-400">Progress:</Text>
              <Text className="text-sm text-gray-900 dark:text-white">
                {status.downloadProgress.downloadedOperations} / {status.downloadProgress.totalOperations}
              </Text>
            </View>
            <View className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <View
                className="bg-blue-500 h-2 rounded-full"
                style={{
                  width: `${status.downloadProgress.downloadedFraction * 100}%`
                }}
              />
            </View>
            {status.downloadProgress.downloadedOperations === status.downloadProgress.totalOperations && (
              <Text className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Applying changes...
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}