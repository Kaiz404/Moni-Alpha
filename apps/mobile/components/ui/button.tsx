import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { approve, notMine } from '@/lib/haptics';
import type { TestId } from '@/lib/test-ids';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'approve'
  | 'notMine'
  | 'destructive';

type Tokens = ReturnType<typeof useThemeTokens>;

type Look = {
  fill: string;
  pressed: string;
  text: string;
  ink: (tokens: Tokens) => string;
  /** The loading ring's track, a step off the fill. */
  track: (tokens: Tokens) => string;
  tall: boolean;
  /** Side padding: 26 on Primary and Secondary, 22 on the icon-led capsules. */
  padding: string;
  haptic?: () => void;
};

// V2F-Components "Buttons": rest fill, pressed fill one step darker, text colour.
const looks: Record<ButtonVariant, Look> = {
  primary: {
    fill: 'bg-primary',
    pressed: 'bg-primary-pressed',
    text: 'text-primary-foreground',
    ink: (t) => t.primaryForeground,
    track: (t) => t.ink2,
    tall: true,
    padding: 'px-[26px]',
  },
  secondary: {
    fill: 'bg-sand',
    pressed: 'bg-hairline',
    text: 'text-foreground',
    ink: (t) => t.foreground,
    track: (t) => t.hairline,
    tall: true,
    padding: 'px-[26px]',
  },
  tertiary: {
    fill: '',
    pressed: 'bg-sand-light',
    text: 'text-deep-mint',
    ink: (t) => t.deepMint,
    track: (t) => t.sandLight,
    tall: false,
    padding: 'px-3.5',
  },
  approve: {
    fill: 'bg-mint',
    pressed: 'bg-mint-pressed',
    text: 'text-on-pastel',
    ink: (t) => t.onPastel,
    track: (t) => t.primaryMuted,
    tall: true,
    padding: 'px-[22px]',
    haptic: approve,
  },
  notMine: {
    fill: 'bg-sand',
    pressed: 'bg-hairline',
    text: 'text-foreground',
    ink: (t) => t.foreground,
    track: (t) => t.hairline,
    tall: true,
    padding: 'px-[22px]',
    haptic: notMine,
  },
  destructive: {
    fill: 'bg-destructive-fill',
    pressed: 'bg-destructive-pressed',
    text: 'text-state-destructive',
    ink: (t) => t.states.destructive,
    track: (t) => t.destructivePressed,
    tall: true,
    padding: 'px-[22px]',
  },
};

export type ButtonProps = {
  testID: TestId;
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconSymbolName;
  loading?: boolean;
  /** Replaces the label while loading, such as "Saving". */
  loadingLabel?: string;
  disabled?: boolean;
  /** Layout only (margins, flex, width); the variant owns colour and size. */
  className?: string;
  accessibilityLabel?: string;
  /** A sheet's pinned action is 56 tall. */
  pinned?: boolean;
  /**
   * The 44 capsule inside a card or tile (empty tiles, Lend more): 18 sides,
   * 14 on the glyph side, 6 between glyph and label.
   */
  compact?: boolean;
  /**
   * The form is not filled in yet: Sand with Ink 2 text and no press, the
   * label saying what is missing (V2P-DebtNew). Disabled keeps the faded look.
   */
  waiting?: boolean;
};

/** The v2 capsule: 52 tall (tertiary 44), 15/600 label, one variant per role. */
export function Button({
  testID,
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  loadingLabel,
  disabled = false,
  className,
  accessibilityLabel,
  pinned = false,
  compact = false,
  waiting = false,
}: ButtonProps) {
  const tokens = useThemeTokens();
  const look = looks[variant];
  const inactive = disabled || loading || waiting;
  const height = pinned ? 56 : look.tall && !compact ? 52 : 44;
  const ink = disabled
    ? tokens.muted
    : waiting
      ? tokens.ink2
      : look.ink(tokens);
  const glyph = loading ? (
    <LoadingRing
      color={ink}
      track={look.track(tokens)}
    />
  ) : icon ? (
    <View pointerEvents="none">
      <IconSymbol
        name={icon}
        size={variant === 'tertiary' ? 18 : 20}
        color={ink}
      />
    </View>
  ) : null;
  const restFill = disabled
    ? variant === 'tertiary'
      ? ''
      : 'bg-sand-light'
    : waiting
      ? 'bg-sand'
      : look.fill;
  const gap = loading
    ? 'gap-2.5'
    : compact
      ? 'gap-1.5'
      : look.tall
        ? 'gap-2'
        : 'gap-0.5';
  const padding = compact
    ? glyph
      ? 'pl-3.5 pr-[18px]'
      : 'px-[18px]'
    : look.padding;
  const textTone = disabled
    ? 'text-muted'
    : waiting
      ? 'text-ink-2'
      : look.text;

  return (
    <Press
      testID={testID}
      onPress={() => {
        look.haptic?.();
        onPress();
      }}
      disabled={inactive}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      radius={{ rest: height / 2, pressed: 16 }}
      pressedClassName={look.pressed}
      className={`flex-row items-center justify-center ${gap} ${padding} ${restFill} ${className ?? ''}`}
      style={{ height }}
    >
      {variant === 'tertiary' ? null : glyph}
      <Text
        className={`text-[15px] leading-[21px] font-display-semibold ${textTone}`}
        numberOfLines={1}
      >
        {loading ? (loadingLabel ?? label) : label}
      </Text>
      {variant === 'tertiary' ? glyph : null}
    </Press>
  );
}

const RING = 18;
const RING_RADIUS = 7;
const RING_STROKE = 2.5;

/** The V2F-Components loading glyph: a 14-long arc turning on its track. */
function LoadingRing({
  color,
  track,
}: {
  color: string;
  track: string;
}) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.set(
      withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1,
      ),
    );
  }, [reduceMotion, turn]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get()}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ width: RING, height: RING }, spin]}
    >
      <Svg
        width={RING}
        height={RING}
        viewBox={`0 0 ${RING} ${RING}`}
      >
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={track}
          strokeWidth={RING_STROKE}
        />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray="14 30"
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
    </Animated.View>
  );
}
