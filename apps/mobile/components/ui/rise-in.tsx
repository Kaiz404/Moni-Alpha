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

type Arrival = 'rise' | 'fade' | 'none';

/**
 * One row of a `RiseInGroup`. On first load the first 6 rise; a row that
 * arrives later (the next page, new data) fades in alone with no rise, as
 * V2F-States draws older spends arriving. Reduce Motion fades the first
 * rows in together.
 */
export function RiseIn({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  const entrance = useContext(EntranceContext);
  const reduceMotion = useReducedMotion();
  const [arrival] = useState<Arrival>(() => {
    if (entrance === null) return 'none';
    if (Date.now() - entrance.mountedAt >= FIRST_LOAD_WINDOW_MS)
      return 'fade';
    return index < MAX_RISING ? 'rise' : 'none';
  });
  const rises = arrival === 'rise' && !reduceMotion;
  const shown = useSharedValue(arrival === 'none' ? 1 : 0);
  const settled = useSharedValue(rises ? 0 : 1);

  useEffect(() => {
    if (arrival === 'none' || !entrance) return;
    if (arrival === 'fade') {
      shown.set(withTiming(1, FADE));
      return;
    }
    const delay = reduceMotion
      ? entrance.delay
      : entrance.delay + index * entrance.stagger;
    shown.set(withDelay(delay, withTiming(1, FADE)));
    if (rises) {
      settled.set(
        withDelay(delay, withSpring(1, springs[entrance.spring])),
      );
    }
  }, [arrival, entrance, index, reduceMotion, rises, settled, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: RISE * (1 - settled.get()) }],
  }));

  if (arrival === 'none') return children;
  return <Animated.View style={style}>{children}</Animated.View>;
}
