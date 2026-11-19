import { useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { CaptureStatusLabel } from '@/components/capture-log/status-label';
import { ListCard } from '@/components/ui/list-card';
import { Page, PageScroll } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { useInstalledApps } from '@/components/wallets/notification-source';
import { labelForNotificationPackage } from '@/constants/notification-apps';
import { useNotificationListener } from '@/hooks/use-notification-listener';
import { groupCaptureLog } from '@/lib/notifications/capture-log';
import { linkedAppLabel } from '@/lib/notifications/linked-packages-cache';

/** Every stored alert, including Ignored and apps that are not linked to a wallet. */
export default function DebugPage() {
  const { notifications, refresh } = useNotificationListener();
  const listing = useInstalledApps();
  const installed = listing.kind === 'listed' ? listing.apps : null;

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const days = groupCaptureLog(notifications, new Date(), (packageName) =>
    installed?.get(packageName)?.label ??
    linkedAppLabel(packageName) ??
    labelForNotificationPackage(packageName),
  );
  const total = days.reduce((sum, day) => sum + day.items.length, 0);

  return (
    <Page
      headerScrolls
      screen="profile"
      kind="pushed"
      title="Debug tools"
    >
      <PageScroll
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <Text
          variant="meta"
          className="px-1 text-ink-2"
        >
          Every notification Moni stored, including Ignored and apps that are not linked to a
          wallet. The Capture log hides those.
        </Text>
        {total === 0 ? (
          <Text
            variant="body"
            className="px-1 text-muted"
          >
            Nothing stored yet.
          </Text>
        ) : (
          days.map((day) => (
            <View
              key={day.key}
              className="gap-1.5"
            >
              <Text
                variant="caps"
                className="px-1.5 text-ink-2"
                accessibilityRole="header"
              >
                {day.label}
              </Text>
              <ListCard>
                {day.items.map((item) => (
                  <View
                    key={item.id}
                    className="gap-1 px-[18px] py-3"
                  >
                    <View className="flex-row items-baseline justify-between gap-2">
                      <Text
                        variant="rowTitle"
                        className="min-w-0 flex-1 text-foreground"
                        numberOfLines={1}
                      >
                        {item.app}
                      </Text>
                      <Text
                        variant="meta"
                        className="text-muted"
                      >
                        {item.time}
                      </Text>
                    </View>
                    {item.text ? (
                      <Text className="text-[14px] leading-[20px] text-ink-2">{item.text}</Text>
                    ) : null}
                    <CaptureStatusLabel status={item.status} />
                  </View>
                ))}
              </ListCard>
            </View>
          ))
        )}
      </PageScroll>
    </Page>
  );
}
