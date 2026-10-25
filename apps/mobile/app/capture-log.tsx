import type { CapturedNotificationStatus } from '@repo/types';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { linkAppToWallet } from '@/components/capture-log/link-app';
import { LogEntry, type LogEntryAction } from '@/components/capture-log/log-entry';
import { StatusLegend } from '@/components/capture-log/status-legend';
import { useLinkedApps, type LinkedWallet } from '@/components/capture-sources/use-linked-apps';
import { Chip } from '@/components/ui/chip';
import { EmptyTile } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useNotificationListener } from '@/hooks/use-notification-listener';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  CAPTURE_STATUS_LABELS,
  CAPTURE_STATUS_ORDER,
  countByStatus,
  filterCaptureLog,
  groupCaptureLog,
  type CaptureLogItem,
} from '@/lib/notifications/capture-log';
import { tid } from '@/lib/test-ids';

/** Day groups shown before "Show N older" on the unfiltered log. */
const FIRST_DAYS = 3;

type Filter = CapturedNotificationStatus | 'all';

function entryAction(item: CaptureLogItem, wallets: readonly LinkedWallet[]): LogEntryAction | undefined {
  switch (item.status) {
    case 'waiting_for_review':
      return {
        testID: tid('capture-log', 'entry', item.id, 'review'),
        label: 'Review it',
        onPress: () => router.push({ pathname: '/review', params: { id: item.id } }),
      };
    case 'added':
    case 'auto_added': {
      const transactionId = item.transactionId;
      if (!transactionId) return undefined;
      return {
        testID: tid('capture-log', 'entry', item.id, 'transaction'),
        label: 'See transaction',
        onPress: () => router.push({ pathname: '/transaction/[id]', params: { id: transactionId } }),
      };
    }
    case 'not_linked': {
      const packageName = item.packageName;
      if (!packageName) return undefined;
      return {
        testID: tid('capture-log', 'entry', item.id, 'link'),
        label: `Link ${item.app} to a wallet`,
        onPress: () => void linkAppToWallet({ packageName, label: item.app }, wallets),
      };
    }
    case 'ignored':
      return undefined;
  }
}

function joinAnd(names: readonly string[]): string {
  return names.length < 2
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

export default function CaptureLogScreen() {
  const tokens = useThemeTokens();
  const { notifications, refresh } = useNotificationListener();
  const { wallets, apps } = useLinkedApps();
  const [filter, setFilter] = useState<Filter>('all');
  const [showOlder, setShowOlder] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const now = new Date();
  const days = groupCaptureLog(notifications, now);
  const counts = countByStatus(days);
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonth = days
    .filter((day) => day.key.startsWith(monthPrefix))
    .reduce((sum, day) => sum + day.items.length, 0);
  const total = days.reduce((sum, day) => sum + day.items.length, 0);

  const shown = filterCaptureLog(days, filter);
  const cut = filter === 'all' && !showOlder;
  const visible = cut ? shown.slice(0, FIRST_DAYS) : shown;
  const hiddenCount = cut
    ? shown.slice(FIRST_DAYS).reduce((sum, day) => sum + day.items.length, 0)
    : 0;

  const pick = (next: Filter) => {
    setFilter(next);
    setShowOlder(false);
  };

  const appNames = apps.map((app) => app.label);

  return (
    <Page
      screen="capture-log"
      kind="pushed"
      title="Capture log"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <Text
          variant="meta"
          className="px-1 text-ink-2"
        >
          {total > 0
            ? `Notifications Moni read from your banking apps, kept on this phone. ${thisMonth} this month.`
            : 'Notifications Moni read from your banking apps, kept on this phone.'}
        </Text>

        {total === 0 ? (
          <View className="gap-3">
            <EmptyTile
              icon="bell-outline"
              title="Nothing captured yet"
              body={
                appNames.length > 0
                  ? `When ${joinAnd(appNames)} sends a payment alert, it shows up here within a few seconds.`
                  : 'Link a banking app to a wallet. Its payment alerts show up here within a few seconds.'
              }
              action={{
                testID: tid('capture-log', 'check-access'),
                label: 'Check notification access',
                icon: 'bell-outline',
                onPress: () => router.push('/capture-sources'),
              }}
            />
            <StatusLegend />
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityLabel="Filter by status"
              className="-mx-5 grow-0"
              contentContainerClassName="gap-2 px-5 py-1"
            >
              <Chip
                testID={tid('capture-log', 'filter', 'all')}
                label={`All ${total}`}
                selected={filter === 'all'}
                onPress={() => pick('all')}
              />
              {CAPTURE_STATUS_ORDER.filter((status) => counts[status] > 0).map((status) => (
                <Chip
                  key={status}
                  testID={tid('capture-log', 'filter', status)}
                  label={`${CAPTURE_STATUS_LABELS[status]} ${counts[status]}`}
                  selected={filter === status}
                  onPress={() => pick(status)}
                />
              ))}
            </ScrollView>

            <View className="gap-3.5">
              {visible.map((day) => (
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
                      <LogEntry
                        key={item.id}
                        item={item}
                        action={entryAction(item, wallets)}
                      />
                    ))}
                  </ListCard>
                </View>
              ))}

              {hiddenCount > 0 ? (
                <Press
                  testID={tid('capture-log', 'show-older')}
                  onPress={() => setShowOlder(true)}
                  radius={{ rest: 22, pressed: 16 }}
                  pressedClassName="bg-hairline"
                  className="h-11 flex-row items-center gap-1.5 self-center bg-sand px-[18px]"
                >
                  <Text className="text-[14px] leading-[19px] font-display-semibold text-foreground">
                    {`Show ${hiddenCount} older`}
                  </Text>
                  <IconSymbol
                    name="chevron-down"
                    size={18}
                    color={tokens.foreground}
                  />
                </Press>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </Page>
  );
}
