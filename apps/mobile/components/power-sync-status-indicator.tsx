import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { usePowerSync } from '@powersync/react-native';

export function PowerSyncStatusIndicator() {
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

  const getStatusInfo = () => {
    if (!connected) {
      return {
        text: 'Offline',
        color: 'red',
        bgColor: 'bg-red-100 dark:bg-red-900',
        dotColor: 'bg-red-500'
      };
    }

    if (status?.connecting) {
      return {
        text: 'Connecting',
        color: 'yellow',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900',
        dotColor: 'bg-yellow-500'
      };
    }

    const dataFlow = status?.dataFlowStatus;
    if (dataFlow?.uploading || dataFlow?.downloading) {
      return {
        text: 'Syncing',
        color: 'blue',
        bgColor: 'bg-blue-100 dark:bg-blue-900',
        dotColor: 'bg-blue-500'
      };
    }

    return {
      text: 'Online',
      color: 'green',
      bgColor: 'bg-green-100 dark:bg-green-900',
      dotColor: 'bg-green-500'
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <View className={`flex-row items-center px-3 py-1 ${statusInfo.bgColor} rounded-full`}>
      <View className={`w-2 h-2 ${statusInfo.dotColor} rounded-full mr-2`} />
      <Text className={`text-xs text-${statusInfo.color}-700 dark:text-${statusInfo.color}-300 font-medium`}>
        {statusInfo.text}
      </Text>
    </View>
  );
}