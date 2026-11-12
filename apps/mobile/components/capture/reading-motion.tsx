import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { wordOrder } from '@/lib/text/word-order';

/** 0 → 1 → 0 forever on a sine, starting `delay` ms in; stays 0 under Reduce Motion. */
function useBreath(duration: number, delay = 0): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const half = { duration: duration / 2, easing: Easing.inOut(Easing.sin) };
    value.set(withDelay(delay, withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1)));
  }, [delay, duration, reduceMotion, value]);
  return value;
}

/** 0 → 1 then back to 0 at once, forever; stays 0 under Reduce Motion. */
function useLoop(duration: number, delay: number, easing: 'linear' | 'inOut' | 'out'): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const curve =
      easing === 'inOut' ? Easing.inOut(Easing.cubic) : easing === 'out' ? Easing.out(Easing.quad) : Easing.linear;
    value.set(withDelay(delay, withRepeat(withTiming(1, { duration, easing: curve }), -1)));
  }, [delay, duration, easing, reduceMotion, value]);
  return value;
}

/** A soft Lilac disc behind the hero that swells and settles. */
function Glow({ size }: { size: number }) {
  const breath = useBreath(2400);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + breath.get() * 0.35,
    transform: [{ scale: 0.94 + breath.get() * 0.1 }],
  }));
  return (
    <Animated.View
      className="absolute rounded-full bg-block-lilac"
      style={[{ width: size, height: size }, style]}
    />
  );
}

/** Four sparkles set symmetrically around the hero, twinkling in turn. */
const SPARKLES = [
  { x: -1, y: -1, size: 18 },
  { x: 1, y: -1, size: 14 },
  { x: 1, y: 1, size: 18 },
  { x: -1, y: 1, size: 14 },
] as const;

function Sparkle({ x, y, size, index, spread }: { x: number; y: number; size: number; index: number; spread: number }) {
  const tokens = useThemeTokens();
  const twinkle = useBreath(1600, index * 400);
  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + twinkle.get() * 0.75,
    transform: [
      { translateX: x * spread },
      { translateY: y * spread * 0.86 - twinkle.get() * 4 },
      { scale: 0.7 + twinkle.get() * 0.45 },
      { rotate: `${twinkle.get() * 45}deg` },
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
        color={tokens.lilac}
      />
    </Animated.View>
  );
}

function Sparkles({ spread }: { spread: number }) {
  return SPARKLES.map((sparkle, index) => (
    <Sparkle
      key={index}
      {...sparkle}
      index={index}
      spread={spread}
    />
  ));
}

const RECEIPT_W = 184;
const RECEIPT_H = 236;
const BAND_H = 72;
const CORNER = 26;
const CORNER_GAP = 12;
const CORNERS = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
] as const;

/** One Lilac viewfinder corner; `x`/`y` -1 is left/top, 1 is right/bottom. It eases out and back with `breath`. */
function Corner({ x, y, breath }: { x: -1 | 1; y: -1 | 1; breath: SharedValue<number> }) {
  const tokens = useThemeTokens();
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x * breath.get() * 5 }, { translateY: y * breath.get() * 5 }],
  }));
  const radius = 14;
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: CORNER,
          height: CORNER,
          borderColor: tokens.lilac,
          ...(x < 0 ? { left: -CORNER_GAP, borderLeftWidth: 3 } : { right: -CORNER_GAP, borderRightWidth: 3 }),
          ...(y < 0 ? { top: -CORNER_GAP, borderTopWidth: 3 } : { bottom: -CORNER_GAP, borderBottomWidth: 3 }),
          ...(y < 0
            ? x < 0
              ? { borderTopLeftRadius: radius }
              : { borderTopRightRadius: radius }
            : x < 0
              ? { borderBottomLeftRadius: radius }
              : { borderBottomRightRadius: radius }),
        },
        style,
      ]}
    />
  );
}

/** The receipt in a breathing viewfinder, a Lilac band sweeping down it, sparkles around it. */
export function ScanningReceipt({ imageUri }: { imageUri: string }) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const sweep = useLoop(1900, 0, 'inOut');
  const breath = useBreath(1800);
  const band = useAnimatedStyle(() => ({
    transform: [{ translateY: -BAND_H + sweep.get() * (RECEIPT_H + BAND_H) }],
  }));
  return (
    <View
      className="items-center justify-center"
      style={{ width: 300, height: 320 }}
    >
      <Glow size={290} />
      <Sparkles spread={150} />
      <View style={{ width: RECEIPT_W, height: RECEIPT_H }}>
        <View
          className="overflow-hidden rounded-tile bg-sand"
          style={{ width: RECEIPT_W, height: RECEIPT_H }}
        >
          <Image
            source={{ uri: imageUri }}
            contentFit="cover"
            accessibilityLabel="The scanned receipt"
            style={{ width: RECEIPT_W, height: RECEIPT_H }}
          />
          {reduceMotion ? null : (
            <Animated.View
              pointerEvents="none"
              style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: BAND_H }, band]}
            >
              <LinearGradient
                colors={[`${tokens.lilac}00`, `${tokens.lilac}66`]}
                style={{ flex: 1 }}
              />
              <View style={{ height: 2, backgroundColor: tokens.lilac }} />
            </Animated.View>
          )}
        </View>
        {CORNERS.map((corner) => (
          <Corner
            key={`${corner.x}${corner.y}`}
            {...corner}
            breath={breath}
          />
        ))}
      </View>
    </View>
  );
}

/** One ring growing out of the mic and fading. */
function Halo({ delay }: { delay: number }) {
  const grow = useLoop(2400, delay, 'out');
  const style = useAnimatedStyle(() => ({
    opacity: 0.8 * (1 - grow.get()),
    transform: [{ scale: 1 + grow.get() * 1.3 }],
  }));
  return (
    <Animated.View
      className="absolute h-24 w-24 rounded-full bg-block-lilac"
      style={style}
    />
  );
}

/** How tall each bar peaks; mirrored so the wave is symmetrical about the middle bar. */
const WAVE = [0.35, 0.6, 0.85, 1, 0.85, 0.6, 0.35] as const;

function WaveBar({ peak, index }: { peak: number; index: number }) {
  const tokens = useThemeTokens();
  const breath = useBreath(900, Math.abs(index - 3) * 120);
  const style = useAnimatedStyle(() => ({ height: 6 + peak * 22 * (0.35 + breath.get() * 0.65) }));
  return (
    <Animated.View
      className="w-[5px] rounded-full"
      style={[{ backgroundColor: tokens.foreground }, style]}
    />
  );
}

/** The mic rippling inside its glow, a voice wave under it, and the words heard lighting up one by one. */
export function HeardQuote({ text }: { text: string }) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const parts = `“${text}”`.split(/(\s+)/);
  const order = wordOrder(parts);
  const words = order.filter((index) => index >= 0).length;
  const [lit, setLit] = useState(reduceMotion ? words : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(
      () => setLit((count) => Math.min(words, count + 1)),
      Math.max(45, Math.min(110, 1400 / words)),
    );
    return () => clearInterval(timer);
  }, [reduceMotion, words]);

  return (
    <View className="items-center gap-7">
      <View
        className="items-center justify-center"
        style={{ width: 260, height: 220 }}
      >
        <Glow size={210} />
        <Halo delay={0} />
        <Halo delay={800} />
        <Halo delay={1600} />
        <Sparkles spread={118} />
        <View className="h-24 w-24 items-center justify-center rounded-full bg-primary">
          <IconSymbol
            name="microphone"
            size={36}
            color={tokens.primaryForeground}
          />
        </View>
      </View>
      <View className="h-7 flex-row items-center gap-[5px]">
        {WAVE.map((peak, index) => (
          <WaveBar
            key={index}
            peak={peak}
            index={index}
          />
        ))}
      </View>
      <Text
        variant="sectionTitle"
        className="max-w-[310px] text-center"
        accessibilityLabel={text}
      >
        {parts.map((part, index) => {
          const word = order[index];
          if (word < 0) return part;
          return (
            <Text
              key={index}
              style={{ color: word < lit ? tokens.foreground : tokens.muted }}
            >
              {part}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}
