import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';

import { AXIS_LABEL_OVERHANG, AXIS_WIDTH } from './pace-geometry';
import { xAt, type Frame, type Zoom } from './zoom';

/** Labels swap by cross-fading in place while the marks rescale under them. */
const TICK_SWAP_MS = 150;
export const LABEL_IN = FadeIn.duration(TICK_SWAP_MS);
export const LABEL_OUT = FadeOut.duration(TICK_SWAP_MS);

/** A y label on a fixed row of the plot, in pixels. */
export type AxisRow = { y: number; text: string };

/** An x label anchored to a day position, in days from the index's first day. */
export type TickMark = { u: number; label: string };

const TICK_WIDTH = 60;
/** Any tick this close to Today hides (tokens.md Charts). */
const TODAY_CLEARANCE = 52;
/** A tick fades over this many pixels as it nears Today or leaves the plot. */
const TICK_FADE = 8;

/** The y labels at their target values. A changed label fades out as its replacement fades in. */
export function YLabels({ rows, fit = false }: { rows: readonly AxisRow[]; fit?: boolean }) {
  return (
    <LayoutAnimationConfig skipEntering>
      {rows.map((row) => (
        <Animated.View
          key={`${row.y}:${row.text}`}
          entering={LABEL_IN}
          exiting={LABEL_OUT}
          pointerEvents="none"
          className="absolute"
          style={{
            left: -AXIS_LABEL_OVERHANG,
            width: AXIS_WIDTH + AXIS_LABEL_OVERHANG,
            top: row.y - 8,
          }}
        >
          <Text
            variant="smallest"
            numberOfLines={1}
            adjustsFontSizeToFit={fit}
            className="text-right text-muted"
          >
            {row.text}
          </Text>
        </Animated.View>
      ))}
    </LayoutAnimationConfig>
  );
}

const tickKey = (tick: TickMark) => `${tick.u}:${tick.label}`;

/**
 * Ticks the target dropped, kept mounted until their fade ends so they keep sliding with their
 * date; a layout `exiting` animation would freeze them where they were.
 */
function useLeavingTicks(ticks: readonly TickMark[]): TickMark[] {
  const [leaving, setLeaving] = useState<TickMark[]>([]);
  const previous = useRef(ticks);
  useEffect(() => {
    const kept = new Set(ticks.map(tickKey));
    const dropped = previous.current.filter((tick) => !kept.has(tickKey(tick)));
    previous.current = ticks;
    const droppedKeys = new Set(dropped.map(tickKey));
    setLeaving((current) => [
      ...current.filter((tick) => !kept.has(tickKey(tick)) && !droppedKeys.has(tickKey(tick))),
      ...dropped,
    ]);
    if (dropped.length)
      setTimeout(
        () => setLeaving((current) => current.filter((tick) => !droppedKeys.has(tickKey(tick)))),
        TICK_SWAP_MS,
      );
  }, [ticks]);
  const kept = new Set(ticks.map(tickKey));
  return leaving.filter((tick) => !kept.has(tickKey(tick)));
}

/**
 * The x axis: each tick slides with its date as the chart zooms, the target range's set fades in
 * and the old set fades out, and Today stays bold where today is.
 */
export function ZoomTicks({
  ticks,
  todayU,
  zoom,
  frame,
  width,
}: {
  ticks: readonly TickMark[];
  todayU: number;
  zoom: Zoom;
  frame: Frame;
  width: number;
}) {
  const leaving = useLeavingTicks(ticks);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const shared = { todayU, zoom, frame, width, appear: mounted.current };
  return (
    <View style={{ height: 16 }}>
      {ticks.map((tick) => (
        <Tick
          key={tickKey(tick)}
          u={tick.u}
          label={tick.label}
          leaving={false}
          {...shared}
        />
      ))}
      {leaving.map((tick) => (
        <Tick
          key={tickKey(tick)}
          u={tick.u}
          label={tick.label}
          leaving
          {...shared}
        />
      ))}
      <Tick
        key="today"
        u={todayU}
        label="Today"
        leaving={false}
        {...shared}
        todayU={null}
      />
    </View>
  );
}

function Tick({
  u,
  label,
  leaving,
  appear,
  todayU,
  zoom,
  frame,
  width,
}: {
  u: number;
  label: string;
  leaving: boolean;
  /** Fades in on mount; false for the ticks shown when the chart first appears. */
  appear: boolean;
  /** Null for the Today tick itself. */
  todayU: number | null;
  zoom: Zoom;
  frame: Frame;
  width: number;
}) {
  const { from, to } = zoom;
  const shown = useSharedValue(appear ? 0 : 1);
  useEffect(() => {
    shown.set(withTiming(leaving ? 0 : 1, { duration: TICK_SWAP_MS }));
  }, [leaving, shown]);
  const place = useAnimatedStyle(() => {
    const x = xAt(u, from.get(), to.get(), frame);
    const outside = Math.max(frame.left - x, x - frame.right, 0);
    let opacity = shown.get() * Math.max(0, 1 - outside / TICK_FADE);
    if (todayU !== null) {
      const gap = Math.abs(x - xAt(todayU, from.get(), to.get(), frame));
      opacity *= Math.max(0, Math.min(1, (gap - TODAY_CLEARANCE) / TICK_FADE));
    }
    return {
      opacity,
      transform: [
        {
          translateX: Math.max(
            AXIS_WIDTH - 4,
            Math.min(width - TICK_WIDTH, x - TICK_WIDTH / 2),
          ),
        },
      ],
    };
  });
  return (
    <Animated.View
      className="absolute left-0 top-0"
      style={[{ width: TICK_WIDTH }, place]}
    >
      <Text
        variant="smallest"
        numberOfLines={1}
        className={`text-center ${todayU === null ? 'font-display-bold text-foreground' : 'text-muted'}`}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
