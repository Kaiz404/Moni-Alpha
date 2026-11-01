import { View } from 'react-native';

import { AppBubble } from '@/components/capture-log/log-entry';
import { Text } from '@/components/ui/text';
import { lastCapturedLine, type CaptureSourceHealth } from '@/lib/notifications/capture-health';

/** One linked app and how recently it produced a capture. */
export function LinkedAppRow({
  label,
  packageName,
  source,
}: {
  label: string;
  packageName: string;
  source: CaptureSourceHealth;
}) {
  return (
    <View
      accessible
      className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3"
    >
      <AppBubble packageName={packageName} />
      <View className="min-w-0 flex-1">
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
          {lastCapturedLine(source)}
        </Text>
      </View>
    </View>
  );
}
