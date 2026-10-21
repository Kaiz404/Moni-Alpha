import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  FLING_COMMIT_THRESHOLD,
  projectedPosition,
  springs,
} from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';

type MapSheetProps = {
  /** Top edge at rest, over the bottom of the map. */
  collapsedTop: number;
  /** Top edge when pulled up, just under the header. */
  expandedTop: number;
  windowHeight: number;
  children: ReactNode;
};

/**
 * The cream sheet under the map. Its content scrolls on its own so the map
 * above keeps every pan and pinch; the grabber drags or taps it up to just
 * under the header and back, on the `sheet` spring.
 */
export function MapSheet({
  collapsedTop,
  expandedTop,
  windowHeight,
  children,
}: MapSheetProps) {
  const insets = useSafeAreaInsets();
  const top = useSharedValue(collapsedTop);
  const start = useSharedValue(collapsedTop);
  const travel = collapsedTop - expandedTop;

  const settle = (target: number, velocity = 0) => {
    'worklet';
    top.set(withSpring(target, { ...springs.sheet, velocity }));
  };

  const toggle = () => {
    'worklet';
    settle(top.get() > expandedTop + travel / 2 ? expandedTop : collapsedTop);
  };

  const pan = Gesture.Pan()
    .onStart(() => start.set(top.get()))
    .onUpdate((event) => {
      top.set(Math.min(collapsedTop, Math.max(expandedTop, start.get() + event.translationY)));
    })
    .onEnd((event) => {
      const moved = projectedPosition(top.get(), event.velocityY) - start.get();
      const wasCollapsed = start.get() > expandedTop + travel / 2;
      const commit = Math.abs(moved) >= travel * FLING_COMMIT_THRESHOLD;
      const target = wasCollapsed
        ? commit && moved < 0
          ? expandedTop
          : collapsedTop
        : commit && moved > 0
          ? collapsedTop
          : expandedTop;
      settle(target, event.velocityY);
    });
  const tap = Gesture.Tap().onEnd(() => toggle());

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: top.get() }],
  }));

  return (
    <Animated.View
      className="absolute left-0 right-0 top-0 rounded-t-sheet bg-canvas"
      style={[
        {
          height: windowHeight - expandedTop,
          boxShadow: '0 12px 32px rgba(23,24,26,0.18)',
        },
        sheetStyle,
      ]}
    >
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View
          testID={tid('map', 'sheet', 'grabber')}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Expand or shrink the list"
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={() => toggle()}
          className="h-[30px] items-center justify-center"
        >
          <View className="h-[5px] w-9 rounded-full bg-hairline" />
        </View>
      </GestureDetector>
      <ScrollView
        contentContainerClassName="gap-3.5 px-5"
        contentContainerStyle={{ paddingBottom: travel + insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}
