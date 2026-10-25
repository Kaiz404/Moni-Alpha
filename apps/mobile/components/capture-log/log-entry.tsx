import { Image } from 'expo-image';
import { View } from 'react-native';

import { CaptureStatusPill } from '@/components/capture-log/status-pill';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { getCachedAppIcon } from '@/lib/notifications/app-icon-cache';
import type { CaptureLogItem } from '@/lib/notifications/capture-log';
import type { TestId } from '@/lib/test-ids';

export type LogEntryAction = { testID: TestId; label: string; onPress: () => void };

function AppBubble({ packageName }: { packageName: string | null }) {
  const tokens = useThemeTokens();
  const icon = packageName ? getCachedAppIcon(packageName) : null;
  if (icon) {
    return (
      <Image
        source={{ uri: icon }}
        accessibilityIgnoresInvertColors
        style={{ width: 42, height: 42, borderRadius: 21 }}
      />
    );
  }
  return (
    <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-sand">
      <IconSymbol
        name="bell-outline"
        size={20}
        color={tokens.foreground}
      />
    </View>
  );
}

/** One alert in the capture log: app, time, the alert text as sent, its status, and what to do next. */
export function LogEntry({ item, action }: { item: CaptureLogItem; action?: LogEntryAction }) {
  const tokens = useThemeTokens();
  return (
    <View
      className="flex-row gap-3.5 px-[18px] py-3"
      accessible={!action}
    >
      <AppBubble packageName={item.packageName} />
      <View className="min-w-0 flex-1 gap-1">
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
        <View className="mt-0.5 flex-row flex-wrap items-center gap-x-2.5 gap-y-1">
          <CaptureStatusPill status={item.status} />
          {action ? (
            <Press
              testID={action.testID}
              onPress={action.onPress}
              hitSlop={6}
              accessibilityLabel={`${action.label}, ${item.app} ${item.time}`}
              className="min-h-8 flex-row items-center gap-0.5 rounded-full"
            >
              <Text className="text-[14px] leading-[19px] font-display-semibold text-deep-mint">
                {action.label}
              </Text>
              <IconSymbol
                name="chevron-right"
                size={16}
                color={tokens.deepMint}
              />
            </Press>
          ) : null}
        </View>
        {item.note ? (
          <Text
            variant="meta"
            className="text-muted"
          >
            {item.note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
