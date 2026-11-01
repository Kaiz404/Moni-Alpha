import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

/**
 * Type it's offer at a place the user has paid before. The fields stay untouched until the chip
 * is tapped; it sits above the keypad so its arrival moves no control under a finger.
 */
export function PlaceChip({
  merchant,
  categoryName,
  onUse,
  onDismiss,
}: {
  merchant: string;
  categoryName: string | null;
  onUse: () => void;
  onDismiss: () => void;
}) {
  const tokens = useThemeTokens();
  const offer = categoryName ? `${merchant}, ${categoryName}` : merchant;
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      accessibilityLiveRegion="polite"
      className="max-w-full flex-row items-center self-start rounded-full bg-sand"
    >
      <Press
        testID={tid('capture', 'place-chip')}
        accessibilityLabel={`Use ${offer}. You paid here before.`}
        hitSlop={4}
        radius={{ rest: 18, pressed: 16 }}
        pressedClassName="bg-hairline"
        className="h-9 min-w-0 shrink flex-row items-center gap-1.5 pl-3.5 pr-1"
        onPress={onUse}
      >
        <IconSymbol
          name="map-marker-outline"
          size={18}
          color={tokens.foreground}
        />
        <Text
          className="min-w-0 shrink text-[14px] leading-[19px] font-display-semibold text-foreground"
          numberOfLines={1}
        >
          {categoryName ? `At ${merchant}? · ${categoryName}` : `At ${merchant}?`}
        </Text>
      </Press>
      <Press
        testID={tid('capture', 'place-chip', 'dismiss')}
        accessibilityLabel="Dismiss this suggestion"
        hitSlop={4}
        radius={{ rest: 18, pressed: 16 }}
        pressedClassName="bg-hairline"
        className="h-9 w-9 items-center justify-center"
        onPress={onDismiss}
      >
        <View pointerEvents="none">
          <IconSymbol
            name="close"
            size={18}
            color={tokens.ink2}
          />
        </View>
      </Press>
    </Animated.View>
  );
}
