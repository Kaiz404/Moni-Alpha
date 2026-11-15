import type { ReactNode } from 'react';
import Animated, {
  Easing,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';

import { springs } from '@/lib/motion/tokens';

const EXIT_MS = 160;
const EXIT = { duration: EXIT_MS, easing: Easing.bezier(0.23, 1, 0.32, 1) };

/**
 * A row that leaves a list fades and shrinks toward 0.97 first. What stays waits for it, then
 * settles into the gap on the sheet spring. Reduce Motion keeps the fade and nothing moves.
 */
export const listSettle = LinearTransition.springify()
  .stiffness(springs.sheet.stiffness)
  .damping(springs.sheet.damping)
  .mass(springs.sheet.mass)
  .delay(EXIT_MS - 40);

function rowExit() {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, EXIT),
      transform: [{ scale: withTiming(0.97, EXIT) }],
    },
  };
}

const rowFadeOut = FadeOut.duration(EXIT_MS).reduceMotion(ReduceMotion.Never);

/** One item of a list whose items can be deleted: it animates out, and its neighbours settle. */
export function ListItemMotion({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      exiting={reduceMotion ? rowFadeOut : rowExit}
      layout={listSettle}
    >
      {children}
    </Animated.View>
  );
}
