import { View } from 'react-native';

import { AppBubble } from '@/components/capture-log/log-entry';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { lastCapturedLine, reportedMissedLine, type CaptureSourceHealth } from '@/lib/notifications/capture-health';
import { tid } from '@/lib/test-ids';

/** One linked app, how recently it produced a capture, and a way to say it missed one. */
export function LinkedAppRow({
  label,
  packageName,
  source,
  quiet,
  onReportMissed,
}: {
  label: string;
  packageName: string;
  source: CaptureSourceHealth;
  quiet: boolean;
  onReportMissed: () => void;
}) {
  const tokens = useThemeTokens();
  const meta = [
    quiet ? 'Gone quiet' : null,
    lastCapturedLine(source),
    reportedMissedLine(source),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View className="flex-row gap-3.5 px-[18px] py-3">
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
        <Press
          testID={tid('sources', 'app', label, 'report-missed')}
          onPress={onReportMissed}
          hitSlop={6}
          accessibilityLabel={`Report a transaction ${label} missed`}
          className="min-h-8 flex-row items-center gap-0.5 self-start rounded-full"
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
    </View>
  );
}
