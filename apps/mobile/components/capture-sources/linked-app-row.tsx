import { View } from 'react-native';

import { AppBubble } from '@/components/capture-log/log-entry';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { lastCapturedLine, reportedMissedLine, type CaptureSourceHealth } from '@/lib/notifications/capture-health';
import { tid, type TestId } from '@/lib/test-ids';

/** One linked app, how recently it produced a capture, and a way to say it missed one. */
export function LinkedAppRow({
  label,
  packageName,
  source,
  unreached,
  quiet,
  onReportMissed,
  testID,
  accessOff = false,
  onChange,
}: {
  label: string;
  packageName: string;
  source: CaptureSourceHealth;
  /** "2 couldn't reach Moni", when any did. */
  unreached: string | null;
  quiet: boolean;
  onReportMissed: () => void;
  testID: TestId;
  /** Notification access is off, so nothing from this app reaches Moni. */
  accessOff?: boolean;
  /** Tapping the app itself: pick another one. */
  onChange: () => void;
}) {
  const tokens = useThemeTokens();
  const meta = [
    accessOff ? 'Notification access is off' : null,
    quiet ? 'Gone quiet' : null,
    lastCapturedLine(source),
    reportedMissedLine(source),
    unreached,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View>
      <Press
        testID={testID}
        accessibilityLabel={`Alerts from ${label}, ${meta}. Change app`}
        onPress={onChange}
        className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
      >
        <AppBubble packageName={packageName} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            variant="rowTitle"
            className="text-foreground"
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text
            variant="meta"
            className="text-muted"
          >
            {meta}
          </Text>
        </View>
        <IconSymbol
          name="chevron-right"
          size={20}
          color={tokens.muted}
        />
      </Press>
      <Press
        testID={tid(testID, 'report-missed')}
        onPress={onReportMissed}
        hitSlop={6}
        accessibilityLabel={`Report a transaction ${label} missed`}
        className="mb-2 ml-[74px] min-h-8 flex-row items-center gap-0.5 self-start rounded-full"
      >
        <Text className="text-[14px] leading-[19px] font-display-semibold text-deep-mint">
          Report a missed transaction
        </Text>
        <IconSymbol
          name="chevron-right"
          size={16}
          color={tokens.deepMint}
        />
      </Press>
    </View>
  );
}
