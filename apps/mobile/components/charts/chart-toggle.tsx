import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { scrubStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid, type Screen } from '@/lib/test-ids';

const SEGMENT = 70;

/** The chart card toggle: Sand track 36 tall, Ink pill on the control spring, 70-wide segments. */
export function ChartToggle<T extends string>({
  screen,
  options,
  value,
  onChange,
}: {
  screen: Screen;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const position = useSharedValue(index);
  useEffect(() => {
    position.set(withSpring(index, springs.control));
  }, [index, position]);
  const pill = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * (SEGMENT - 3) }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Chart type"
      className="h-9 flex-row rounded-full bg-sand"
      style={{ width: SEGMENT * options.length }}
    >
      <Animated.View
        pointerEvents="none"
        className="absolute rounded-full bg-primary"
        style={[{ left: 3, top: 3, height: 30, width: SEGMENT - 3 }, pill]}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Press
            key={option.value}
            testID={tid(screen, 'chart', option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            pressedClassName="bg-transparent"
            className="h-9 items-center justify-center rounded-full"
            style={{ width: SEGMENT }}
            onPress={() => {
              if (selected) return;
              scrubStep();
              onChange(option.value);
            }}
          >
            <Text
              className={`text-[13px] leading-4 font-display-semibold ${selected ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              {option.label}
            </Text>
          </Press>
        );
      })}
    </View>
  );
}
