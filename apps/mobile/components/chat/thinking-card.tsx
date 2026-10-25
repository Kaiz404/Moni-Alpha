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
import { useThemeTokens } from '@/hooks/use-theme-tokens';

/** Three dots blinking on a 1.2 s cycle, the app's only loop (V2F-States); static under Reduce Motion. */
function Dot({ index }: { index: number }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0.3);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(
      withDelay(
        index * 150,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 480 }),
            withTiming(0.3, { duration: 480 }),
            withTiming(0.3, { duration: 240 }),
          ),
          -1,
        ),
      ),
    );
  }, [index, opacity, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      className="h-[7px] w-[7px] rounded-full bg-primary-foreground"
      style={style}
    />
  );
}

/** Moni at work: an Ink bubble of three dots that its answer replaces in place. */
export function ThinkingCard({ label }: { label: string }) {
  const tokens = useThemeTokens();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Moni is thinking. ${label}`}
      accessibilityLiveRegion="polite"
      className="h-11 flex-row items-center gap-2.5 self-start rounded-[22px] rounded-bl-md bg-primary px-[18px]"
    >
      <IconSymbol
        name="creation"
        size={16}
        color={tokens.lilac}
      />
      <View className="flex-row gap-[5px]">
        {[0, 1, 2].map((index) => (
          <Dot
            key={index}
            index={index}
          />
        ))}
      </View>
    </View>
  );
}
