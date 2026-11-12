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
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

import { MicHero } from './reading-motion';

function elapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The red dot that says the mic is on, fading in and out beside the timer. */
function RecordingDot() {
  const reduceMotion = useReducedMotion();
  const fade = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    fade.set(
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [fade, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: fade.get() }));
  return (
    <Animated.View
      className="h-2.5 w-2.5 rounded-full bg-coral"
      style={style}
    />
  );
}

/** V2A-CaptureSay: the timer, the live transcript, Done speaking and Type it instead. */
export function Listening({
  seconds,
  transcript,
  level,
  onDone,
}: {
  seconds: number;
  transcript: string;
  /** Mic loudness from 0 to 1. */
  level: SharedValue<number>;
  onDone: () => void;
}) {
  return (
    <Page
      screen="capture"
      kind="task"
      title=""
    >
      <View className="flex-1 items-center justify-center gap-5 px-5 pb-6">
        <View className="h-8 flex-row items-center gap-2 rounded-full bg-sand px-3.5">
          <RecordingDot />
          <Text
            testID={tid('capture', 'timer')}
            variant="body"
            className="font-display-semibold text-foreground"
            style={{ fontVariant: ['tabular-nums'] }}
            accessibilityLabel={`Recording for ${seconds} seconds`}
          >
            {elapsed(seconds)}
          </Text>
        </View>
        <MicHero level={level} />
        <Text
          testID={tid('capture', 'transcript')}
          accessibilityLiveRegion="polite"
          className="min-h-16 max-w-[320px] text-center text-[26px] leading-[32px] font-display-semibold tracking-[-0.52px] text-foreground"
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
      title=""
    >
      <View className="flex-1 items-center justify-center gap-3 px-7 pb-10">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-sand">
          <IconSymbol
            name="microphone-off"
            size={38}
            color={tokens.foreground}
          />
        </View>
        <Text
          variant="sectionTitle"
          className="text-center text-foreground"
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
          size="compact"
          align="center"
          label="Microphone is off for Moni"
        />
      </View>
      <View className="gap-2.5 px-5 pb-3">
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
