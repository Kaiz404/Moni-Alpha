import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SIZE = 112;
const CHECK = 'M34 58 L50 73 L79 42';
/** A little over the check's drawn length, so a dash of it hides the whole stroke. */
const CHECK_LENGTH = 66;

/** Eight sparks evenly round the disc, alternating size and colour so the burst reads as one ring. */
const SPARKS = Array.from({ length: 8 }, (_, index) => ({
  angle: (index / 8) * Math.PI * 2 - Math.PI / 2,
  size: index % 2 ? 14 : 20,
  tone: (['mint', 'lemon', 'lilac', 'mint'] as const)[index % 4],
}));

/** One sparkle flying out from behind the disc, growing, turning and fading as it goes. */
function Spark({ angle, size, tone, delay }: { angle: number; size: number; tone: 'mint' | 'lemon' | 'lilac'; delay: number }) {
  const tokens = useThemeTokens();
  const fly = useSharedValue(0);
  useEffect(() => {
    fly.set(withDelay(delay, withTiming(1, { duration: 820, easing: Easing.out(Easing.cubic) })));
  }, [delay, fly]);
  const style = useAnimatedStyle(() => {
    const p = fly.get();
    const reach = SIZE * 0.42 + p * SIZE * 0.5;
    return {
      opacity: p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75,
      transform: [
        { translateX: Math.cos(angle) * reach },
        { translateY: Math.sin(angle) * reach },
        { scale: 0.3 + Math.sin(p * Math.PI) * 0.9 },
        { rotate: `${p * 120}deg` },
      ],
    };
  });
  return (
    <Animated.View
      className="absolute"
      style={style}
    >
      <IconSymbol
        name="creation"
        size={size}
        color={tokens[tone]}
      />
    </Animated.View>
  );
}

/** Three sparkles that stay by the disc after the burst, twinkling in turn. */
const TWINKLES = [
  { x: -0.62, y: -0.5, size: 18, delay: 900 },
  { x: 0.66, y: -0.18, size: 14, delay: 1250 },
  { x: -0.42, y: 0.66, size: 12, delay: 1600 },
] as const;

function Twinkle({ x, y, size, delay }: (typeof TWINKLES)[number]) {
  const tokens = useThemeTokens();
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
        ),
      ),
    );
  }, [delay, glow]);
  const style = useAnimatedStyle(() => ({
    opacity: glow.get(),
    transform: [
      { translateX: x * SIZE },
      { translateY: y * SIZE },
      { scale: 0.6 + glow.get() * 0.5 },
      { rotate: `${glow.get() * 45}deg` },
    ],
  }));
  return (
    <Animated.View
      className="absolute"
      style={style}
    >
      <IconSymbol
        name="creation"
        size={size}
        color={tokens.lemon}
      />
    </Animated.View>
  );
}

/**
 * The Mint disc pops in, a ring pulses out of it and sparkles burst from behind it once, then the
 * check draws itself left to right and three sparkles keep twinkling beside it.
 */
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
      style={{ width: SIZE * 2.2, height: SIZE * 2.2 }}
    >
      <Animated.View
        className="absolute rounded-full border-[3px] border-mint"
        style={[{ width: SIZE, height: SIZE }, ringStyle]}
      />
      {reduceMotion ? null : (
        <>
          {SPARKS.map((spark, index) => (
            <Spark
              key={index}
              {...spark}
              delay={140 + (index % 2) * 60}
            />
          ))}
          {TWINKLES.map((twinkle, index) => (
            <Twinkle
              key={index}
              {...twinkle}
            />
          ))}
        </>
      )}
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
