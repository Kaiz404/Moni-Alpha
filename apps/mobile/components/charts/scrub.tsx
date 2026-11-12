import { useMemo, useRef, type ReactNode } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { chartStep } from '@/lib/haptics';

import { uAt, xAt, type Frame, type Zoom } from './zoom';

/**
 * The points a scrub lands on, left to right. `at` is where each sits on the x axis, in the
 * zoom's data space; `ids` is what it reads: a day, or a bar's bucket.
 */
/**
 * Every day (or bar) the tooltip can stop on, in order. `marks` flags the ones with transactions:
 * the tooltip moves through every point, and ticks only on marked ones.
 */
export type ScrubPoints = { at: Float64Array; ids: Float64Array; marks: Uint8Array };

/** Points closer than this on screen play the frequent tick. */
export const DENSE_POINT_PX = 8;
const HOLD_MS = 200;
/** A finger this far up or down is scrolling the page. */
const SCROLL_PX = 12;

const TIP_IN = FadeIn.duration(100);
const TIP_OUT = FadeOut.duration(150);

export function scrubPoints(
  points: readonly (readonly [at: number, id: number, marked: boolean])[],
): ScrubPoints {
  return {
    at: Float64Array.from(points, ([at]) => at),
    ids: Float64Array.from(points, ([, id]) => id),
    marks: Uint8Array.from(points, ([, , marked]) => (marked ? 1 : 0)),
  };
}

/**
 * The next stop for a screen reader from `selected`, `by` one way or the other: only the points
 * with transactions and the last one, so stepping through a year is not 365 swipes. Null past
 * either end.
 */
export function readerStep({ ids, marks }: ScrubPoints, selected: number, by: 1 | -1): number | null {
  const last = ids.length - 1;
  for (let i = ids.indexOf(selected) + by; i >= 0 && i <= last; i += by) {
    if (marks[i] === 1 || i === last) return ids[i]!;
  }
  return null;
}

/** The point nearest `u`, by binary search; a tie goes left. `at` is ascending and not empty. */
export function nearestPoint(at: Float64Array, u: number): number {
  'worklet';
  let low = 0;
  let high = at.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (at[middle]! < u) low = middle + 1;
    else high = middle;
  }
  return low > 0 && u - at[low - 1]! <= at[low]! - u ? low - 1 : low;
}

/**
 * The scrub on a zooming chart. The tooltip shows the moment a finger lands and snaps to the
 * nearest point on the live viewport, so it works mid-zoom. A sideways drag, or a 200 ms hold and
 * then any direction, keeps it following the finger; a vertical swipe hands the page its scroll
 * and hides it at once. `point` (an index into `points`) moves on the UI thread; React hears only
 * when it changes, with one haptic each time, and once more with null when the finger lets go.
 */
export function useChartScrub({
  testID,
  points,
  zoom: { from, to },
  frame,
  onPoint,
}: {
  testID: string;
  points: ScrubPoints;
  zoom: Zoom;
  frame: Frame;
  onPoint: (id: number | null) => void;
}): { gesture: ReturnType<typeof Gesture.Race>; point: SharedValue<number>; shown: SharedValue<number> } {
  const point = useSharedValue(points.at.length - 1);
  const shown = useSharedValue(0);
  const holding = useSharedValue(false);
  const reachedU = useSharedValue(NaN);
  const latest = useRef(onPoint);
  latest.current = onPoint;
  const reach = (id: number, tick: boolean, dense: boolean) => {
    if (tick) chartStep(dense);
    latest.current(id);
  };
  const lift = () => latest.current(null);

  const gesture = useMemo(() => {
    const { at, ids, marks } = points;
    const move = (x: number, first: boolean) => {
      'worklet';
      const f = from.get();
      const t = to.get();
      const next = nearestPoint(at, uAt(x, f, t, frame));
      // Compared by position, not index, so a target rebuilt mid-touch still counts one change.
      const before = reachedU.get();
      if (!first && at[next] === before) return;
      point.set(next);
      reachedU.set(at[next]!);
      if (first) {
        scheduleOnRN(reach, ids[next]!, true, false);
        return;
      }
      // One touch update a frame, so at most one haptic a frame: it plays when the finger
      // reached or passed a day with transactions, and is the frequent tick when those days
      // sit closer than DENSE_POINT_PX on screen.
      const was = nearestPoint(at, before);
      const low = Math.min(was, next);
      const high = Math.max(was, next);
      let crossed = 0;
      for (let i = low; i <= high; i++) if (i !== was && marks[i] === 1) crossed++;
      const travel = Math.abs(xAt(at[next]!, f, t, frame) - xAt(before, f, t, frame));
      scheduleOnRN(reach, ids[next]!, crossed > 0, crossed > 0 && travel / crossed < DENSE_POINT_PX);
    };
    const end = (scrolled: boolean) => {
      'worklet';
      // A scroll takes the tooltip away at once; a lift lets it fade.
      if (scrolled) shown.set(0);
      scheduleOnRN(lift);
    };
    const drag = Gesture.Pan()
      .withTestId(`${testID}.drag`)
      .activeOffsetX([-6, 6])
      .failOffsetY([-SCROLL_PX, SCROLL_PX])
      .onBegin((event) => {
        shown.set(1);
        move(event.x, true);
      })
      .onUpdate((event) => move(event.x, false))
      .onFinalize((event) => {
        if (!holding.get()) end(Math.abs(event.translationY) >= SCROLL_PX);
      });
    const hold = Gesture.Pan()
      .withTestId(`${testID}.hold`)
      .activateAfterLongPress(HOLD_MS)
      .onStart((event) => {
        holding.set(true);
        move(event.x, false);
      })
      .onUpdate((event) => move(event.x, false))
      .onFinalize(() => {
        if (!holding.get()) return;
        holding.set(false);
        end(false);
      });
    return Gesture.Race(hold, drag);
  }, [points, from, to, frame, point, shown, holding, reachedU, testID]);

  return { gesture, point, shown };
}

/**
 * Mounts the tooltip's parts while a finger is down: in quickly, out over 150 ms. `shown` drops
 * to 0 on a scroll, so the fade-out never flashes it back.
 */
export function Tip({ shown, children }: { shown: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return (
    <Animated.View
      entering={TIP_IN}
      exiting={TIP_OUT}
      pointerEvents="none"
      className="absolute inset-0"
    >
      <Animated.View
        className="absolute inset-0"
        style={style}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}
