import { useEffect } from 'react';
import { View } from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

export function PulsingOrb({ active }: { active: boolean }) {
  const tokens = useThemeTokens();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (active) {
      pulse.value = withRepeat(
        withTiming(1, {
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [active, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.35 }],
    opacity: 0.35 - pulse.value * 0.25,
  }));

  return (
    <View
      className="items-center justify-center"
      style={{ height: 160, width: 160 }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            height: 160,
            width: 160,
            borderRadius: 80,
            backgroundColor: tokens.primary,
          },
          ringStyle,
        ]}
      />
      <View
        className="items-center justify-center rounded-full"
        style={{
          height: 104,
          width: 104,
          backgroundColor: tokens.primary,
        }}
      >
        <MaterialIcons
          name="mic"
          size={40}
          color="#ffffff"
        />
      </View>
    </View>
  );
}
