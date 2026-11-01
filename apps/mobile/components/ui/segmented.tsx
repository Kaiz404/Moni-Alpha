import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
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
  /** `medium` is the 48 track with 15/600 labels (V2H-Profile, V2H-Login). `compact` is 36 with 12/600 labels. */
  size?: 'default' | 'medium' | 'compact';
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
  compact: {
    track: 'h-9',
    pill: 'h-7',
    corners: 14,
    label: 'text-[12px] leading-4',
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
  const reduceMotion = useReducedMotion();
  const position = useSharedValue(index);
  const segment = useSharedValue(0);
  const shown = useSharedValue(1);

  const heading = useRef(index);

  const slideTo = (next: number) => {
    if (heading.current === next) return;
    heading.current = next;
    if (reduceMotion) {
      // V2F-Motion: under Reduce Motion the pill cross-fades between options in 180.
      position.set(next);
      shown.set(0);
      shown.set(withTiming(1, REDUCED_FADE));
      return;
    }
    position.set(withSpring(next, springs.control));
  };

  // Follows a value changed from outside. A tap slides in its own handler, so
  // the pill never waits for the render its `onChange` causes.
  useEffect(() => slideTo(index));

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
        testID={tid(screen, name, 'pill')}
        pointerEvents="none"
        className={`absolute left-1 top-1 ${look.pill} rounded-full ${disabled ? 'bg-hairline' : 'bg-primary'}`}
        style={pill}
      />
      {options.map((option, optionIndex) => {
        const selected = option.value === value;
        return (
          <Press
            key={option.value}
            testID={tid(screen, name, option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            hitSlop={size === 'compact' ? { top: 8, bottom: 8 } : undefined}
            pressedClassName="bg-transparent"
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full"
            onPress={() => {
              if (selected) return;
              scrubStep();
              slideTo(optionIndex);
              onChange(option.value);
            }}
          >
            <OptionFace
              option={option}
              index={optionIndex}
              position={position}
              labelClass={look.label}
              disabled={disabled}
            />
          </Press>
        );
      })}
    </View>
  );
}

/** The pill carries the colour: a label turns as the pill reaches it, not when the value changes. */
function OptionFace({
  option,
  index,
  position,
  labelClass,
  disabled,
}: {
  option: { label: string; icon?: IconSymbolName };
  index: number;
  position: SharedValue<number>;
  labelClass: string;
  disabled: boolean;
}) {
  const tokens = useThemeTokens();
  const rest = disabled ? tokens.muted : tokens.foreground;
  const onPill = disabled ? tokens.muted : tokens.primaryForeground;
  const under = useDerivedValue(() =>
    Math.max(0, 1 - Math.abs(position.get() - index)),
  );
  const label = useAnimatedStyle(() => ({
    color: interpolateColor(under.get(), [0, 1], [rest, onPill]),
  }));
  const iconOnPill = useAnimatedStyle(() => ({ opacity: under.get() }));
  return (
    <>
      {option.icon ? (
        <View>
          <IconSymbol name={option.icon} size={18} color={rest} />
          <Animated.View className="absolute inset-0" style={iconOnPill}>
            <IconSymbol name={option.icon} size={18} color={onPill} />
          </Animated.View>
        </View>
      ) : null}
      <Animated.Text
        className={`${labelClass} font-display-semibold`}
        style={label}
        numberOfLines={1}
      >
        {option.label}
      </Animated.Text>
    </>
  );
}
