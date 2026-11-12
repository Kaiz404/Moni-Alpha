import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useWindowDimensions, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, type ComposedGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { holdCommit, thresholdOff, thresholdOn, toggleOff } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';

import { useOnInk } from './ink-card';

const HOLD_MS = 250;
/** A finger that moved this far was sliding, so lifting it is not a tap. */
const TAP_SLOP = 16;
const MIC_SIZE = 44;
/** The composer's px-3 on each side of the page. */
const PAGE_MARGIN = 12;
/** From the composer's outer edge to the mic's centre: the 1.5 border, px-1, half the mic. */
const MIC_INSET_X = 27.5;
/** The same, up from the bottom edge: the 1.5 border, py-[2.5px], half the mic. */
const MIC_INSET_Y = 26;
/** How near the trash's centre an armed mic waits, so the trash stays in sight beside it. */
const TRASH_GAP = 52;
const CANCEL_SHARE = 0.55;
const REARM_PX = 16;

const FLY_MS = 140;
/** Long enough for the capsule's content to have faded before the mic is put back home. */
const REST_MS = 130;
const STRONG_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const FLY = { duration: FLY_MS, easing: STRONG_OUT };
const RETURN = { duration: 120, easing: STRONG_OUT };
const INSTANT = { duration: 0 };
// Never: Reduce Motion asks for this fade in place of the sweep, and System would skip it too.
const REDUCED_FADE = { duration: 150, reduceMotion: ReduceMotion.Never };
/** Clamped so the collapse ends the moment it arrives and the composer can take over. */
const COLLAPSE = { ...springs.sheet, overshootClamping: true };

export type MicGeometry = {
  /** Slide at which the mic's centre meets the trash's. */
  trash: number;
  /** The furthest a held mic goes. */
  stop: number;
  cancelAt: number;
  rearmAt: number;
  /** Of the capsule's circle: more than any composer's far corner, so full size always covers it. */
  radius: number;
};

export function micGeometry(windowWidth: number): MicGeometry {
  const trash = windowWidth - 2 * PAGE_MARGIN - 2 * MIC_INSET_X;
  const stop = trash - TRASH_GAP;
  const cancelAt = Math.round(stop * CANCEL_SHARE);
  return { trash, stop, cancelAt, rearmAt: cancelAt - REARM_PX, radius: windowWidth };
}

/** How far left of home the finger has taken the mic. */
export function slideOf(translationX: number, stop: number): number {
  'worklet';
  return Math.min(Math.max(-translationX, 0), stop);
}

/** The gap between the two numbers stops a jittering finger from flipping this. */
export function nextArmed(armed: boolean, slide: number, geometry: MicGeometry): boolean {
  'worklet';
  return armed ? slide > geometry.rearmAt : slide >= geometry.cancelAt;
}

function unit(value: number): number {
  'worklet';
  return Math.min(Math.max(value, 0), 1);
}

/** 0 at `from`, 1 at `to`, and held at those ends. */
function ramp(value: number, from: number, to: number): number {
  'worklet';
  return unit((value - from) / (to - from));
}

function lerp(from: number, to: number, share: number): number {
  'worklet';
  return from + (to - from) * share;
}

type MicMotion = {
  /** 0 is the mic, 1 is the whole black capsule. */
  reveal: SharedValue<number>;
  slide: SharedValue<number>;
  armed: SharedValue<boolean>;
  /** Follows `armed`, and pulls the mic to the trash. */
  snap: SharedValue<number>;
  /** 1 once a cancelled mic has reached the trash. */
  fly: SharedValue<number>;
  /** 1 once a cancelled mic has vanished into the trash. */
  gone: SharedValue<number>;
};

export type MicHold = { gesture: ComposedGesture; motion: MicMotion; geometry: MicGeometry; reduced: boolean };

/**
 * A tap, or a hold that slides on the UI thread. Letting go decides from the release's own position,
 * so a slide and a release in one frame can't send, and an interrupted hold never sends.
 */
export function useMicHold(handlers: {
  onTap: () => void;
  onHoldStart: () => void;
  onRelease: (cancelled: boolean) => void;
  /** The capsule has finished collapsing into the mic. */
  onSettled: () => void;
}): MicHold {
  const { width } = useWindowDimensions();
  const geometry = useMemo(() => micGeometry(width), [width]);
  const reduced = useReducedMotion();
  const reveal = useSharedValue(0);
  const slide = useSharedValue(0);
  const armed = useSharedValue(false);
  const snap = useSharedValue(0);
  const fly = useSharedValue(0);
  const gone = useSharedValue(0);
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  const gesture = useMemo(() => {
    const started = () => latest.current.onHoldStart();
    const released = (cancelled: boolean) => latest.current.onRelease(cancelled);
    const settledOnRN = () => latest.current.onSettled();
    const settled = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(settledOnRN);
    };
    const collapse = () => {
      'worklet';
      return reduced ? withTiming(0, REDUCED_FADE, settled) : withSpring(0, COLLAPSE, settled);
    };

    const hold = Gesture.Pan()
      .withTestId('chat.mic.hold')
      .activateAfterLongPress(HOLD_MS)
      .onStart(() => {
        slide.set(0);
        armed.set(false);
        snap.set(0);
        fly.set(0);
        gone.set(0);
        reveal.set(reduced ? withTiming(1, REDUCED_FADE) : withSpring(1, springs.sheet));
        scheduleOnRN(holdCommit);
        scheduleOnRN(started);
      })
      .onUpdate((event) => {
        const next = slideOf(event.translationX, geometry.stop);
        slide.set(next);
        const wasArmed = armed.get();
        const nowArmed = nextArmed(wasArmed, next, geometry);
        if (nowArmed === wasArmed) return;
        armed.set(nowArmed);
        snap.set(withSpring(nowArmed ? 1 : 0, springs.control));
        scheduleOnRN(nowArmed ? thresholdOn : thresholdOff);
      })
      .onEnd((event, success) => {
        const cancelled =
          !success || nextArmed(armed.get(), slideOf(event.translationX, geometry.stop), geometry);
        armed.set(false);
        scheduleOnRN(released, cancelled);
        if (!cancelled) {
          scheduleOnRN(toggleOff);
          // Only toward home: a finger still moving left must not hold up the collapse behind it.
          slide.set(withSpring(0, { ...COLLAPSE, velocity: Math.min(-event.velocityX, 0) }));
          reveal.set(collapse());
          return;
        }
        fly.set(withSequence(withTiming(1, FLY), withDelay(REST_MS, withTiming(0, INSTANT))));
        gone.set(withSequence(withTiming(1, FLY), withDelay(REST_MS, withTiming(0, RETURN))));
        slide.set(withDelay(FLY_MS + REST_MS, withTiming(0, INSTANT)));
        snap.set(withDelay(FLY_MS + REST_MS, withTiming(0, INSTANT)));
        reveal.set(reduced ? collapse() : withDelay(FLY_MS, collapse()));
      });
    const tap = Gesture.Tap()
      .withTestId('chat.mic.tap')
      .runOnJS(true)
      .maxDistance(TAP_SLOP)
      .onEnd((_event, success) => {
        if (success) latest.current.onTap();
      });
    return Gesture.Exclusive(hold, tap);
  }, [geometry, reduced, reveal, slide, armed, snap, fly, gone]);

  return {
    gesture,
    motion: { reveal, slide, armed, snap, fly, gone },
    geometry,
    reduced,
  };
}

/** A ring behind the held mic, swelling with your voice. The outer one reaches further. */
function MicRing({
  reach,
  level,
  snap,
  className,
}: {
  reach: number;
  level: SharedValue<number>;
  snap: SharedValue<number>;
  className: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - snap.get(),
    transform: [{ scale: 1.1 + reach * level.get() }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      className={`absolute inset-0 rounded-full ${className}`}
      style={style}
    />
  );
}

/**
 * The mic stays mounted while held, because the gesture ends with its view. Fills and glyphs are
 * stacked and crossfaded, so nothing here waits for a React render during a hold.
 */
export function MicButton({
  hold,
  holding,
  level,
  onTap,
}: {
  hold: MicHold;
  holding: boolean;
  level: SharedValue<number>;
  onTap: () => void;
}) {
  const tokens = useThemeTokens();
  const { reveal, slide, snap, fly, gone } = hold.motion;
  const { geometry, reduced } = hold;

  const button = useAnimatedStyle(() => {
    const waiting = lerp(slide.get(), geometry.stop, reduced ? 0 : snap.get());
    const vanished = gone.get();
    const grown = reduced ? 1 : 1 + 0.12 * ramp(reveal.get(), 0, 0.6);
    return {
      opacity: 1 - vanished,
      transform: [
        { translateX: -lerp(waiting, geometry.trash, fly.get()) },
        { scale: grown * (1 - 0.6 * vanished) },
      ],
    };
  });
  const held = useAnimatedStyle(() => ({
    opacity: ramp(reveal.get(), 0, 0.35),
  }));
  const coral = useAnimatedStyle(() => ({ opacity: snap.get() }));

  return (
    <GestureDetector gesture={hold.gesture}>
      <Animated.View
        testID={tid('chat', 'mic')}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Talk to Moni"
        accessibilityHint="Or hold to talk, and let go to send"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') onTap();
        }}
        onAccessibilityTap={onTap}
        className="h-11 w-11 items-center justify-center rounded-full bg-primary"
        style={button}
      >
        {holding ? (
          <>
            <MicRing
              reach={1.1}
              level={level}
              snap={snap}
              className="bg-mint-key/20"
            />
            <MicRing
              reach={0.55}
              level={level}
              snap={snap}
              className="bg-mint-key/35"
            />
          </>
        ) : null}
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 rounded-full bg-mint-key"
          style={held}
        />
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 rounded-full bg-coral"
          style={coral}
        />
        <IconSymbol
          name="microphone-outline"
          size={20}
          color={tokens.primaryForeground}
        />
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center"
          style={held}
        >
          <IconSymbol
            name="microphone-outline"
            size={20}
            color={tokens.onMintKey}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const GLYPH = 24;
/** Where the lid of `trash-can-outline` meets its body, and the hinge at the lid's left end. */
const LID_HEIGHT = 6;
const LID_HINGE_X = 4;

/** The can's own glyph cut in two along its lid, so the lid can tip open. */
function TrashGlyph({
  color,
  lid,
}: {
  color: string;
  lid: AnimatedStyle<ViewStyle>;
}) {
  return (
    <View style={{ width: GLYPH, height: GLYPH }}>
      <Animated.View
        style={[
          { height: LID_HEIGHT, overflow: 'hidden', transformOrigin: [LID_HINGE_X, LID_HEIGHT, 0] },
          lid,
        ]}
      >
        <IconSymbol
          name="trash-can-outline"
          size={GLYPH}
          color={color}
        />
      </Animated.View>
      <View style={{ height: GLYPH - LID_HEIGHT, overflow: 'hidden' }}>
        <IconSymbol
          name="trash-can-outline"
          size={GLYPH}
          color={color}
          style={{ marginTop: -LID_HEIGHT }}
        />
      </View>
    </View>
  );
}

/** Grows, tints Coral and tips its lid as the mic comes near, and shuts on the mic it swallows. */
function Trash({ hold }: { hold: MicHold }) {
  const tokens = useThemeTokens();
  const onInk = useOnInk();
  const { reveal, slide, snap, gone } = hold.motion;
  const { geometry, reduced } = hold;

  const near = () => {
    'worklet';
    return Math.max(ramp(slide.get(), geometry.cancelAt * 0.4, geometry.cancelAt) ** 2, snap.get());
  };

  const can = useAnimatedStyle(() => {
    const landed = Math.sin(Math.PI * gone.get());
    return {
      opacity: ramp(reveal.get(), 0.55, 1),
      transform: [{ scale: reduced ? 1 : 1 + 0.3 * near() + 0.15 * landed }],
    };
  });
  const tinted = useAnimatedStyle(() => ({ opacity: near() }));
  const lid = useAnimatedStyle(() => ({
    transform: [{ rotate: `${reduced ? 0 : -28 * near() * (1 - gone.get())}deg` }],
  }));

  return (
    <Animated.View
      aria-hidden
      className="absolute h-11 w-11 items-center justify-center"
      style={[{ left: MIC_INSET_X - MIC_SIZE / 2, bottom: MIC_INSET_Y - MIC_SIZE / 2 }, can]}
    >
      <Animated.View
        className="absolute inset-0 rounded-full bg-coral/25"
        style={tinted}
      />
      <TrashGlyph
        color={onInk.metaGlyph}
        lid={lid}
      />
      <Animated.View
        className="absolute items-center justify-center"
        style={tinted}
      >
        <TrashGlyph
          color={tokens.onCategory}
          lid={lid}
        />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The black capsule, grown out of the mic: a circle under `overflow-hidden`, scaled from the mic's
 * size. Only a transform moves, so the composer under it never lays out again. It stays mounted so
 * that the sweep starts in the gesture's own frame, before React has heard about the hold.
 */
export function HeldCapsule({ hold, children }: { hold: MicHold; children: ReactNode }) {
  const { reveal, slide } = hold.motion;
  const { geometry, reduced } = hold;
  const { radius } = geometry;

  const circle = useAnimatedStyle(() => {
    const open = reveal.get();
    return reduced
      ? { opacity: open }
      : {
          opacity: open > 0.001 ? 1 : 0,
          transform: [{ scale: lerp(MIC_SIZE / (2 * radius), 1, open) }],
        };
  });
  const content = useAnimatedStyle(() => ({
    opacity: ramp(reveal.get(), 0.55, 1) * (1 - ramp(slide.get(), 0, geometry.cancelAt * 0.7)),
  }));

  return (
    <View
      pointerEvents="none"
      className="absolute overflow-hidden rounded-[26px]"
      style={{ top: -1.5, right: -1.5, bottom: -1.5, left: -1.5 }}
    >
      <Animated.View
        className="absolute bg-primary"
        style={[
          {
            width: 2 * radius,
            height: 2 * radius,
            borderRadius: radius,
            right: MIC_INSET_X - radius,
            bottom: MIC_INSET_Y - radius,
          },
          circle,
        ]}
      />
      <Trash hold={hold} />
      <Animated.View
        className="absolute bottom-0 left-0 right-0 h-[52px] flex-row items-center gap-3 pl-[52px] pr-[60px]"
        style={content}
      >
        {children}
      </Animated.View>
    </View>
  );
}
