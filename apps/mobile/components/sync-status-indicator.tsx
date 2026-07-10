import React from 'react';
import { View, Text } from 'react-native';
import { syncState } from '@legendapp/state';
import { useSelector } from '@legendapp/state/react';
import { transactions$ } from '@/lib/store';

export function SyncStatusIndicator() {
  const statusInfo = useSelector(() => {
    const state = syncState(transactions$).get();
    const pendingSets = state.numPendingSets ?? 0;
    const pendingGets = state.numPendingGets ?? 0;
    const isSyncing = Boolean(state.isGetting || state.isSetting || pendingSets > 0 || pendingGets > 0);
    const isLoaded = state.isPersistLoaded && state.isLoaded;
    const hasError = Boolean(state.error);

    if (hasError) {
      return {
        text: 'Offline',
        bgColor: 'bg-red-100 dark:bg-red-900',
        dotColor: 'bg-red-500',
        textColor: 'text-red-700 dark:text-red-300',
      };
    }
    if (isSyncing) {
      return {
        text: 'Syncing',
        bgColor: 'bg-blue-100 dark:bg-blue-900',
        dotColor: 'bg-blue-500',
        textColor: 'text-blue-700 dark:text-blue-300',
      };
    }
    if (isLoaded) {
      return {
        text: 'Online',
        bgColor: 'bg-green-100 dark:bg-green-900',
        dotColor: 'bg-green-500',
        textColor: 'text-green-700 dark:text-green-300',
      };
    }
    return {
      text: 'Loading',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      dotColor: 'bg-yellow-500',
      textColor: 'text-yellow-700 dark:text-yellow-300',
    };
  });

  return (
    <View className={`flex-row items-center px-3 py-1 ${statusInfo.bgColor} rounded-full`}>
      <View className={`w-2 h-2 ${statusInfo.dotColor} rounded-full mr-2`} />
      <Text className={`text-xs font-medium ${statusInfo.textColor}`}>{statusInfo.text}</Text>
    </View>
  );
}
