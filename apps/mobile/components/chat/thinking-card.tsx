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
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

const BOUNCE_MS = 1100;

/** One dot hopping 5 px on a spring, each 140 ms after the last; still under Reduce Motion. */
function Dot({ index }: { index: number }) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    y.set(
      withDelay(
        index * 140,
        withRepeat(
          withSequence(
            withTiming(-5, { duration: 220, easing: Easing.out(Easing.quad) }),
            withSpring(0, { damping: 9, stiffness: 260 }),
            withTiming(0, { duration: BOUNCE_MS - 600 }),
          ),
          -1,
        ),
      ),
    );
  }, [index, y, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
    opacity: 0.55 + (-y.get() / 5) * 0.45,
  }));
  return (
    <Animated.View
      className="h-[7px] w-[7px] rounded-full bg-primary-foreground"
      style={style}
    />
  );
}

/** The sparkle breathes while Moni works. */
function Sparkle() {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(
      withRepeat(
        withSequence(
          withTiming(1.18, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [pulse, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.get() }, { rotate: `${(pulse.get() - 1) * 90}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <IconSymbol
        name="creation"
        size={16}
        color={tokens.moniGlyph}
      />
    </Animated.View>
  );
}

/** Moni at work: an Ink bubble saying what it is doing, over hopping dots; its answer replaces it in place. */
export function ThinkingCard({ label }: { label: string }) {
  const tokens = useThemeTokens();
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      accessibilityRole="progressbar"
      accessibilityLabel={`Moni is thinking. ${label}`}
      accessibilityLiveRegion="polite"
      className="h-11 flex-row items-center gap-2.5 self-start rounded-[22px] rounded-bl-md bg-primary px-[18px]"
    >
      <Sparkle />
      <Text
        variant="body"
        style={{ color: tokens.onInkBody }}
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-[5px] pt-1">
        {[0, 1, 2].map((index) => (
          <Dot
            key={index}
            index={index}
          />
        ))}
      </View>
    </Animated.View>
  );
}
