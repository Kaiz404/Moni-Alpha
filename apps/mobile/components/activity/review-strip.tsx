import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

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
      className="h-11 flex-row items-center gap-1.5 bg-lilac pl-1.5 pr-2"
    >
      <View className="h-7 min-w-7 items-center justify-center rounded-full bg-primary px-1.5">
        <Text
          className="text-[13px] leading-[18px] font-display-bold text-primary-foreground"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {count}
        </Text>
      </View>
      <View>
        <Text className="text-[14px] leading-4 font-display-semibold text-on-pastel">
          To review
        </Text>
        {amount ? (
          <Text
            className="text-[12px] leading-4 font-display-semibold text-on-pastel/75"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {amount}
          </Text>
        ) : null}
      </View>
      <IconSymbol name="chevron-right" size={20} color={tokens.onPastel} />
    </Press>
  );
}
