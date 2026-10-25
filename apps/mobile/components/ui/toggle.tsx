import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Press } from '@/components/ui/press';
import { toggleOff, toggleOn } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import type { TestId } from '@/lib/test-ids';

/** Knob travel inside the 52 × 32 track: 2 from the left when off, 24 when on. */
const TRAVEL = 22;
const REDUCED_FADE = { duration: 180 };
/** The ink fill covers the 1.5 Hairline edge too, so on reads as one ink track. */
const INK_OVER_EDGE = {
  position: 'absolute',
  top: -1.5,
  left: -1.5,
  right: -1.5,
  bottom: -1.5,
} as const;

/**
 * The one switch (`V2H-Permissions`, `V2H-WalletDetail`, `V2P-BillDetail`): ink track when on, Sand with a Hairline edge when
 * off. The knob rides the control spring; the hit area is 56 × 44.
 */
export function Toggle({
  testID,
  value,
  accessibilityLabel,
  onChange,
  disabled = false,
}: {
  testID: TestId;
  value: boolean;
  accessibilityLabel: string;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const position = useSharedValue(value ? 1 : 0);
  const fill = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const target = value ? 1 : 0;
    if (reduceMotion) {
      position.set(target);
      fill.set(withTiming(target, REDUCED_FADE));
      return;
    }
    position.set(withSpring(target, springs.control));
    fill.set(withSpring(target, springs.press));
  }, [fill, position, reduceMotion, value]);

  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * TRAVEL }],
  }));
  const ink = useAnimatedStyle(() => ({ opacity: fill.get() }));

  return (
    <Press
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      pressedScale={1}
      pressedClassName="bg-transparent"
      onPress={() => {
        if (value) toggleOff();
        else toggleOn();
        onChange(!value);
      }}
      className={`h-11 w-14 items-end justify-center ${disabled ? 'opacity-50' : ''}`}
    >
      <View className="h-8 w-[52px] rounded-full border-[1.5px] border-hairline bg-sand">
        <Animated.View
          pointerEvents="none"
          className="rounded-full bg-primary"
          style={[INK_OVER_EDGE, ink]}
        />
        <Animated.View
          className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-card"
          style={knob}
        />
      </View>
    </Press>
  );
}
