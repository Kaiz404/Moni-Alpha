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

/**
 * The settings switch from `V2H-Permissions`: ink track when on, Sand with a Hairline edge when
 * off. The knob rides the control spring; the hit area is 56 × 44.
 */
export function Toggle({
  testID,
  value,
  label,
  onChange,
  disabled = false,
}: {
  testID: TestId;
  value: boolean;
  label: string;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const position = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const target = value ? 1 : 0;
    position.set(
      reduceMotion ? withTiming(target, { duration: 150 }) : withSpring(target, springs.control),
    );
  }, [position, reduceMotion, value]);

  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * TRAVEL }],
  }));

  return (
    <Press
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
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
      <View
        className={`h-8 w-[52px] rounded-full border-[1.5px] ${value ? 'border-primary bg-primary' : 'border-hairline bg-sand'}`}
      >
        <Animated.View
          className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-card"
          style={knob}
        />
      </View>
    </Press>
  );
}
