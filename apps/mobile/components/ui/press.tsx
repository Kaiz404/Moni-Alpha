import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { springs } from '@/lib/motion/tokens';
import type { TestId } from '@/lib/test-ids';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESSED_SCALE = 0.97;
const REDUCED_FADE = { duration: 150 };

export type PressProps = Omit<
  PressableProps,
  'testID' | 'style' | 'children' | 'className'
> & {
  testID: TestId;
  className?: string;
  /** Fill that fades in while pressed. A class such as `bg-hairline`. */
  pressedClassName?: string;
  /** Corners that morph while pressed, as on capsule buttons (rest 26 → 16). */
  radius?: { rest: number; pressed: number };
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * The one press primitive. Feedback starts on finger-down: scale 0.97 on the
 * `press` spring and the pressed fill fades in; release springs back on
 * `control`. Under Reduce Motion only the fill fades.
 */
export function Press({
  testID,
  className,
  pressedClassName = 'bg-sand-light',
  radius,
  style,
  children,
  onPressIn,
  onPressOut,
  accessibilityRole = 'button',
  pressRetentionOffset = 16,
  ...props
}: PressProps) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const body = useAnimatedStyle(() => {
    const p = pressed.get();
    const corners = radius && {
      borderRadius: reduceMotion
        ? radius.rest
        : interpolate(
            p,
            [0, 1],
            [radius.rest, radius.pressed],
            Extrapolation.CLAMP,
          ),
    };
    return {
      ...corners,
      transform: [
        {
          scale: reduceMotion
            ? 1
            : interpolate(p, [0, 1], [1, PRESSED_SCALE]),
        },
      ],
    };
  });

  const fill = useAnimatedStyle(() => ({
    opacity: interpolate(
      pressed.get(),
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <AnimatedPressable
      {...props}
      testID={testID}
      accessibilityRole={accessibilityRole}
      pressRetentionOffset={pressRetentionOffset}
      className={`overflow-hidden ${className ?? ''}`}
      style={[style, body]}
      onPressIn={(event) => {
        pressed.set(
          reduceMotion
            ? withTiming(1, REDUCED_FADE)
            : withSpring(1, springs.press),
        );
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.set(
          reduceMotion
            ? withTiming(0, REDUCED_FADE)
            : withSpring(0, springs.control),
        );
        onPressOut?.(event);
      }}
    >
      <Animated.View
        pointerEvents="none"
        className={`absolute inset-0 ${pressedClassName}`}
        style={fill}
      />
      {children}
    </AnimatedPressable>
  );
}
