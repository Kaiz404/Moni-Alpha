import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { useUniwind } from 'uniwind';

import {
  MASCOT_ART,
  MASCOT_MONO,
  type MascotMood,
} from '@/components/brand/mascot-art.generated';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@repo/design';

export {
  MASCOT_MOODS,
  type MascotMood,
} from '@/components/brand/mascot-art.generated';

export type MascotVariant = 'tile' | 'light' | 'dark' | 'mono';

type MascotProps = {
  mood?: MascotMood;
  /** The side of the square the cat sits in. */
  size?: number;
  /** Defaults to `light` in the light theme and `dark` in the dark one. */
  variant?: MascotVariant;
  /** The one fill of the `mono` variant; defaults to the text colour. */
  color?: string;
  /** Scales in on mount. */
  pop?: boolean;
  /** Hides the cat from screen readers when the words beside it already say it. */
  decorative?: boolean;
  testID?: string;
};

const POP_FROM = 0.6;

/** Moni's cat, drawn from the locked Cat Pebble art (`scripts/brand/export.py`). */
export function Mascot({
  mood = 'neutral',
  size = 72,
  variant,
  color,
  pop = false,
  decorative = false,
  testID,
}: MascotProps) {
  const dark = useUniwind().theme === 'dark';
  const tokens = useThemeTokens();
  const scale = useSharedValue(pop ? POP_FROM : 1);
  const shape = variant ?? (dark ? 'dark' : 'light');

  useEffect(() => {
    if (pop) scale.set(withSpring(1, springs.control));
  }, [pop, scale]);

  const popped = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <Animated.View
      testID={testID}
      style={[{ width: size, height: size }, popped]}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={
        decorative
          ? undefined
          : mood === 'neutral'
            ? 'Moni'
            : `Moni, ${mood}`
      }
      importantForAccessibility={
        decorative ? 'no-hide-descendants' : 'auto'
      }
    >
      <SvgXml
        xml={
          shape === 'mono'
            ? MASCOT_MONO[mood]
            : MASCOT_ART[shape][mood]
        }
        width={size}
        height={size}
        color={color ?? tokens.foreground}
      />
    </Animated.View>
  );
}

type MoniGlyphProps = {
  size?: number;
  color?: string;
  /** Read out instead of hiding the glyph from screen readers. */
  accessibilityLabel?: string;
};

/** The one-colour cat head that marks Moni beside a label, at 14 to 24. */
export function MoniGlyph({
  size = 18,
  color,
  accessibilityLabel,
}: MoniGlyphProps) {
  const tokens = useThemeTokens();
  return (
    <SvgXml
      xml={MASCOT_MONO.neutral}
      width={size}
      height={size}
      color={color ?? tokens.foreground}
      accessible={accessibilityLabel != null}
      accessibilityRole={
        accessibilityLabel != null ? 'image' : undefined
      }
      accessibilityLabel={accessibilityLabel}
    />
  );
}
