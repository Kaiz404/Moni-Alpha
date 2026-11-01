import { createContext, useContext, type ReactNode } from 'react';
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

const REDUCED_FADE = { duration: 150 };
const OWN_CORNERS = /(^|\s)rounded(-|\s|$)/;

const RowsContext = createContext(false);

/**
 * Marks a surface that clips its rows, as `ListCard` does. A `Press` with no
 * corners of its own inside it is a row: it fills to the surface's edges and
 * follows its corners, so it must not scale away from them.
 */
export function PressRows({ children }: { children: ReactNode }) {
  return (
    <RowsContext.Provider value>{children}</RowsContext.Provider>
  );
}

export type PressProps = Omit<
  PressableProps,
  'testID' | 'style' | 'children' | 'className'
> & {
  testID: TestId;
  className?: string;
  /**
   * Fill that fades in while pressed, default Sand light. Drawn only when there
   * is a shape to follow: a `rounded-*` class, `radius`, or a row in `PressRows`.
   */
  pressedClassName?: string;
  /** Corners that morph while pressed, as on capsule buttons (rest 26 → 16). */
  radius?: { rest: number; pressed: number };
  /** Tab cells squish to 0.94 and rows stay at 1; everything else keeps 0.97. */
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * The one press primitive. Feedback starts on finger-down: scale 0.97 on the
 * `press` spring and the pressed fill fades in; release springs back on
 * `control`. Under Reduce Motion only the fill fades. The feedback follows the
 * shape of what is pressed, so a Press with no corners draws no fill of its own.
 */
export function Press({
  testID,
  className,
  pressedClassName = 'bg-sand-light',
  radius,
  pressedScale,
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
  const inRows = useContext(RowsContext);
  const cornered = radius !== undefined || OWN_CORNERS.test(className ?? '');
  const row = inRows && !cornered;
  const squish = pressedScale ?? (row ? 1 : 0.97);

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
            : interpolate(p, [0, 1], [1, squish]),
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
      {cornered || row ? (
        <Animated.View
          pointerEvents="none"
          className={`absolute inset-0 ${pressedClassName}`}
          style={fill}
        />
      ) : null}
      {inRows ? (
        <RowsContext.Provider value={false}>{children}</RowsContext.Provider>
      ) : (
        children
      )}
    </AnimatedPressable>
  );
}
