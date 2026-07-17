import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { IconAction } from '@/components/ui/icon-action';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenShell } from '@/components/ui/screen-shell';
import { Surface } from '@/components/ui/surface';
import { BrandHeader } from '@/components/ui/brand-header';
import { FeedbackState } from '@/components/ui/feedback-state';
import type { CapturedNotification } from '@/hooks/use-notification-listener';
import { useNotificationListener } from '@/hooks/use-notification-listener';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { isPackageLinkedInCache } from '@/lib/notifications/linked-packages-cache';
import { resolveNotificationPackageName } from '@/lib/notifications/notification-package';

function NotificationRow({
  item,
  onDismiss,
}: {
  item: CapturedNotification;
  onDismiss: (id: string) => void;
}) {
  const tokens = useThemeTokens();
  const title = item.titleBig || item.title || 'Untitled notification';
  const body = item.bigText || item.text || item.subText || item.summaryText || 'No notification content';
  const packageName = resolveNotificationPackageName(item);
  const linked = item.packageLinked ?? isPackageLinkedInCache(packageName);
  const prefilterPassed = Boolean(item.prefilterPassed);
  const state = prefilterPassed && linked ? 'Queued for review' : prefilterPassed ? 'Not linked to a wallet' : 'Ignored';
  const stateClass = prefilterPassed && linked ? 'text-primary' : prefilterPassed ? 'text-warning' : 'text-muted';
  const markerClass = prefilterPassed && linked ? 'bg-primary' : prefilterPassed ? 'bg-warning' : 'bg-border-strong';

  return (
    <Surface className="mb-3 p-4">
      <View className="flex-row items-start gap-3">
        <View className={`mt-1.5 h-2.5 w-2.5 rounded-full ${markerClass}`} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                {item.app || packageName || 'Unknown app'}
              </Text>
              <Text className={`mt-1 text-xs font-semibold ${stateClass}`}>{state}</Text>
            </View>
            <IconAction
              accessibilityLabel="Dismiss notification"
              icon="close"
              size={18}
              onPress={() => onDismiss(item.id)}
            />
          </View>
          <Text className="mt-3 text-[15px] font-semibold text-foreground" numberOfLines={2}>
            {title}
          </Text>
          <Text className="mt-1 text-sm leading-5 text-muted" numberOfLines={3}>
            {body}
          </Text>
          <View className="mt-3 flex-row items-center gap-1.5">
            <IconSymbol color={tokens.muted} name="schedule" size={14} />
            <Text className="text-xs text-muted">
              {new Date(item.receivedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          </View>
        </View>
      </View>
    </Surface>
  );
}

export default function NotificationsScreen() {
  const { notifications, refresh, clearAll, clearOne } = useNotificationListener();
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
    Alert.alert('Clear stored notifications?', 'This only removes locally stored raw notifications.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: clearAll },
    ]);
  }, [clearAll]);

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="Notifications" />
      <FlatList
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-6"
        data={notifications}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <FeedbackState
            className="mt-10"
            description="Captured notifications stay here until you clear them. Transactions are always reviewed separately."
            icon="notifications-none"
            title="No notifications captured"
          />
        }
        ListHeaderComponent={
          <View className="mb-6 flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">Capture log</Text>
              <Text className="mt-2 text-[15px] leading-5 text-muted">
                Raw notification evidence for receipt and transaction review.
                Nothing is added to your ledger automatically.
              </Text>
              <Text className="mt-3 text-xs font-semibold text-muted">
                {notifications.length} of 50 stored
              </Text>
            </View>
            {notifications.length > 0 ? (
              <IconAction
                accessibilityLabel="Clear all stored notifications"
                icon="delete-outline"
                tone="danger"
                onPress={handleClearAll}
              />
            ) : null}
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => <NotificationRow item={item} onDismiss={clearOne} />}
      />
    </ScreenShell>
  );
}
