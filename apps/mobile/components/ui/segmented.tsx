import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { scrubStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid, type Screen } from '@/lib/test-ids';

const INSET = 4;
const REDUCED_FADE = { duration: 180 };

type SegmentedProps<T extends string> = {
  screen: Screen;
  name: string;
  /** An icon draws 18 before its label, 6 apart (V2H-Profile Appearance). */
  options: readonly {
    value: T;
    label: string;
    icon?: IconSymbolName;
  }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /**
   * `medium` is the 48 track with 15/600 labels (V2H-Profile, V2H-Login);
   * `form` is the 52 track that leads a form (V2P-DebtNew).
   */
  size?: 'default' | 'medium' | 'form';
};

const sizes = {
  default: {
    track: 'h-11',
    pill: 'h-9',
    corners: 18,
    label: 'text-[14px] leading-[19px]',
  },
  medium: {
    track: 'h-12',
    pill: 'h-10',
    corners: 20,
    label: 'text-[15px] leading-[21px]',
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
  const tokens = useThemeTokens();
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const reduceMotion = useReducedMotion();
  const position = useSharedValue(index);
  const segment = useSharedValue(0);
  const shown = useSharedValue(1);

  useEffect(() => {
    if (position.get() === index) return;
    if (reduceMotion) {
      // V2F-Motion: under Reduce Motion the pill cross-fades between options in 180.
      position.set(index);
      shown.set(0);
      shown.set(withTiming(1, REDUCED_FADE));
      return;
    }
    position.set(withSpring(index, springs.control));
  }, [index, position, reduceMotion, shown]);

  const pill = useAnimatedStyle(() => ({
    opacity: shown.get(),
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
            className="flex-1 flex-row items-center justify-center gap-1.5"
            onPress={() => {
              if (selected) return;
              scrubStep();
              onChange(option.value);
            }}
          >
            {option.icon ? (
              <IconSymbol
                name={option.icon}
                size={18}
                color={
                  disabled
                    ? tokens.muted
                    : selected
                      ? tokens.primaryForeground
                      : tokens.foreground
                }
              />
            ) : null}
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
