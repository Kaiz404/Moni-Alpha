import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { EmptyTile } from '@/components/ui/empty-tile';
import type { CapturedNotification } from '@/hooks/use-notification-listener';
import { useNotificationListener } from '@/hooks/use-notification-listener';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { isPackageLinkedInCache } from '@/lib/notifications/linked-packages-cache';
import { resolveNotificationPackageName } from '@/lib/notifications/notification-package';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { openSheet } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';
import { Page } from '@/components/ui/page';

function NotificationRow({
  item,
  onDismiss,
}: {
  item: CapturedNotification;
  onDismiss: (id: string) => void;
}) {
  const tokens = useThemeTokens();
  const title =
    item.titleBig || item.title || 'Untitled notification';
  const body =
    item.bigText ||
    item.text ||
    item.subText ||
    item.summaryText ||
    'No notification content';
  const packageName = resolveNotificationPackageName(item);
  const linked =
    item.packageLinked ?? isPackageLinkedInCache(packageName);
  const prefilterPassed = Boolean(item.prefilterPassed);
  const state =
    prefilterPassed && linked
      ? 'Queued for review'
      : prefilterPassed
        ? 'Not linked to a wallet'
        : 'Ignored';
  const stateClass =
    prefilterPassed && linked
      ? 'text-primary'
      : prefilterPassed
        ? 'text-warning'
        : 'text-muted';
  const markerClass =
    prefilterPassed && linked
      ? 'bg-primary'
      : prefilterPassed
        ? 'bg-warning'
        : 'bg-border-strong';

  return (
    <View className="rounded-card bg-card mb-3 p-4">
      <View className="flex-row items-start gap-3">
        <View
          className={`mt-1.5 h-2.5 w-2.5 rounded-full ${markerClass}`}
        />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text
                className="text-sm font-display-bold text-foreground"
                numberOfLines={1}
              >
                {item.app || packageName || 'Unknown app'}
              </Text>
              <Text
                className={`mt-1 text-xs font-display-semibold ${stateClass}`}
              >
                {state}
              </Text>
            </View>
            <HeaderIconButton
              testID={tid('profile', 'dismiss-notification', item.id)}
              accessibilityLabel="Dismiss notification"
              icon="close"
              onPress={() => onDismiss(item.id)}
            />
          </View>
          <Text
            className="mt-3 text-[15px] font-display-semibold text-foreground"
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text
            className="mt-1 text-sm leading-5 text-muted"
            numberOfLines={3}
          >
            {body}
          </Text>
          <View className="mt-3 flex-row items-center gap-1.5">
            <IconSymbol
              color={tokens.muted}
              name="clock-outline"
              size={14}
            />
            <Text className="text-xs text-muted">
              {new Date(item.receivedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { notifications, refresh, clearAll, clearOne } =
    useNotificationListener();
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

  const handleClearAll = useCallback(async () => {
    const confirmed = await openSheet({
      kind: 'confirm',
      title: 'Clear stored notifications?',
      message: 'This removes only the raw alerts kept on this phone.',
      confirmLabel: 'Clear all',
      cancelLabel: 'Keep them',
      destructive: true,
    });
    if (confirmed) clearAll();
  }, [clearAll]);

  return (
    <Page
      screen="profile"
      kind="pushed"
      title="Notifications"
    >
      <FlatList
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-6"
        data={notifications}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyTile
            className="mt-6"
            icon="bell-outline"
            title="No notifications captured"
            body="Link a bank app to a wallet and Moni lists the alerts it reads here."
          />
        }
        ListHeaderComponent={
          <View className="mb-6 flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="text-2xl font-display-bold text-foreground">
                Capture log
              </Text>
              <Text className="mt-2 text-xs font-display-semibold text-muted">
                {notifications.length} of 50 stored
              </Text>
            </View>
            {notifications.length > 0 ? (
              <HeaderIconButton
                testID={tid('profile', 'clear-all-stored')}
                accessibilityLabel="Clear all stored notifications"
                icon="delete-outline"
                onPress={handleClearAll}
              />
            ) : null}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            onDismiss={clearOne}
          />
        )}
      />
    </Page>
  );
}
