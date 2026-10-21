import { useEffect, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { Text } from '@/components/ui/text';
import {
  FLING_COMMIT_THRESHOLD,
  projectedPosition,
  springs,
} from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';

const SCRIM = 'rgba(23,24,26,0.32)';
/** A large sheet stops 154 from the top of an 844 phone with a 48 inset. */
const LARGE_TOP_BELOW_INSET = 106;
const OFFSCREEN = 2000;
const REDUCED_FADE = { duration: 180 };

function rubberband(overshoot: number, dimension: number) {
  'worklet';
  const k = 0.55;
  return (
    (overshoot * dimension * k) /
    (dimension + k * Math.abs(overshoot))
  );
}

export type SheetProps = {
  /** False plays the exit, then calls `onExited`. */
  open: boolean;
  /** The user asked to close: scrim, close button, or a drag past the threshold. */
  onDismiss: () => void;
  onExited: () => void;
  title: string;
  note?: string;
  /** Pickers carry the 44 close; confirm sheets do not. */
  closeLabel?: string;
  /** `fit` grows with its content; `large` stops 154 from the top. */
  size: 'fit' | 'large';
  /** Pinned 56 actions, 20 from the sides and the bottom. */
  actions?: ReactNode;
  children?: ReactNode;
};

/** What the host hands every sheet: its lifecycle, not its content. */
export type SheetFrameProps = Pick<
  SheetProps,
  'open' | 'onDismiss' | 'onExited'
>;

/**
 * The one sheet surface from tokens.md: Cream, top radius 32, a 36 × 5
 * grabber, a 22/26 title, and a scrim over the page and the tab bar. It rises
 * on the `sheet` spring, follows the finger 1:1 from its header, and closes
 * when a release projects past 40% of its height.
 */
export function Sheet({
  open,
  onDismiss,
  onExited,
  title,
  note,
  closeLabel,
  size,
  actions,
  children,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const keyboard = useAnimatedKeyboard();
  const height = useSharedValue(0);
  const offset = useSharedValue(OFFSCREEN);
  const fade = useSharedValue(reduceMotion ? 0 : 1);
  const start = useSharedValue(0);
  const releaseVelocity = useSharedValue(0);
  const closing = useSharedValue(false);

  useEffect(() => {
    if (open) return;
    closing.set(true);
    if (reduceMotion) {
      fade.set(
        withTiming(0, REDUCED_FADE, (finished) => {
          if (finished) scheduleOnRN(onExited);
        }),
      );
      return;
    }
    offset.set(
      withSpring(
        height.get() || OFFSCREEN,
        {
          ...springs.sheet,
          velocity: releaseVelocity.get(),
          overshootClamping: true,
        },
        (finished) => {
          if (finished) scheduleOnRN(onExited);
        },
      ),
    );
  }, [
    open,
    reduceMotion,
    fade,
    offset,
    height,
    releaseVelocity,
    closing,
    onExited,
  ]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .onStart(() => {
          start.set(offset.get());
        })
        .onUpdate((event) => {
          // A sheet closed by back or the scrim mid-drag must keep its exit spring.
          if (closing.get()) return;
          const next = start.get() + event.translationY;
          offset.set(
            next >= 0 ? next : rubberband(next, height.get()),
          );
        })
        .onEnd((event) => {
          if (closing.get()) return;
          const travel = height.get();
          const landing = projectedPosition(
            offset.get(),
            event.velocityY,
          );
          if (
            travel > 0 &&
            landing > travel * FLING_COMMIT_THRESHOLD
          ) {
            releaseVelocity.set(event.velocityY);
            scheduleOnRN(onDismiss);
            return;
          }
          offset.set(
            reduceMotion
              ? withTiming(0, REDUCED_FADE)
              : withSpring(0, {
                  ...springs.sheet,
                  velocity: event.velocityY,
                }),
          );
        }),
    [
      closing,
      height,
      offset,
      onDismiss,
      reduceMotion,
      releaseVelocity,
      start,
    ],
  );

  const scrimStyle = useAnimatedStyle(() => {
    const h = height.get();
    const slide =
      h > 0
        ? interpolate(
            offset.get(),
            [0, h],
            [1, 0],
            Extrapolation.CLAMP,
          )
        : 0;
    return { opacity: reduceMotion ? fade.get() * slide : slide };
  });

  const frameStyle = useAnimatedStyle(() => ({
    bottom: keyboard.height.get(),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? fade.get() : 1,
    paddingBottom:
      20 + Math.max(insets.bottom - keyboard.height.get(), 0),
    transform: [{ translateY: offset.get() }],
  }));

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: SCRIM },
          scrimStyle,
        ]}
      >
        <Pressable
          testID={tid('sheet', 'scrim')}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.frame,
          { top: insets.top + LARGE_TOP_BELOW_INSET },
          frameStyle,
        ]}
      >
        <Animated.View
          accessibilityViewIsModal
          className="rounded-t-sheet bg-canvas px-5 pt-2"
          style={[
            styles.sheet,
            size === 'large' ? styles.large : styles.fit,
            sheetStyle,
          ]}
          onLayout={(event) => {
            const measured = event.nativeEvent.layout.height;
            const first = height.get() === 0;
            height.set(measured);
            if (!first || !open) return;
            if (reduceMotion) {
              offset.set(0);
              fade.set(withTiming(1, REDUCED_FADE));
            } else {
              offset.set(measured);
              offset.set(withSpring(0, springs.sheet));
            }
          }}
        >
          <GestureDetector gesture={pan}>
            <View className="gap-3 pb-3">
              <View className="h-[5px] w-9 self-center rounded-full bg-hairline" />
              <View className="min-h-11 flex-row items-start gap-3">
                <View className="flex-1 gap-0.5 pt-[9px]">
                  <Text
                    accessibilityRole="header"
                    className="text-[22px] leading-[26px] font-display-bold text-foreground"
                  >
                    {title}
                  </Text>
                  {note ? (
                    <Text className="text-[13px] leading-[18px] text-muted">
                      {note}
                    </Text>
                  ) : null}
                </View>
                {closeLabel ? (
                  <HeaderIconButton
                    testID={tid('sheet', 'close')}
                    accessibilityLabel={closeLabel}
                    icon="close"
                    glyphSize={22}
                    onPress={onDismiss}
                  />
                ) : null}
              </View>
            </View>
          </GestureDetector>
          <View style={size === 'large' ? styles.large : styles.body}>
            {children}
          </View>
          {actions ? (
            <View className="flex-row gap-2 pt-5">{actions}</View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  frame: {
    justifyContent: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  sheet: {
    boxShadow: '0 12px 32px rgba(23,24,26,0.18)',
  },
  fit: { flexShrink: 1, maxHeight: '100%' },
  large: { flex: 1 },
  body: { flexShrink: 1 },
});
