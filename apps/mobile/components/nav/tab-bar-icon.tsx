import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';

type TabBarIconProps = {
  focused: boolean;
  color: ColorValue;
  outline: IconSymbolName;
  filled: IconSymbolName;
  size?: number;
};

/** Crossfades a tab's outline icon into its filled selected state. */
export function TabBarIcon({
  focused,
  color,
  outline,
  filled,
  size = 28,
}: TabBarIconProps) {
  const reducedMotion = useReducedMotion();
  const selected = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    selected.value = withTiming(focused ? 1 : 0, {
      duration: reducedMotion ? 160 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [focused, reducedMotion, selected]);

  const outlineStyle = useAnimatedStyle(() => ({
    opacity: 1 - selected.value,
    transform: [
      {
        scale: reducedMotion
          ? 1
          : interpolate(selected.value, [0, 1], [1, 0.92]),
      },
    ],
  }));

  const filledStyle = useAnimatedStyle(() => ({
    opacity: selected.value,
    transform: [
      {
        scale: reducedMotion
          ? 1
          : interpolate(selected.value, [0, 1], [0.92, 1]),
      },
    ],
  }));

  return (
    <Animated.View style={{ width: size, height: size }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', inset: 0 }, outlineStyle]}
      >
        <IconSymbol
          name={outline}
          size={size}
          color={color}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', inset: 0 }, filledStyle]}
      >
        <IconSymbol
          name={filled}
          size={size}
          color={color}
        />
      </Animated.View>
    </Animated.View>
  );
}
