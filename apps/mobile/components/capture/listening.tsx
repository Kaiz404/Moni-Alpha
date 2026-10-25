import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CapturePill } from '@/components/capture/capture-pill';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

const BREATH = { duration: 1200, easing: Easing.bezier(0.77, 0, 0.175, 1) };
const BARS = [10, 18, 30, 22, 36, 26, 14, 24, 16, 10, 20, 12];
const QUIET = 0.35;

function elapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function Bar({ height, level }: { height: number; level: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: QUIET + (1 - QUIET) * level.get() }],
  }));
  return (
    <Animated.View
      className="w-[5px] rounded-full bg-foreground"
      style={[{ height }, style]}
    />
  );
}

/** Twelve Ink bars at the board's heights, scaled by how loud the mic hears you. */
function Waveform({ level }: { level: SharedValue<number> }) {
  return (
    <View
      className="h-10 flex-row items-center justify-center gap-1"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {BARS.map((height, index) => (
        <Bar key={index} height={height} level={level} />
      ))}
    </View>
  );
}

/** The mic orb: Lilac rings on a Sand light halo; the middle ring breathes while Moni listens. */
function Orb() {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    breath.set(withRepeat(withTiming(1, BREATH), -1, true));
  }, [breath, reduceMotion]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.get() * 0.06 }],
  }));

  return (
    <View className="h-[320px] items-center justify-center self-stretch">
    <View className="h-[268px] w-[268px] items-center justify-center rounded-full bg-sand-light">
      <Animated.View
        className="h-[220px] w-[220px] items-center justify-center rounded-full bg-pending-fill"
        style={ring}
      >
        <View className="h-[180px] w-[180px] items-center justify-center rounded-full bg-lilac/50">
          <View className="h-[140px] w-[140px] items-center justify-center rounded-full bg-lilac">
            <IconSymbol
              name="microphone"
              size={48}
              color={tokens.onPastel}
            />
          </View>
        </View>
      </Animated.View>
    </View>
    </View>
  );
}

/** V2A-CaptureSay: the timer, the live transcript, Done speaking and Type it instead. */
export function Listening({
  seconds,
  transcript,
  offline,
  level,
  onDone,
}: {
  seconds: number;
  transcript: string;
  /** The phone recognises speech itself, with no network. */
  offline: boolean;
  /** Mic loudness from 0 to 1. */
  level: SharedValue<number>;
  onDone: () => void;
}) {
  return (
    <Page
      screen="capture"
      kind="task"
      title="Say it"
      trailing={
        <Text
          testID={tid('capture', 'timer')}
          variant="body"
          className="font-display-semibold text-ink-2"
          style={{ fontVariant: ['tabular-nums'] }}
          accessibilityLabel={`Recording for ${seconds} seconds`}
        >
          {elapsed(seconds)}
        </Text>
      }
    >
      <View className="flex-1 items-center gap-3 px-5">
        {offline ? (
          <CapturePill tone="pending" label="Listening on this phone · works offline" />
        ) : null}
        <Orb />
        <Waveform level={level} />
        <Text
          testID={tid('capture', 'transcript')}
          accessibilityLiveRegion="polite"
          className="text-center text-[26px] leading-[32px] font-display-semibold tracking-[-0.52px] text-foreground"
          numberOfLines={3}
        >
          {transcript || 'Listening…'}
        </Text>
        <Text className="text-center text-[14px] leading-[20px] text-ink-2">
          Say the shop, the amount and how you paid.
        </Text>
      </View>
      <View className="gap-1 px-5 pb-3">
        <Button
          testID={tid('capture', 'done-speaking')}
          pinned
          icon="stop"
          label="Done speaking"
          onPress={onDone}
        />
        <Button
          testID={tid('capture', 'type-instead')}
          variant="tertiary"
          label="Type it instead"
          onPress={() => router.replace('/transaction/new')}
        />
      </View>
    </Page>
  );
}

/** V2A-CaptureSayDenied: the microphone is off for Moni. */
export function SayDenied({ onTurnOn }: { onTurnOn: () => void }) {
  const tokens = useThemeTokens();
  return (
    <Page
      screen="capture"
      kind="task"
      title="Say it"
    >
      <View className="flex-1 items-center gap-3 px-8 pt-24">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-sand">
          <IconSymbol
            name="microphone-off"
            size={32}
            color={tokens.foreground}
          />
        </View>
        <Text
          variant="sectionTitle"
          className="pt-2 text-center text-foreground"
        >
          {"Moni can't hear you yet"}
        </Text>
        <Text
          variant="body"
          className="text-center text-ink-2"
        >
          {
            "Turn on microphone access to say a transaction. Speech becomes text on this phone, and the recording isn't kept."
          }
        </Text>
        <StatusPill
          tone="near"
          label="Microphone is off for Moni"
        />
      </View>
      <View className="gap-2 px-5 pb-3">
        <Button
          testID={tid('capture', 'turn-on-mic')}
          pinned
          icon="microphone"
          label="Turn on microphone"
          onPress={onTurnOn}
        />
        <Button
          testID={tid('capture', 'denied', 'type-it')}
          pinned
          variant="secondary"
          icon="dialpad"
          label="Type it instead"
          onPress={() => router.replace('/transaction/new')}
        />
      </View>
    </Page>
  );
}
