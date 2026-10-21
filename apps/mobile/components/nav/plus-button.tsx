import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { springs } from '@/lib/motion/tokens';
import type { TestId } from '@/lib/test-ids';

export const TAB_BAR_HEIGHT = 64;
const PLUS_SIZE = 60;
export const RING_SIZE = 72;
const PLUS_ABOVE_BAR = 16;
/** The bar plus the part of the ringed + that rises above it. */
export const TAB_BAR_REACH =
  TAB_BAR_HEIGHT + PLUS_ABOVE_BAR + (RING_SIZE - PLUS_SIZE) / 2;

/** The pill floats 26 above the screen edge, or just above a taller system nav bar. */
export function tabBarBottom(insetBottom: number) {
  return Math.max(26, insetBottom + 8);
}

/** Bottom of the ring around the +, measured from the screen edge. */
export function plusRingBottom(insetBottom: number) {
  return tabBarBottom(insetBottom) + TAB_BAR_REACH - RING_SIZE;
}

/** Top of the + circle, measured from the screen edge. */
export function plusTop(insetBottom: number) {
  return plusRingBottom(insetBottom) + (RING_SIZE + PLUS_SIZE) / 2;
}

type PlusButtonProps = {
  testID: TestId;
  /** Turns the plus 45° into the chooser's close button. */
  open: boolean;
  onPress: () => void;
};

/**
 * The Mint key + in its cream ring. The tab bar and the chooser render it at
 * the same spot, so the one in the chooser sits above the scrim as its ×.
 */
export function PlusButton({
  testID,
  open,
  onPress,
}: PlusButtonProps) {
  const tokens = useThemeTokens();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    const target = open ? 45 : 0;
    turn.set(
      reduceMotion ? target : withSpring(target, springs.control),
    );
  }, [open, reduceMotion, turn]);

  const glyph = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.get()}deg` }],
  }));

  return (
    <View
      className="items-center justify-center rounded-full bg-canvas"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <Press
        testID={testID}
        onPress={onPress}
        hitSlop={(RING_SIZE - PLUS_SIZE) / 2}
        accessibilityLabel={open ? 'Close' : 'Add a transaction'}
        accessibilityState={{ expanded: open }}
        radius={{ rest: PLUS_SIZE / 2, pressed: 20 }}
        pressedClassName="bg-mint-key-pressed"
        className="items-center justify-center bg-mint-key"
        style={{ width: PLUS_SIZE, height: PLUS_SIZE }}
      >
        <Animated.View
          pointerEvents="none"
          style={glyph}
        >
          <IconSymbol
            name="plus"
            size={28}
            color={tokens.onPastel}
          />
        </Animated.View>
      </Press>
    </View>
  );
}
