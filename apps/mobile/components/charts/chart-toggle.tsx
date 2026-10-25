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

/**
 * The chart card toggle on every chart card (Pace | Daily, Spending | Balance): Sand track 36
 * tall, Ink pill on the control spring, segments 70 wide (Home) or 88 (Activity's longer
 * labels). Segments are `<screen>.<name>.<value>`.
 */
export function ChartToggle<T extends string>({
  screen,
  name,
  options,
  value,
  onChange,
  segment = 70,
}: {
  screen: Screen;
  name: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  segment?: 70 | 88;
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
    transform: [{ translateX: position.get() * (segment - 3) }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Chart type"
      className="h-9 flex-row rounded-full bg-sand"
      style={{ width: segment * options.length }}
    >
      <Animated.View
        pointerEvents="none"
        className="absolute rounded-full bg-primary"
        style={[{ left: 3, top: 3, height: 30, width: segment - 3 }, pill]}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Press
            key={option.value}
            testID={tid(screen, name, option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            pressedClassName="bg-transparent"
            className="h-9 items-center justify-center rounded-full"
            style={{ width: segment }}
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
