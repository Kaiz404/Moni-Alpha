import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  type NativeGesture,
  type PanGesture,
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
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
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
/**
 * Cream hanging below the sheet, so the rise's overshoot and an upward drag
 * never show the page under it. The drag rubber-bands towards the sheet's own
 * height at most, and no sheet is taller than a screen.
 */
const BLEED = 2000;
const REDUCED_FADE = { duration: 180 };

function rubberband(overshoot: number, dimension: number) {
  'worklet';
  const k = 0.55;
  return (
    (overshoot * dimension * k) /
    (dimension + k * Math.abs(overshoot))
  );
}

/** Lets a list inside a sheet tell the sheet where it is scrolled to. */
type SheetScroll = { scrollY: SharedValue<number>; gesture: NativeGesture };
const SheetScrollContext = createContext<SheetScroll | null>(null);

/** The body's drag-to-close, handed to the one `SheetDragArea` of a sheet whose body holds a map. */
const SheetDragContext = createContext<PanGesture | null>(null);

/**
 * The part of a `bodyDrags={false}` sheet that still pulls it down, such as the search and list
 * under a map. Use one per sheet, and `SheetScrollView` for a list inside it.
 */
export function SheetDragArea({
  className,
  style,
  children,
}: {
  className?: string;
  style?: ComponentProps<typeof Animated.View>['style'];
  children: ReactNode;
}) {
  const drag = useContext(SheetDragContext);
  const area = (
    <Animated.View
      className={className}
      style={style}
    >
      {children}
    </Animated.View>
  );
  return drag ? <GestureDetector gesture={drag}>{area}</GestureDetector> : area;
}

/** Scrolled within this of the top counts as at the top. */
const AT_TOP_PX = 1;

function useSheetScrollProps() {
  const sheet = useContext(SheetScrollContext);
  // The sheet reads this once, as a finger lands, so a JS-thread write per scroll event is enough.
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    sheet?.scrollY.set(event.nativeEvent.contentOffset.y);
  return { sheet, onScroll };
}

/**
 * The scroll view for a sheet's body. It stops at its top instead of stretching, and lets the
 * sheet know where it is, so a drag that starts with it at the top pulls the sheet down.
 */
export function SheetScrollView(props: ScrollViewProps) {
  const { sheet, onScroll } = useSheetScrollProps();
  const list = (
    <ScrollView
      {...props}
      onScroll={onScroll}
      scrollEventThrottle={16}
      overScrollMode="never"
      bounces={false}
    />
  );
  return sheet ? <GestureDetector gesture={sheet.gesture}>{list}</GestureDetector> : list;
}

/** `SheetScrollView` for a long list. */
export function SheetFlatList<T>(props: FlatListProps<T>) {
  const { sheet, onScroll } = useSheetScrollProps();
  const list = (
    <FlatList
      {...props}
      onScroll={onScroll}
      scrollEventThrottle={16}
      overScrollMode="never"
      bounces={false}
    />
  );
  return sheet ? <GestureDetector gesture={sheet.gesture}>{list}</GestureDetector> : list;
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
  /** Space between the grabber, the title row and the body: 12, or 16 on the + chooser. */
  gap?: 12 | 16;
  /** False when the body holds a map: the header and the body's `SheetDragArea` drag the sheet, the map does not. */
  bodyDrags?: boolean;
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
 * on the `sheet` spring, follows the finger 1:1 from its header, or from its body
 * when the body's list is at its top, and closes when a release projects past
 * 40% of its height.
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
  gap = 12,
  bodyDrags = true,
  children,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const tokens = useThemeTokens();
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

  const scrollY = useSharedValue(0);
  const fromTop = useSharedValue(true);
  const scroll = useMemo<SheetScroll>(
    () => ({ scrollY, gesture: Gesture.Native() }),
    [scrollY],
  );

  const { header, body } = useMemo(() => {
    const follow = (translationY: number, stretchUp: boolean) => {
      'worklet';
      // A sheet closed by back or the scrim mid-drag must keep its exit spring.
      if (closing.get()) return;
      const next = start.get() + translationY;
      offset.set(
        next >= 0 ? next : stretchUp ? rubberband(next, height.get()) : 0,
      );
    };
    const release = (velocityY: number) => {
      'worklet';
      if (closing.get()) return;
      const travel = height.get();
      const landing = projectedPosition(offset.get(), velocityY);
      if (travel > 0 && landing > travel * FLING_COMMIT_THRESHOLD) {
        releaseVelocity.set(velocityY);
        scheduleOnRN(onDismiss);
        return;
      }
      offset.set(
        reduceMotion
          ? withTiming(0, REDUCED_FADE)
          : withSpring(0, { ...springs.sheet, velocity: velocityY }),
      );
    };
    const header = Gesture.Pan()
      .activeOffsetY([-10, 10])
      .onStart(() => start.set(offset.get()))
      .onUpdate((event) => follow(event.translationY, true))
      .onEnd((event) => release(event.velocityY));
    // The body pulls the sheet down only when its list was already at the top as the finger
    // landed: a drag that scrolls the list up stops at the top, and the next one closes.
    const body = Gesture.Pan()
      .withTestId('sheet.body.drag')
      .activeOffsetY([-10, 10])
      .failOffsetX([-16, 16])
      .simultaneousWithExternalGesture(scroll.gesture)
      .onBegin(() => fromTop.set(scrollY.get() <= AT_TOP_PX))
      .onStart(() => start.set(offset.get()))
      .onUpdate((event) => {
        // A drag that began by scrolling the list stays a scroll for the rest of the gesture.
        if (event.translationY < 0 && offset.get() === 0) fromTop.set(false);
        if (fromTop.get()) follow(event.translationY, false);
      })
      .onEnd((event) => {
        if (fromTop.get()) release(event.velocityY);
      });
    return { header, body };
  }, [
    closing,
    fromTop,
    height,
    offset,
    onDismiss,
    reduceMotion,
    releaseVelocity,
    scroll,
    scrollY,
    start,
  ]);

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
    return {
      opacity: reduceMotion ? fade.get() * slide : slide,
    };
  });

  const frameStyle = useAnimatedStyle(() => ({
    bottom: keyboard.height.get(),
  }));

  const sheetStyle = useAnimatedStyle(() => {
    return {
      opacity: reduceMotion ? fade.get() : 1,
      paddingBottom:
        20 + Math.max(insets.bottom - keyboard.height.get(), 0),
      transform: [{ translateY: offset.get() }],
    };
  });

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
          <View
            testID={tid('sheet', 'bleed')}
            pointerEvents="none"
            className="bg-canvas"
            style={styles.bleed}
          />
          <GestureDetector gesture={header}>
            <View style={{ gap, paddingBottom: gap }}>
              <View className="h-[5px] w-9 self-center rounded-full bg-hairline" />
              <View className="min-h-11 flex-row items-start gap-3">
                <View className="flex-1 gap-0.5 pt-[9px]">
                  <Text
                    variant="sectionTitle"
                    accessibilityRole="header"
                    className="text-foreground"
                  >
                    {title}
                  </Text>
                  {note ? (
                    <Text
                      variant="meta"
                      className="text-muted"
                    >
                      {note}
                    </Text>
                  ) : null}
                </View>
                {closeLabel ? (
                  <Press
                    testID={tid('sheet', 'close')}
                    accessibilityLabel={closeLabel}
                    radius={{ rest: 22, pressed: 16 }}
                    pressedClassName="bg-sand"
                    className="h-11 w-11 items-center justify-center"
                    onPress={onDismiss}
                  >
                    <IconSymbol
                      name="close"
                      size={22}
                      color={tokens.foreground}
                    />
                  </Press>
                ) : null}
              </View>
            </View>
          </GestureDetector>
          {bodyDrags ? (
            <SheetScrollContext.Provider value={scroll}>
              <GestureDetector gesture={body}>
                <View style={size === 'large' ? styles.large : styles.body}>
                  {children}
                </View>
              </GestureDetector>
            </SheetScrollContext.Provider>
          ) : (
            <SheetScrollContext.Provider value={scroll}>
              <SheetDragContext.Provider value={body}>
                <View style={size === 'large' ? styles.large : styles.body}>
                  {children}
                </View>
              </SheetDragContext.Provider>
            </SheetScrollContext.Provider>
          )}
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
  // One point of overlap, or a fractional translateY draws a seam at the join.
  bleed: {
    bottom: -BLEED,
    height: BLEED + 1,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  fit: { flexShrink: 1, maxHeight: '100%' },
  large: { flex: 1 },
  body: { flexShrink: 1 },
});
