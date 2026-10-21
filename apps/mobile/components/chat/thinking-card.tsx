import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

/** Three dots, the app's only loop (V2F-States); static under Reduce Motion. */
function Dot({ index }: { index: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(index === 0 ? 1 : 0.35);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(
      withDelay(
        index * 200,
        withRepeat(
          withSequence(withTiming(1, { duration: 300 }), withTiming(0.35, { duration: 900 })),
          -1,
        ),
      ),
    );
  }, [index, opacity, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      className="h-1.5 w-1.5 rounded-full bg-primary-foreground"
      style={style}
    />
  );
}

/** Moni at work: the Ink card that its answer replaces in place. */
export function ThinkingCard({ label }: { label: string }) {
  const tokens = useThemeTokens();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Moni is thinking. ${label}`}
      accessibilityLiveRegion="polite"
      className="mb-4 self-start rounded-card bg-primary px-[18px] py-3.5"
    >
      <View className="flex-row items-center gap-2">
        <IconSymbol
          name="creation"
          size={16}
          color={tokens.lilac}
        />
        <Text
          variant="meta"
          className="text-primary-foreground"
        >
          {label}
        </Text>
        <View className="ml-1 flex-row gap-1">
          {[0, 1, 2].map((index) => (
            <Dot
              key={index}
              index={index}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
