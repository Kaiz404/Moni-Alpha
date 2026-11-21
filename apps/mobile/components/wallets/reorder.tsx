import { createContext, use, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
  measure,
  scrollTo,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { reorderSlot } from '@repo/core';
import { springs } from '@repo/design';
import { glideSnap, holdCommit, scrubStep } from '@/lib/haptics';

/** XW-WalletCards-Reorder: hold this long to lift a card; moving first scrolls the strip instead. */
const HOLD_MS = 500;
/** Within this much of the strip's edge the strip scrolls under the lifted card. */
const EDGE_ZONE = 56;
const SETTLE = { duration: 180 };
const SHADOW = 'rgba(23,24,26,';

/** The horizontal strip a lifted card can scroll, and where its group sits in that strip's content. */
export type EdgeScroll = {
  ref: AnimatedRef<Animated.ScrollView>;
  offset: SharedValue<number>;
  /** The group's start and end in the strip's content, and the content's width. */
  start: number;
  end: number;
  contentWidth: number;
  /** Padding kept past the group's ends when the strip stops at a divider. */
  pad: number;
};

type Options = {
  ids: readonly string[];
  /** Slot length along the axis: an item and the gap after it. */
  step: number;
  axis: 'x' | 'y';
  /** `hold`: the whole item lifts after a 500 ms hold. `handle`: a drag on its handle moves it at once. */
  start: 'hold' | 'handle';
  /** Lifted scale; the others fade to 60% when `dim` is on. */
  liftScale: number;
  dim: boolean;
  /** A surface the lifted item takes, rounded 18, when it has none of its own (a list row). */
  liftColor?: string;
  gestureId: (id: string) => string;
  onMove: (order: string[]) => void;
  edge?: EdgeScroll;
};

type Reorder = Omit<Options, 'ids' | 'onMove' | 'edge'> & {
  order: SharedValue<string[]>;
  active: SharedValue<string | null>;
  lifted: SharedValue<string | null>;
  lift: SharedValue<number>;
  /** The lifted item's position along the axis, under the finger and then settling into its slot. */
  base: SharedValue<number>;
  reduceMotion: boolean;
  gesture: (id: string) => PanGesture;
};

function moved(order: readonly string[], from: number, to: number): string[] {
  'worklet';
  const next = order.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/**
 * One reorderable group: items sit in slots `step` apart, a lifted item follows the finger 1:1, and the
 * others slide into the gap on the sheet spring with a tick on each swap. A drop saves the new order.
 */
export function useReorder({ ids, onMove, edge, ...options }: Options): Reorder {
  const { step, axis, start, liftScale } = options;
  const reduceMotion = useReducedMotion();
  const order = useSharedValue<string[]>([...ids]);
  const active = useSharedValue<string | null>(null);
  const lifted = useSharedValue<string | null>(null);
  const lift = useSharedValue(0);
  const base = useSharedValue(0);
  const from = useSharedValue(0);
  const drag = useSharedValue(0);
  const shift = useSharedValue(0);
  const finger = useSharedValue(0);
  const box = useSharedValue({ left: 0, width: 0 });

  const key = ids.join('|');
  useEffect(() => {
    if (active.get() === null) order.set([...ids]);
    // `key` stands for `ids`, whose identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const latest = useRef(onMove);
  latest.current = onMove;
  const save = (next: string[]) => latest.current(next);

  const follow = () => {
    'worklet';
    const id = active.get();
    if (id === null) return;
    const count = order.get().length;
    const at = from.get();
    const offset = Math.min(Math.max(drag.get() + shift.get(), -at * step), (count - 1 - at) * step);
    base.set(at * step + offset);
    const target = reorderSlot(at, offset, step, count);
    const current = order.get().indexOf(id);
    if (target !== current) {
      order.set(moved(order.get(), current, target));
      scheduleOnRN(scrubStep);
    }
  };

  useFrameCallback((frame) => {
    if (!edge || active.get() === null) return;
    const { left, width } = box.get();
    if (width <= 0) return;
    const x = finger.get() - left;
    const pull = x < EDGE_ZONE ? -(1 - x / EDGE_ZONE) : x > width - EDGE_ZONE ? 1 - (width - x) / EDGE_ZONE : 0;
    if (pull === 0) return;
    const low = Math.max(0, edge.start - edge.pad);
    const high = Math.max(low, Math.min(edge.contentWidth - width, edge.end + edge.pad - width));
    const now = edge.offset.get();
    const seconds = (frame.timeSincePreviousFrame ?? 16) / 1000;
    const next = Math.min(Math.max(now + Math.max(-1, Math.min(1, pull)) * step * seconds, low), high);
    if (next === now) return;
    scrollTo(edge.ref, next, 0, false);
    shift.set(shift.get() + next - now);
    follow();
  }, true);

  const gesture = (id: string) => {
    const begin = (absolute: number) => {
      'worklet';
      if (edge) {
        const frame = measure(edge.ref);
        box.set(frame ? { left: frame.pageX, width: frame.width } : { left: 0, width: 0 });
      }
      active.set(id);
      lifted.set(id);
      from.set(order.get().indexOf(id));
      base.set(from.get() * step);
      drag.set(0);
      shift.set(0);
      finger.set(absolute);
      lift.set(reduceMotion ? 1 : withSpring(1, springs.press));
      scheduleOnRN(holdCommit);
    };
    const drop = () => {
      'worklet';
      if (active.get() !== id) return;
      active.set(null);
      const slot = order.get().indexOf(id) * step;
      const done = () => {
        'worklet';
        if (active.get() === null) lifted.set(null);
      };
      if (reduceMotion) {
        base.set(slot);
        lift.set(0);
        done();
      } else {
        base.set(withSpring(slot, springs.sheet, done));
        lift.set(withTiming(0, SETTLE));
      }
      scheduleOnRN(glideSnap);
      if (from.get() !== order.get().indexOf(id)) scheduleOnRN(save, order.get());
    };
    const pan = Gesture.Pan().withTestId(options.gestureId(id));
    const armed = start === 'hold' ? pan.activateAfterLongPress(HOLD_MS) : pan.minDistance(0);
    // `armed` is no longer a `Gesture.Pan()` chain, so the Babel plugin won't mark these: each says so itself.
    return armed
      .onStart((event) => {
        'worklet';
        begin(axis === 'x' ? event.absoluteX : event.absoluteY);
      })
      .onUpdate((event) => {
        'worklet';
        drag.set(axis === 'x' ? event.translationX : event.translationY);
        finger.set(axis === 'x' ? event.absoluteX : event.absoluteY);
        follow();
      })
      .onEnd(drop)
      .onFinalize(drop);
  };

  return { ...options, order, active, lifted, lift, base, reduceMotion, gesture };
}

const ItemGesture = createContext<PanGesture | null>(null);

/** One slot of a group, placed by its index in the live order. */
export function ReorderItem({
  reorder,
  id,
  index,
  children,
}: {
  reorder: Reorder;
  id: string;
  index: number;
  children: ReactNode;
}) {
  const { order, active, lifted, lift, base, step, axis, liftScale, dim, liftColor, reduceMotion } = reorder;
  const pos = useSharedValue(index * step);
  const fade = useSharedValue(1);
  useAnimatedReaction(
    () => order.get().indexOf(id),
    (now, before) => {
      if (now < 0 || now === before || before === null) return;
      pos.set(reduceMotion ? now * step : withSpring(now * step, springs.sheet));
    },
  );
  useAnimatedReaction(
    () => dim && active.get() !== null && lifted.get() !== id,
    (faded, before) => {
      if (faded !== before) fade.set(withTiming(faded ? 0.6 : 1, SETTLE));
    },
  );
  const style = useAnimatedStyle(() => {
    const mine = lifted.get() === id;
    const at = mine ? base.get() : pos.get();
    const raised = mine ? lift.get() : 0;
    const scale = reduceMotion ? 1 : 1 + raised * (liftScale - 1);
    return {
      opacity: fade.get(),
      zIndex: mine ? 2 : 0,
      ...(liftColor ? { borderRadius: 18, backgroundColor: mine ? liftColor : 'transparent' } : {}),
      boxShadow: `0 12px 32px ${SHADOW}${(0.22 * raised).toFixed(3)})`,
      transform: axis === 'x' ? [{ translateX: at }, { scale }] : [{ translateY: at }, { scale }],
    };
  });
  const gesture = useMemo(
    () => reorder.gesture(id),
    // The gesture's worklets read shared values; it only rebuilds when the slot geometry does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, step, axis, reduceMotion],
  );
  const item = (
    <Animated.View
      style={[{ position: 'absolute', left: 0, top: 0 }, axis === 'x' ? { bottom: 0 } : { right: 0 }, style]}
    >
      {children}
    </Animated.View>
  );
  if (reorder.start === 'handle') return <ItemGesture value={gesture}>{item}</ItemGesture>;
  return <GestureDetector gesture={gesture}>{item}</GestureDetector>;
}

/** The part of a `handle` item that drags it. */
export function ReorderHandle({ children }: { children: ReactNode }) {
  const gesture = use(ItemGesture);
  if (!gesture) return children;
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}
