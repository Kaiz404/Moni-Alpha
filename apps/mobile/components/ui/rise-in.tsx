import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { springs, type SpringToken } from '@/lib/motion/tokens';

const RISE = 8;
const FADE = { duration: 200 };
/** V2F-Motion "List first load": the first 6 rows rise, the rest are already in place. */
const MAX_RISING = 6;
/** Rows that mount later than this after their list (new data, a refresh) do not rise. */
const FIRST_LOAD_WINDOW_MS = 600;

type Entrance = {
  mountedAt: number;
  delay: number;
  stagger: number;
  spring: SpringToken;
};

const EntranceContext = createContext<Entrance | null>(null);

/**
 * Wraps a list whose first rows rise 8 and fade in once, on first load:
 * rows 30 apart on the press spring (V2F-Motion), or the + chooser's 120
 * then 50 apart on control (V2F-Nav).
 */
export function RiseInGroup({
  delay = 0,
  stagger = 30,
  spring = 'press',
  children,
}: {
  delay?: number;
  stagger?: number;
  spring?: SpringToken;
  children: ReactNode;
}) {
  const [mountedAt] = useState(() => Date.now());
  const entrance = useMemo(
    () => ({ mountedAt, delay, stagger, spring }),
    [mountedAt, delay, stagger, spring],
  );
  return (
    <EntranceContext.Provider value={entrance}>
      {children}
    </EntranceContext.Provider>
  );
}

/** One row of a `RiseInGroup`. Reduce Motion fades the rows in together. */
export function RiseIn({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  const entrance = useContext(EntranceContext);
  const reduceMotion = useReducedMotion();
  const [rises] = useState(
    () =>
      entrance !== null &&
      index < MAX_RISING &&
      Date.now() - entrance.mountedAt < FIRST_LOAD_WINDOW_MS,
  );
  const shown = useSharedValue(rises ? 0 : 1);
  const settled = useSharedValue(rises && !reduceMotion ? 0 : 1);

  useEffect(() => {
    if (!rises || !entrance) return;
    const delay = reduceMotion
      ? entrance.delay
      : entrance.delay + index * entrance.stagger;
    shown.set(withDelay(delay, withTiming(1, FADE)));
    if (!reduceMotion) {
      settled.set(
        withDelay(delay, withSpring(1, springs[entrance.spring])),
      );
    }
  }, [entrance, index, reduceMotion, rises, settled, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: RISE * (1 - settled.get()) }],
  }));

  if (!rises) return children;
  return <Animated.View style={style}>{children}</Animated.View>;
}
