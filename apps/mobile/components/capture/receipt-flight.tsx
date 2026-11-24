import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { tid } from '@/lib/test-ids';
import { springs } from '@repo/design';

/** A view's box in window coordinates, from `measureInWindow`. */
export type WindowFrame = { x: number; y: number; width: number; height: number };

/** Measures a view in the window once it lays out. */
export function measureFrame(view: View | null, onFrame: (frame: WindowFrame) => void) {
  view?.measureInWindow((x, y, width, height) => {
    if (width > 0 && height > 0) onFrame({ x, y, width, height });
  });
}

/** The scanned receipt flies from where Moni read it into the check page's header, unless Reduce Motion is on. */
export function receiptFlies(from: WindowFrame | null, reduceMotion: boolean): boolean {
  return from !== null && !reduceMotion;
}

type Phase = 'flying' | 'landing' | 'done';

export type ReceiptFlight = {
  /** True while the receipt is in the air: the header photo stays hidden and the fields wait. */
  flying: boolean;
  /** Spread onto the header photo, which reports where the receipt lands. */
  photo: { hidden: boolean; onFrame: (frame: WindowFrame) => void };
  /** Wraps the check page, holding the receipt above it while it flies. */
  stage: (page: ReactNode) => ReactNode;
};

/**
 * The receipt Moni just read, carried from the reading page's viewfinder into the check page's
 * header (#123). It springs on `sheet` from the old box to the new one, then fades over the
 * header photo so the photo's expand button arrives with it. A new target retargets the spring.
 */
export function useReceiptFlight(uri: string | null, from: WindowFrame | null): ReceiptFlight {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(() =>
    uri && receiptFlies(from, reduceMotion) ? 'flying' : 'done',
  );
  const [to, setTo] = useState<WindowFrame | null>(null);
  const [origin, setOrigin] = useState<WindowFrame | null>(null);
  const root = useRef<View>(null);

  const stage = (page: ReactNode) => (
    <View
      ref={root}
      collapsable={false}
      className="flex-1"
      onLayout={() => {
        if (phase !== 'done') measureFrame(root.current, setOrigin);
      }}
    >
      {page}
      {phase !== 'done' && uri && from && origin ? (
        <FlyingReceipt
          uri={uri}
          from={from}
          to={to}
          origin={origin}
          onPhase={setPhase}
        />
      ) : null}
    </View>
  );

  return {
    flying: phase === 'flying',
    photo: { hidden: phase === 'flying', onFrame: setTo },
    stage,
  };
}

function FlyingReceipt({
  uri,
  from,
  to,
  origin,
  onPhase,
}: {
  uri: string;
  from: WindowFrame;
  to: WindowFrame | null;
  origin: WindowFrame;
  onPhase: (phase: Phase) => void;
}) {
  const x = useSharedValue(from.x - origin.x);
  const y = useSharedValue(from.y - origin.y);
  const width = useSharedValue(from.width);
  const height = useSharedValue(from.height);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!to) return;
    const land = (finished?: boolean) => {
      'worklet';
      if (!finished) return;
      scheduleOnRN(onPhase, 'landing');
      opacity.set(
        withTiming(0, { duration: 150 }, (faded) => {
          if (faded) scheduleOnRN(onPhase, 'done');
        }),
      );
    };
    x.set(withSpring(to.x - origin.x, springs.sheet));
    y.set(withSpring(to.y - origin.y, springs.sheet));
    width.set(withSpring(to.width, springs.sheet));
    height.set(withSpring(to.height, springs.sheet, land));
  }, [height, onPhase, opacity, origin, to, width, x, y]);

  const box = useAnimatedStyle(() => ({
    left: x.get(),
    top: y.get(),
    width: width.get(),
    height: height.get(),
    opacity: opacity.get(),
  }));

  return (
    <Animated.View
      testID={tid('capture', 'receipt', 'flight')}
      pointerEvents="none"
      aria-hidden
      className="absolute overflow-hidden rounded-tile bg-sand"
      style={box}
    >
      <Image
        source={{ uri }}
        contentFit="cover"
        contentPosition="center"
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
