import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SIDE_WORDS } from '@/components/debts/debt-words';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import type { DebtSide } from '@/lib/finance/debt-summary';
import { scrubStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';

const SIDES = ['owed_to_me', 'i_owe'] as const;
const INSET = 4;

/**
 * V2P-DebtNew's "Who owes who": a 52 Sand track with a 44 Ink pill on the
 * control spring. Segmented is the 44 chart toggle, too small for this form.
 */
export function DirectionToggle({
  name,
  value,
  onChange,
}: {
  name: string;
  value: DebtSide;
  onChange: (side: DebtSide) => void;
}) {
  const index = SIDES.indexOf(value);
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
      accessibilityLabel="Who owes who"
      className="h-[52px] flex-row rounded-full bg-sand p-1"
      onLayout={(event) =>
        segment.set(
          (event.nativeEvent.layout.width - INSET * 2) / SIDES.length,
        )
      }
    >
      <Animated.View
        pointerEvents="none"
        className="absolute left-1 top-1 h-11 rounded-full bg-primary"
        style={pill}
      />
      {SIDES.map((side) => {
        const selected = side === value;
        const label = SIDE_WORDS[side].segment(name);
        return (
          <Press
            key={side}
            testID={tid('debts', 'direction', side)}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            radius={{ rest: 22, pressed: 16 }}
            pressedClassName={
              selected ? 'bg-primary-pressed' : 'bg-hairline'
            }
            className="flex-1 items-center justify-center px-2"
            onPress={() => {
              if (selected) return;
              scrubStep();
              onChange(side);
            }}
          >
            <Text
              className={`text-[15px] leading-[21px] font-display-semibold ${selected ? 'text-primary-foreground' : 'text-foreground'}`}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Press>
        );
      })}
    </View>
  );
}
