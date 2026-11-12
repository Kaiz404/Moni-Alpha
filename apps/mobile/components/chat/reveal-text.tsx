import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { isFresh, settle } from '@/lib/ai/chat/fresh-replies';
import { wordOrder } from '@/lib/text/word-order';

const TICK_MS = 33;
const MS_PER_WORD = 40;
const MIN_MS = 400;
const MAX_MS = 1500;
/** The newest words sit at half strength for this many words, so each one fades up. */
const FADING_WORDS = 3;

function half(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}80` : color;
}

/**
 * Moni's reply as body text. A reply that just arrived types itself in word by
 * word (at most 1.5 s, a tap shows the rest); the bubble takes its full size at
 * once so nothing below it jumps. Older replies and Reduce Motion show whole.
 */
export function RevealText({
  messageId,
  text,
  color,
  testID,
}: {
  messageId: string;
  text: string;
  /** The text colour as hex; the reveal fades words up from half of it. */
  color: string;
  testID?: string;
}) {
  const reduceMotion = useReducedMotion();
  const parts = text.split(/(\s+)/);
  const words = parts.filter((part) => part.trim()).length;
  const [animate] = useState(() => words > 0 && isFresh(messageId) && !reduceMotion);
  const [shown, setShown] = useState(animate ? 0 : words + FADING_WORDS);
  const done = shown >= words + FADING_WORDS;

  useEffect(() => {
    if (!animate) return settle(messageId);
    const perTick = words / (Math.min(MAX_MS, Math.max(MIN_MS, words * MS_PER_WORD)) / TICK_MS);
    let count = 0;
    const timer = setInterval(() => {
      count += perTick;
      setShown((prev) => Math.max(prev, Math.floor(count)));
      if (count >= words + FADING_WORDS) {
        clearInterval(timer);
        settle(messageId);
      }
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      settle(messageId);
    };
  }, [animate, messageId, words]);

  if (done)
    return (
      <Text
        testID={testID}
        variant="body"
        style={{ color }}
      >
        {text}
      </Text>
    );

  const order = wordOrder(parts);
  return (
    <Text
      testID={testID}
      variant="body"
      accessibilityLabel={text}
      onPress={() => setShown(words + FADING_WORDS)}
      style={{ color: 'transparent' }}
    >
      {parts.map((part, index) => {
        const word = order[index];
        if (word < 0) return part;
        const tone = word < shown - FADING_WORDS ? color : word < shown ? half(color) : 'transparent';
        return (
          <Text
            key={index}
            style={{ color: tone }}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}
