import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useUniwind } from 'uniwind';

import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

const LOOP_MS = 900;
const RISE_MS = 300;
const STAGGER_MS = 120;
const RISE = 6;

/** One coin, the one the cat holds, rising 6 and settling, each 120 ms after the last; still under Reduce Motion. */
function Coin({ index, rim }: { index: number; rim: string }) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const ease = Easing.inOut(Easing.quad);
    y.set(
      withDelay(
        index * STAGGER_MS,
        withRepeat(
          withSequence(
            withTiming(-RISE, { duration: RISE_MS, easing: ease }),
            withTiming(0, { duration: RISE_MS, easing: ease }),
            withTiming(0, { duration: LOOP_MS - 2 * RISE_MS }),
          ),
          -1,
        ),
      ),
    );
  }, [index, y, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <Animated.View
      className="h-2.5 w-2.5 rounded-full border-[1.5px] bg-lemon"
      style={[{ borderColor: rim }, style]}
    />
  );
}

/** Moni at work: an Ink bubble saying what it is doing, then three coins rising in turn; its answer replaces it in place. */
export function ThinkingCard({ label }: { label: string }) {
  const tokens = useThemeTokens();
  // The coins keep an ink rim on the cream bubble of the dark theme.
  const rim = useUniwind().theme === 'dark' ? tokens.primaryForeground : tokens.foreground;
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      accessibilityRole="progressbar"
      accessibilityLabel={`Moni is thinking. ${label}`}
      accessibilityLiveRegion="polite"
      className="h-11 flex-row items-center gap-2.5 self-start rounded-[22px] rounded-bl-md bg-primary px-[18px]"
    >
      <Text
        variant="body"
        style={{ color: tokens.onInkBody }}
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-[5px] pt-1">
        {[0, 1, 2].map((index) => (
          <Coin
            key={index}
            index={index}
            rim={rim}
          />
        ))}
      </View>
    </Animated.View>
  );
}
