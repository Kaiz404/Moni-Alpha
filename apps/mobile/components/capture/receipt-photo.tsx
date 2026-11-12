import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

const HEADER_H = 188;
const RADIUS = 22;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const OPEN = { damping: 24, stiffness: 240 } as const;

type Frame = { x: number; y: number; width: number; height: number };

/** The scanned receipt across the top of the check page; a press opens it full screen. */
export function ReceiptPhoto({ uri }: { uri: string }) {
  const tokens = useThemeTokens();
  const frame = useRef<View>(null);
  const [origin, setOrigin] = useState<Frame | null>(null);
  const open = () =>
    frame.current?.measureInWindow((x, y, width, height) => setOrigin({ x, y, width, height }));
  return (
    <>
      <Press
        testID={tid('capture', 'receipt')}
        accessibilityRole="imagebutton"
        accessibilityLabel="The scanned receipt"
        accessibilityHint="Opens it full screen"
        className="rounded-tile"
        onPress={open}
      >
        <View
          ref={frame}
          collapsable={false}
          className="overflow-hidden rounded-tile bg-sand"
          style={{ height: HEADER_H }}
        >
          <Image
            source={{ uri }}
            contentFit="cover"
            contentPosition="top"
            style={StyleSheet.absoluteFill}
          />
          <View className="absolute bottom-3 right-3 h-9 w-9 items-center justify-center rounded-full bg-primary">
            <IconSymbol
              name="arrow-expand"
              size={18}
              color={tokens.primaryForeground}
            />
          </View>
        </View>
      </Press>
      {origin ? (
        <ReceiptViewer
          uri={uri}
          origin={origin}
          onClosed={() => setOrigin(null)}
        />
      ) : null}
    </>
  );
}

/**
 * The receipt full screen on black. It grows out of the header it was pressed on and shrinks back
 * into it; pinch or double-tap zooms, a drag pans the zoomed photo, and × or Back closes it.
 */
function ReceiptViewer({ uri, origin, onClosed }: { uri: string; origin: Frame; onClosed: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(0);
  const zoom = useSharedValue(1);
  const zoomStart = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  useEffect(() => {
    shown.set(reduceMotion ? withTiming(1, { duration: 150 }) : withSpring(1, OPEN));
  }, [reduceMotion, shown]);

  const close = () => {
    zoom.set(withTiming(1, { duration: 180 }));
    panX.set(withTiming(0, { duration: 180 }));
    panY.set(withTiming(0, { duration: 180 }));
    shown.set(
      withTiming(0, { duration: reduceMotion ? 150 : 240 }, (finished) => {
        if (finished) scheduleOnRN(onClosed);
      }),
    );
  };

  const settle = () => {
    'worklet';
    if (zoom.get() <= 1) {
      zoom.set(withSpring(1, OPEN));
      panX.set(withSpring(0, OPEN));
      panY.set(withSpring(0, OPEN));
    }
  };

  const pinch = Gesture.Pinch()
    .onStart(() => zoomStart.set(zoom.get()))
    .onUpdate((event) => zoom.set(Math.min(MAX_ZOOM, Math.max(0.8, zoomStart.get() * event.scale))))
    .onEnd(settle);
  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      panStartX.set(panX.get());
      panStartY.set(panY.get());
    })
    .onUpdate((event) => {
      if (zoom.get() <= 1) return;
      panX.set(panStartX.get() + event.translationX);
      panY.set(panStartY.get() + event.translationY);
    })
    .onEnd(settle);
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomed = zoom.get() > 1;
      zoom.set(withSpring(zoomed ? 1 : DOUBLE_TAP_ZOOM, OPEN));
      panX.set(withSpring(0, OPEN));
      panY.set(withSpring(0, OPEN));
    });
  const gestures = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const backdrop = useAnimatedStyle(() => ({ opacity: shown.get() }));
  const photoFrame = useAnimatedStyle(() => ({
    position: 'absolute',
    left: interpolate(shown.get(), [0, 1], [origin.x, 0]),
    top: interpolate(shown.get(), [0, 1], [origin.y, 0]),
    width: interpolate(shown.get(), [0, 1], [origin.width, width]),
    height: interpolate(shown.get(), [0, 1], [origin.height, height]),
    borderRadius: interpolate(shown.get(), [0, 1], [RADIUS, 0]),
    overflow: 'hidden',
  }));
  const photo = useAnimatedStyle(() => ({
    paddingTop: interpolate(shown.get(), [0, 1], [0, insets.top + 72]),
    paddingBottom: interpolate(shown.get(), [0, 1], [0, insets.bottom + 24]),
    transform: [{ translateX: panX.get() }, { translateY: panY.get() }, { scale: zoom.get() }],
  }));
  /** The header's cropped face fades out early so the frame leaves as it looked. */
  const cropped = useAnimatedStyle(() => ({ opacity: interpolate(shown.get(), [0, 0.4], [1, 0], 'clamp') }));
  const chrome = useAnimatedStyle(() => ({ opacity: shown.get() }));

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'black' }, backdrop]}
        />
        <GestureDetector gesture={gestures}>
          <Animated.View style={photoFrame}>
            <Animated.View style={[{ flex: 1 }, photo]}>
              <Image
                source={{ uri }}
                contentFit="contain"
                accessibilityLabel="The scanned receipt, full screen"
                style={{ flex: 1 }}
              />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, cropped]}
            >
              <Image
                source={{ uri }}
                contentFit="cover"
                contentPosition="top"
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
        <Animated.View
          style={[{ position: 'absolute', top: insets.top + 12, left: 20 }, chrome]}
        >
          <Press
            testID={tid('capture', 'receipt', 'close')}
            accessibilityLabel="Close the receipt"
            className="h-11 w-11 items-center justify-center rounded-full"
            pressedClassName="bg-white/25"
            style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
            onPress={close}
          >
            <IconSymbol
              name="close"
              size={22}
              color="white"
            />
          </Press>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
