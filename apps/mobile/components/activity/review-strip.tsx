import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

/** The Lilac "To review" capsule in the Activity header. */
export function ReviewStrip({
  count,
  amount,
  onPress,
}: {
  count: number;
  /** Main-currency total of the captures, or null when none is in it. */
  amount: string | null;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('activity', 'to-review')}
      accessibilityLabel={`${count} to review${amount ? `, ${amount}` : ''}`}
      onPress={onPress}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-foreground/10"
      className="h-11 flex-row items-center gap-2 bg-lilac pl-1.5 pr-2.5"
    >
      <View className="h-8 min-w-8 items-center justify-center rounded-full bg-primary px-1.5">
        <Text className="text-[13px] leading-[18px] font-display-bold text-primary-foreground">
          {count}
        </Text>
      </View>
      <View>
        <Text className="text-[13px] leading-[16px] font-display-semibold text-on-pastel">
          To review
        </Text>
        {amount ? (
          <Text
            className="text-[12px] leading-[15px] text-on-pastel"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {amount}
          </Text>
        ) : null}
      </View>
      <IconSymbol name="chevron-right" size={18} color={tokens.onPastel} />
    </Press>
  );
}
