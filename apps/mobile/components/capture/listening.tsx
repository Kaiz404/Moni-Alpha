import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { StatusPill } from '@/components/ui/status-pill';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

function elapsed(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** How far each layer grows at full volume. They nest, so the rings spread apart as you get louder. */
const GROW = { outer: 0.16, middle: 0.1, core: 0.06 };

/** The mic orb: Lilac rings on a Sand light halo, swelling with how loud the mic hears you. */
function Orb({ level }: { level: SharedValue<number> }) {
  const tokens = useThemeTokens();
  const outer = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + GROW.outer * level.get() }],
  }));
  const middle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + GROW.middle * level.get() }],
  }));
  const core = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + GROW.core * level.get() }],
  }));

  return (
    <View className="h-[320px] items-center justify-center self-stretch">
      <View className="h-[268px] w-[268px] items-center justify-center rounded-full bg-sand-light">
        <Animated.View
          className="h-[220px] w-[220px] items-center justify-center rounded-full bg-pending-fill"
          style={outer}
        >
          <Animated.View
            className="h-[180px] w-[180px] items-center justify-center rounded-full bg-block-lilac/50"
            style={middle}
          >
            <Animated.View
              className="h-[140px] w-[140px] items-center justify-center rounded-full bg-block-lilac"
              style={core}
            >
              <IconSymbol
                name="microphone"
                size={48}
                color={tokens.onPastel}
              />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
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
        <Orb level={level} />
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
      <View className="flex-1 items-center gap-3 px-7 pt-24">
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
