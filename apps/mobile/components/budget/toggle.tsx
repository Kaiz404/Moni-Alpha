import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Press } from '@/components/ui/press';
import { toggleOff, toggleOn } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import type { TestId } from '@/lib/test-ids';

const TRAVEL = 20;

/** A 52 × 32 switch: Ink track when on, Hairline when off, the knob on the `control` spring. */
export function Toggle({
  testID,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
}: {
  testID: TestId;
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const position = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    position.set(withSpring(value ? 1 : 0, springs.control));
  }, [value, position]);
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * TRAVEL }],
  }));
  return (
    <Press
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      pressedScale={1}
      pressedClassName="bg-transparent"
      hitSlop={6}
      onPress={() => {
        if (value) toggleOff();
        else toggleOn();
        onChange(!value);
      }}
      className={`h-8 w-[52px] rounded-full ${value ? 'bg-primary' : 'bg-hairline'} ${disabled ? 'opacity-50' : ''}`}
    >
      <Animated.View
        className="absolute left-1 top-1 h-6 w-6 rounded-full bg-card"
        style={knob}
      />
    </Press>
  );
}
