import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

type BannerProps = {
  tone: 'offline' | 'syncError';
  /** The bold lead, such as "You're offline." */
  title: string;
  /** What happens next, such as "Changes save here and sync later." */
  body?: string;
  action?: { testID: TestId; label: string; onPress: () => void };
  /** Layout only, such as a margin. */
  className?: string;
};

/**
 * The capsule under the header that says what happened and what happens next
 * (V2F-States). Offline is Sand; a sync error is Lemon with a Retry.
 */
export function Banner({
  tone,
  title,
  body,
  action,
  className,
}: BannerProps) {
  const tokens = useThemeTokens();
  const error = tone === 'syncError';
  const ink = error ? tokens.states.attention : tokens.foreground;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={`min-h-11 flex-row items-center gap-2.5 rounded-full py-2 pl-4 ${action ? 'pr-2' : 'pr-4'} ${error ? 'bg-attention-fill' : 'bg-sand'} ${className ?? ''}`}
    >
      <IconSymbol
        name={error ? 'sync-alert' : 'cloud-off-outline'}
        size={18}
        color={ink}
      />
      <Text
        className={`min-w-0 flex-1 text-[14px] leading-[19px] ${error ? 'text-state-attention' : 'text-foreground'}`}
      >
        <Text className="font-display-bold">{title}</Text>
        {body ? ` ${body}` : ''}
      </Text>
      {action ? (
        <Press
          testID={action.testID}
          onPress={action.onPress}
          hitSlop={6}
          pressedClassName="bg-sand-light"
          className="h-8 items-center justify-center rounded-full bg-card px-3"
        >
          <Text className="text-[13px] leading-[18px] font-display-semibold text-foreground">
            {action.label}
          </Text>
        </Press>
      ) : null}
    </View>
  );
}
