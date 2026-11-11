import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { glidePickUp, glideSnap, scrubStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid, type Screen } from '@/lib/test-ids';

const INSET = 4;
const REDUCED_FADE = { duration: 180 };
/** A hold this long lets the finger glide the pill in any direction. */
const HOLD_MS = 220;
/** Sideways travel that starts a glide straight away; more vertical travel leaves the page scrolling. */
const SLIDE_START_PX = 8;
const SCROLL_WINS_PX = 12;
/** Past either end the pill gives at this fraction of the finger's travel, and never more than `EDGE_GIVE`. */
const EDGE_RESISTANCE = 0.12;
const EDGE_GIVE = 0.06;
/** How hard each option holds the pill: it stays near an option, then jumps across the midpoint. */
const MAGNET = 2.6;
/** The held pill grows this much; at full speed it stretches this much wider and flatter. */
const HELD_GROWTH = 0.05;
const MAX_STRETCH = 0.18;
const STRETCH_SPEED = 2400;
/** Seconds of the release velocity the landing carries forward. */
const FLICK_CARRY_S = 0.02;

type SegmentedProps<T extends string> = {
  screen: Screen;
  name: string;
  /** An icon draws 18 before its label, 6 apart (V2H-Profile Appearance). */
  options: readonly {
    value: T;
    label: string;
    icon?: IconSymbolName;
  }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /** `medium` is the 48 track with 15/600 labels (V2H-Profile, V2H-Login). `compact` is 36 with 12/600 labels. */
  size?: 'default' | 'medium' | 'compact';
  /** Fixed segment width, for a control that sits beside a title instead of filling its row (chart cards). */
  segmentWidth?: number;
};

const sizes = {
  default: {
    track: 'h-11',
    pill: 'h-9',
    corners: 18,
    label: 'text-[14px] leading-[19px]',
  },
  medium: {
    track: 'h-12',
    pill: 'h-10',
    corners: 20,
    label: 'text-[15px] leading-[21px]',
  },
  compact: {
    track: 'h-9',
    pill: 'h-7',
    corners: 14,
    label: 'text-[12px] leading-4',
  },
} as const;

/** Where a finger at `x` puts the pill, in segments: pulled toward the nearest option, and held hard at either end. */
function positionAt(x: number, segment: number, last: number) {
  'worklet';
  const raw = (x - INSET - segment / 2) / segment;
  if (raw < 0) return -Math.min(-raw * EDGE_RESISTANCE, EDGE_GIVE);
  if (raw > last) return last + Math.min((raw - last) * EDGE_RESISTANCE, EDGE_GIVE);
  const near = Math.round(raw);
  const off = raw - near;
  return near + Math.sign(off) * 0.5 * Math.pow(Math.abs(off) * 2, MAGNET);
}

/**
 * One of a few options, on a Sand track with a sliding pill. Tap an option, or glide the pill:
 * slide sideways along the track, or hold it and move any way. The held pill grows a little and
 * stretches with the finger's speed, each label turns as the pill passes under it, each new
 * option ticks once, and on release the pill springs to the option the finger was heading for.
 */
export function Segmented<T extends string>({
  screen,
  name,
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  size = 'default',
  segmentWidth,
}: SegmentedProps<T>) {
  const look = sizes[size];
  const last = options.length - 1;
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const reduceMotion = useReducedMotion();
  const position = useSharedValue(index);
  // React state, not a shared value: the style is rebuilt when the track is measured, so the
  // pill draws under the selected option on the first frame instead of after its first move.
  const [measured, setMeasured] = useState(0);
  const segment = segmentWidth ?? measured;
  const shown = useSharedValue(1);
  const held = useSharedValue(0);
  const stretch = useSharedValue(0);
  const gliding = useSharedValue(false);

  const heading = useRef(index);

  const slideTo = (next: number) => {
    if (heading.current === next) return;
    heading.current = next;
    if (reduceMotion) {
      // V2F-Motion: under Reduce Motion the pill cross-fades between options in 180.
      position.set(next);
      shown.set(0);
      shown.set(withTiming(1, REDUCED_FADE));
      return;
    }
    position.set(withSpring(next, springs.control));
  };

  // Follows a value changed from outside. A tap slides in its own handler, and a glide springs
  // on the UI thread, so the pill never waits for the render its `onChange` causes.
  useEffect(() => slideTo(index));

  const latest = useRef({ options, onChange, index });
  latest.current = { options, onChange, index };
  const commit = (next: number) => {
    heading.current = next;
    const { options: now, onChange: change, index: current } = latest.current;
    if (next !== current) change(now[next].value);
  };

  // One tick per option the gliding pill reaches, on the frame it gets there.
  useAnimatedReaction(
    () => (gliding.get() ? Math.round(position.get()) : null),
    (reached, before) => {
      if (reached !== null && before !== null && reached !== before) {
        scheduleOnRN(scrubStep);
      }
    },
  );

  const glide = useMemo(() => {
    const start = (x: number) => {
      'worklet';
      gliding.set(true);
      const at = positionAt(x, segment, last);
      if (reduceMotion) {
        position.set(at);
        return;
      }
      held.set(withSpring(1, springs.press));
      position.set(withSpring(at, springs.press));
      scheduleOnRN(glidePickUp);
    };
    const follow = (x: number, velocityX: number) => {
      'worklet';
      const at = positionAt(x, segment, last);
      // A stiff spring, not 1:1: the magnet's jump across a midpoint lands as a snap, not a teleport.
      position.set(reduceMotion ? at : withSpring(at, springs.press));
      if (!reduceMotion) {
        stretch.set(Math.min(Math.abs(velocityX) / STRETCH_SPEED, 1) * MAX_STRETCH);
      }
    };
    const release = (velocityX: number) => {
      'worklet';
      gliding.set(false);
      // A light carry: the magnet decides most landings, and only a real flick moves one option on.
      const aim = position.get() + (velocityX / segment) * FLICK_CARRY_S;
      const target = Math.min(Math.max(Math.round(aim), 0), last);
      held.set(withSpring(0, springs.control));
      stretch.set(withSpring(0, springs.control));
      position.set(
        reduceMotion
          ? withTiming(target, REDUCED_FADE)
          : withSpring(target, {
              ...springs.control,
              velocity: velocityX / segment,
              overshootClamping: true,
            }),
      );
      scheduleOnRN(glideSnap);
      scheduleOnRN(commit, target);
    };
    const settle = () => {
      'worklet';
      if (!gliding.get()) return;
      release(0);
    };
    const enabled = !disabled && segment > 0 && options.length > 1;
    const slide = Gesture.Pan()
      .withTestId(`${screen}.${name}.glide`)
      .enabled(enabled)
      .activeOffsetX([-SLIDE_START_PX, SLIDE_START_PX])
      .failOffsetY([-SCROLL_WINS_PX, SCROLL_WINS_PX])
      .onStart((event) => start(event.x))
      .onUpdate((event) => follow(event.x, event.velocityX))
      .onEnd((event) => release(event.velocityX))
      .onFinalize(settle);
    const hold = Gesture.Pan()
      .withTestId(`${screen}.${name}.hold`)
      .enabled(enabled)
      .activateAfterLongPress(HOLD_MS)
      .onStart((event) => start(event.x))
      .onUpdate((event) => follow(event.x, event.velocityX))
      .onEnd((event) => release(event.velocityX))
      .onFinalize(settle);
    return Gesture.Race(hold, slide);
    // commit reads the latest props through a ref, so the gesture only rebuilds when its geometry does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, segment, last, options.length, reduceMotion, screen, name]);

  const pill = useAnimatedStyle(() => {
    const grow = held.get() * HELD_GROWTH;
    const wide = segment * (1 + stretch.get());
    // The pill never leaves the track: its stretched edges stop at the track's inner ends.
    const left = Math.min(
      Math.max(position.get() * segment - (wide - segment) / 2, 0),
      segment * options.length - wide,
    );
    return {
      opacity: shown.get(),
      width: wide,
      transform: [
        { translateX: left },
        { scale: 1 + grow },
        { scaleY: 1 - stretch.get() * 0.35 },
      ],
    };
  }, [segment, options.length]);

  return (
    <GestureDetector gesture={glide}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        className={`${look.track} flex-row rounded-full p-1 ${disabled ? 'bg-sand-light' : 'bg-sand'}`}
        style={
          segmentWidth === undefined
            ? undefined
            : { width: segmentWidth * options.length + INSET * 2 }
        }
        onLayout={
          segmentWidth === undefined
            ? (event) =>
                setMeasured(
                  (event.nativeEvent.layout.width - INSET * 2) /
                    options.length,
                )
            : undefined
        }
      >
        <Animated.View
          testID={tid(screen, name, 'pill')}
          pointerEvents="none"
          className={`absolute left-1 top-1 ${look.pill} rounded-full ${disabled ? 'bg-hairline' : 'bg-primary'}`}
          style={pill}
        />
        {options.map((option, optionIndex) => {
          const selected = option.value === value;
          return (
            <Press
              key={option.value}
              testID={tid(screen, name, option.value)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              hitSlop={size === 'compact' ? { top: 8, bottom: 8 } : undefined}
              pressedClassName="bg-transparent"
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full"
              onPress={() => {
                if (selected) return;
                scrubStep();
                slideTo(optionIndex);
                onChange(option.value);
              }}
            >
              <OptionFace
                option={option}
                index={optionIndex}
                position={position}
                labelClass={look.label}
                disabled={disabled}
              />
            </Press>
          );
        })}
      </View>
    </GestureDetector>
  );
}

/** The pill carries the colour: a label turns as the pill reaches it, not when the value changes. */
function OptionFace({
  option,
  index,
  position,
  labelClass,
  disabled,
}: {
  option: { label: string; icon?: IconSymbolName };
  index: number;
  position: SharedValue<number>;
  labelClass: string;
  disabled: boolean;
}) {
  const tokens = useThemeTokens();
  const rest = disabled ? tokens.muted : tokens.foreground;
  const onPill = disabled ? tokens.muted : tokens.primaryForeground;
  const under = useDerivedValue(() =>
    Math.max(0, 1 - Math.abs(position.get() - index)),
  );
  const label = useAnimatedStyle(() => ({
    color: interpolateColor(under.get(), [0, 1], [rest, onPill]),
  }));
  const iconOnPill = useAnimatedStyle(() => ({ opacity: under.get() }));
  return (
    <>
      {option.icon ? (
        <View>
          <IconSymbol name={option.icon} size={18} color={rest} />
          <Animated.View className="absolute inset-0" style={iconOnPill}>
            <IconSymbol name={option.icon} size={18} color={onPill} />
          </Animated.View>
        </View>
      ) : null}
      <Animated.Text
        className={`${labelClass} font-display-semibold`}
        style={label}
        numberOfLines={1}
      >
        {option.label}
      </Animated.Text>
    </>
  );
}
