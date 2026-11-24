import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { isFresh, settle } from '@/lib/ai/chat/fresh-replies';
import { springs } from '@repo/design';

const TICK_MS = 50;
const MS_PER_WORD = 45;
const MIN_MS = 500;
const MAX_MS = 2200;
/** Long enough for the `sheet` spring to finish the last line's growth. */
const SETTLE_MS = 600;

/** Where each word of `text` ends, so a shown prefix never cuts a word in half. */
export function wordEnds(text: string): number[] {
  return Array.from(text.matchAll(/\S+/g), (match) => match.index + match[0].length);
}

/**
 * Moni's reply as body text. A reply that just arrived streams in a few words at a time, and its
 * bubble grows on a spring to fit each new line (at most 2.2 s, a tap shows the rest). Once it
 * has played, the box lets go of its height, so a missed layout can never clip the last line.
 * Older replies and Reduce Motion show whole.
 */
export function RevealText({
  messageId,
  text,
  color,
  testID,
}: {
  messageId: string;
  text: string;
  color: string;
  testID?: string;
}) {
  const reduceMotion = useReducedMotion();
  const ends = useMemo(() => wordEnds(text), [text]);
  const [stream] = useState(() => ends.length > 1 && isFresh(messageId) && !reduceMotion);
  const [shown, setShown] = useState(stream ? 1 : ends.length);
  const [played, setPlayed] = useState(!stream);
  const height = useSharedValue(0);
  const box = useAnimatedStyle(() =>
    height.get() > 0 ? { height: height.get(), overflow: 'hidden' } : {},
  );

  useEffect(() => {
    if (!stream) return settle(messageId);
    const words = ends.length;
    const perTick = words / (Math.min(MAX_MS, Math.max(MIN_MS, words * MS_PER_WORD)) / TICK_MS);
    let count = 1;
    let release: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      count += perTick;
      setShown((prev) => Math.max(prev, Math.min(words, Math.floor(count))));
      if (count >= words) {
        clearInterval(timer);
        settle(messageId);
        release = setTimeout(() => setPlayed(true), SETTLE_MS);
      }
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      clearTimeout(release);
      settle(messageId);
    };
  }, [stream, messageId, ends]);

  if (played)
    return (
      <Text
        testID={testID}
        variant="body"
        style={{ color }}
      >
        {text}
      </Text>
    );

  return (
    <Animated.View style={box}>
      <View
        onLayout={(event) => {
          const next = event.nativeEvent.layout.height;
          height.set(height.get() === 0 ? next : withSpring(next, springs.sheet));
        }}
      >
        <Text
          testID={testID}
          variant="body"
          accessibilityLabel={text}
          onPress={() => {
            setShown(ends.length);
            setPlayed(true);
          }}
          style={{ color }}
        >
          {text.slice(0, ends[shown - 1])}
        </Text>
      </View>
    </Animated.View>
  );
}
