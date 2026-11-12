import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SIZE = 112;
const CHECK = 'M34 58 L50 73 L79 42';
/** A little over the check's drawn length, so a dash of it hides the whole stroke. */
const CHECK_LENGTH = 66;

/** The Mint disc pops in, a ring pulses out of it once, then the check draws itself left to right. */
export function AddedTick() {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const disc = useSharedValue(reduceMotion ? 1 : 0);
  const ring = useSharedValue(reduceMotion ? 1 : 0);
  const draw = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    disc.set(withSpring(1, { damping: 13, stiffness: 190 }));
    ring.set(withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })));
    draw.set(withDelay(230, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })));
  }, [disc, draw, reduceMotion, ring]);

  const discStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, disc.get() * 2),
    transform: [{ scale: 0.4 + disc.get() * 0.6 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.get() >= 1 ? 0 : 0.6 * (1 - ring.get()),
    transform: [{ scale: 1 + ring.get() * 0.7 }],
  }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LENGTH * (1 - draw.get()) }));

  return (
    <View
      className="items-center justify-center"
      style={{ width: SIZE * 1.8, height: SIZE * 1.8 }}
    >
      <Animated.View
        className="absolute rounded-full border-[3px] border-mint"
        style={[{ width: SIZE, height: SIZE }, ringStyle]}
      />
      <Animated.View
        className="items-center justify-center rounded-full bg-block-mint"
        style={[{ width: SIZE, height: SIZE }, discStyle]}
      >
        <Svg
          width={SIZE}
          height={SIZE}
          viewBox="0 0 112 112"
        >
          <AnimatedPath
            d={CHECK}
            fill="none"
            stroke={tokens.onPastel}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CHECK_LENGTH}
            animatedProps={checkProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
