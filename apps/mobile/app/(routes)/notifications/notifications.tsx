import React, { useCallback, useState } from 'react';
import { Stack, useFocusEffect } from 'expo-router';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useNotificationListener } from '@/hooks/use-notification-listener';
import type { CapturedNotification } from '@/hooks/use-notification-listener';

function NotificationCard({
  item,
  onDismiss,
}: {
  item: CapturedNotification;
  onDismiss: (id: string) => void;
}) {
  const displayTitle = item.titleBig || item.title || '(no title)';
  const displayBody = item.bigText || item.text || item.subText || item.summaryText || '(no content)';
  const received = new Date(item.receivedAt);
  const isPrefilterPassed = !!item.prefilterPassed;

  return (
    <View className="mb-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center flex-1 mr-2">
          <View className={`w-2 h-2 rounded-full mr-2 ${isPrefilterPassed ? 'bg-green-500' : 'bg-blue-400'}`} />
          <Text className="text-xs font-semibold text-foreground flex-1" numberOfLines={1}>
            {item.app || 'Unknown app'}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <View className={`self-start mr-2 px-2 py-0.5 rounded-full ${isPrefilterPassed ? 'bg-green-100 dark:bg-green-900' : 'bg-background-muted'}`}>
            <Text className={`text-[11px] font-semibold ${isPrefilterPassed ? 'text-green-700 dark:text-green-300' : 'text-muted'}`}>
              {isPrefilterPassed ? 'Queued' : 'Ignored'}
            </Text>
          </View>
          
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-muted">
              {received.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <TouchableOpacity
              onPress={() => onDismiss(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <IconSymbol name="close" size={12} color="#9ca3af" />
            </TouchableOpacity>
          </View>


        </View>
      </View>


      <Text className="mb-1 text-sm font-semibold text-foreground" numberOfLines={2}>
        {displayTitle}
      </Text>

      
      <Text className="text-sm text-muted" numberOfLines={3}>
        {displayBody}
      </Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const {
    notifications,
    refresh,
    clearAll,
    clearOne,
  } = useNotificationListener();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleClearAll = useCallback(() => {
    Alert.alert('Clear all notifications', 'Remove all stored notifications?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: clearAll },
    ]);
  }, [clearAll]);

  return (
    <View className="flex-1 bg-background p-4">
      <Stack.Screen options={{ headerShown: true, title: 'Notifications' }} />

      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted">
          Raw Notifications ({notifications.length}/50)
        </Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text className="text-xs text-red-500 dark:text-red-400 font-medium">Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => <NotificationCard item={item} onDismiss={clearOne} />}
        ListEmptyComponent={
          <View className="items-center py-8">
            <Text className="text-sm text-muted">
              No notifications captured yet.
            </Text>
          </View>
        }
      />
    </View>
  );
}
