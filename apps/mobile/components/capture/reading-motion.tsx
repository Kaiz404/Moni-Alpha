import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { wordOrder } from '@/lib/text/word-order';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

const RECEIPT_W = 172;
const RECEIPT_H = 220;
const BAND_H = 64;

/** The receipt photo with a Lilac band sweeping down it, the way a scanner reads a page. */
export function ScanningReceipt({ imageUri }: { imageUri: string }) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(-BAND_H);
  useEffect(() => {
    if (reduceMotion) return;
    y.set(withRepeat(withTiming(RECEIPT_H, { duration: 1800, easing: Easing.inOut(Easing.cubic) }), -1));
  }, [y, reduceMotion]);
  const band = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <View
      className="self-center overflow-hidden rounded-tile bg-sand"
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
            colors={[`${tokens.lilac}00`, `${tokens.lilac}59`]}
            style={{ flex: 1 }}
          />
          <View style={{ height: 2, backgroundColor: tokens.lilac }} />
        </Animated.View>
      )}
    </View>
  );
}

/** One soft Lilac ring growing out from the mic and fading. */
function Halo({ delay }: { delay: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(delay, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1)));
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - progress.get()),
    transform: [{ scale: 1 + progress.get() * 0.7 }],
  }));
  return (
    <Animated.View
      className="absolute h-16 w-16 rounded-full bg-block-lilac"
      style={style}
    />
  );
}

/** What the user said, lighting up word by word as Moni reads it, under a mic that ripples. */
export function HeardQuote({ text }: { text: string }) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const parts = `“${text}”`.split(/(\s+)/);
  const words = parts.filter((part) => part.trim()).length;
  const [lit, setLit] = useState(reduceMotion ? words : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => {
      setLit((count) => {
        if (count >= words) clearInterval(timer);
        return Math.min(words, count + 1);
      });
    }, Math.max(45, Math.min(110, 1400 / words)));
    return () => clearInterval(timer);
  }, [reduceMotion, words]);

  const order = wordOrder(parts);
  return (
    <View className="items-center gap-5">
      <View className="h-24 w-24 items-center justify-center">
        {reduceMotion ? null : (
          <>
            <Halo delay={0} />
            <Halo delay={900} />
          </>
        )}
        <View className="h-16 w-16 items-center justify-center rounded-full bg-sand">
          <IconSymbol
            name="microphone"
            size={28}
            color={tokens.foreground}
          />
        </View>
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

export const RECEIPT_STEPS = ['Finding the total', 'Reading the items', 'Picking a category'];
export const VOICE_STEPS = ['Finding the amount', 'Picking a category', 'Setting the date'];

/** When each step after the first starts; the last one stays busy until Moni's answer replaces the page. */
const STEP_STARTS_MS = [900, 2100];

function Spinner() {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    turn.set(withRepeat(withTiming(1, { duration: 800, easing: Easing.linear }), -1));
  }, [turn, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 360}deg` }] }));
  return (
    <Animated.View
      style={[
        {
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2.5,
          borderColor: tokens.lilac,
          borderTopColor: 'transparent',
        },
        style,
      ]}
    />
  );
}

function StepMark({ state }: { state: 'done' | 'active' | 'waiting' }) {
  const tokens = useThemeTokens();
  return (
    <View className="h-7 w-7 items-center justify-center">
      {state === 'done' ? (
        <Animated.View
          key="done"
          entering={ZoomIn.springify().damping(14)}
          className="h-7 w-7 items-center justify-center rounded-full bg-block-mint"
        >
          <IconSymbol
            name="check"
            size={16}
            color={tokens.onPastel}
          />
        </Animated.View>
      ) : state === 'active' ? (
        <Animated.View
          key="active"
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(120)}
        >
          <Spinner />
        </Animated.View>
      ) : (
        <View className="h-5 w-5 rounded-full border-2 border-sand" />
      )}
    </View>
  );
}

/** The steps Moni works through, ticking off one by one on a Paper card. */
export function ReadingSteps({ steps }: { steps: string[] }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timers = STEP_STARTS_MS.map((at, index) => setTimeout(() => setActive(index + 1), at));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <View className="rounded-card bg-card px-[18px] py-1.5">
      {steps.map((step, index) => {
        const state = index < active ? 'done' : index === active ? 'active' : 'waiting';
        return (
          <View
            key={step}
            className="min-h-[54px] flex-row items-center gap-3.5"
          >
            <StepMark state={state} />
            <Text
              variant="body"
              className={state === 'waiting' ? 'text-muted' : state === 'done' ? 'text-ink-2' : 'text-foreground'}
            >
              {step}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
