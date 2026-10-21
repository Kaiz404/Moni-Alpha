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

const INSET = 4;

type SegmentedProps<T extends string> = {
  screen: Screen;
  name: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function Segmented<T extends string>({
  screen,
  name,
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
}: SegmentedProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const position = useSharedValue(index);
  const segment = useSharedValue(0);

  useEffect(() => {
    position.set(withSpring(index, springs.control));
  }, [index, position]);

  const pill = useAnimatedStyle(() => ({
    width: segment.get(),
    transform: [{ translateX: position.get() * segment.get() }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className={`h-11 flex-row rounded-full p-1 ${disabled ? 'bg-sand-light' : 'bg-sand'}`}
      onLayout={(event) =>
        segment.set(
          (event.nativeEvent.layout.width - INSET * 2) /
            options.length,
        )
      }
    >
      <Animated.View
        pointerEvents="none"
        className={`absolute left-1 top-1 h-9 rounded-full ${disabled ? 'bg-hairline' : 'bg-primary'}`}
        style={pill}
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Press
            key={option.value}
            testID={tid(screen, name, option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            radius={{ rest: 18, pressed: 16 }}
            pressedClassName={
              selected ? 'bg-primary-pressed' : 'bg-hairline'
            }
            className="flex-1 items-center justify-center"
            onPress={() => {
              if (selected) return;
              scrubStep();
              onChange(option.value);
            }}
          >
            <Text
              className={`text-[14px] leading-[19px] font-display-semibold ${disabled ? 'text-muted' : selected ? 'text-primary-foreground' : 'text-foreground'}`}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Press>
        );
      })}
    </View>
  );
}
