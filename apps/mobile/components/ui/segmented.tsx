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
  /** `form` is the 52 track with a 44 pill and 15/600 labels that leads a form (V2P-DebtNew). */
  size?: 'default' | 'form';
};

const sizes = {
  default: {
    track: 'h-11',
    pill: 'h-9',
    corners: 18,
    label: 'text-[14px] leading-[19px]',
  },
  form: {
    track: 'h-[52px]',
    pill: 'h-11',
    corners: 22,
    label: 'text-[15px] leading-[21px]',
  },
} as const;

export function Segmented<T extends string>({
  screen,
  name,
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  size = 'default',
}: SegmentedProps<T>) {
  const look = sizes[size];
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
      className={`${look.track} flex-row rounded-full p-1 ${disabled ? 'bg-sand-light' : 'bg-sand'}`}
      onLayout={(event) =>
        segment.set(
          (event.nativeEvent.layout.width - INSET * 2) /
            options.length,
        )
      }
    >
      <Animated.View
        pointerEvents="none"
        className={`absolute left-1 top-1 ${look.pill} rounded-full ${disabled ? 'bg-hairline' : 'bg-primary'}`}
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
            radius={{ rest: look.corners, pressed: 16 }}
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
              className={`${look.label} font-display-semibold ${disabled ? 'text-muted' : selected ? 'text-primary-foreground' : 'text-foreground'}`}
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
