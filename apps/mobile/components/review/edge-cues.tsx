import { View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { FLING_COMMIT_THRESHOLD } from '@/lib/motion/tokens';
import type { SwipeIntent } from '@/lib/proposals/review-card-state';

type Side = 'right' | 'left' | 'down';

const SIDE_WIDTH = 28;
const SIDE_LENGTH = 128;

type CueProps = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  intent: SharedValue<SwipeIntent>;
  width: number;
  height: number;
};

/** How far toward this side's threshold the card is, 0 to 1, and whether it is armed. */
function useCueStyles(side: Side, { x, y, intent, width, height }: CueProps) {
  const progress = () => {
    'worklet';
    const dx = x.get();
    const dy = y.get();
    const sideways = Math.abs(dx) >= Math.abs(dy);
    const reach =
      side === 'right'
        ? sideways ? dx / (width * FLING_COMMIT_THRESHOLD) : 0
        : side === 'left'
          ? sideways ? -dx / (width * FLING_COMMIT_THRESHOLD) : 0
          : sideways ? 0 : dy / (height * FLING_COMMIT_THRESHOLD);
    return Math.min(1, Math.max(0, reach));
  };
  const armed = () => {
    'worklet';
    const now = intent.get();
    return side === 'right'
      ? now === 'approve' || now === 'needsWallet'
      : side === 'left'
        ? now === 'notMine'
        : now === 'later';
  };
  const other = () => {
    'worklet';
    const dx = x.get();
    const dy = y.get();
    if (dx === 0 && dy === 0) return false;
    const sideways = Math.abs(dx) >= Math.abs(dy);
    const toward: Side = sideways ? (dx > 0 ? 'right' : 'left') : 'down';
    return toward !== side;
  };

  const wrap = useAnimatedStyle(() => {
    const p = progress();
    return {
      opacity: other() ? 0.3 : 1,
      transform: [
        ...(side === 'down' ? [{ translateY: Math.max(0, y.get()) * 0.5 }] : []),
        { scale: armed() ? 1.3 : 1 + 0.18 * p },
      ],
    };
  });
  const on = useAnimatedStyle(() => ({
    opacity: armed() ? 1 : interpolate(progress(), [0, 1], [0, 0.8], Extrapolation.CLAMP),
  }));
  return { wrap, on };
}

function CueFace({
  icon,
  label,
  fill,
  border,
  ink,
  vertical,
}: {
  icon: IconSymbolName;
  label: string;
  fill: string;
  border: string;
  ink: string;
  vertical: 'up' | 'down' | null;
}) {
  const content = (
    <View
      className="flex-row items-center justify-center gap-1.5"
      style={
        vertical
          ? {
              position: 'absolute',
              width: SIDE_LENGTH,
              height: SIDE_WIDTH,
              left: (SIDE_WIDTH - SIDE_LENGTH) / 2,
              top: (SIDE_LENGTH - SIDE_WIDTH) / 2,
              transform: [{ rotate: vertical === 'down' ? '90deg' : '-90deg' }],
            }
          : undefined
      }
    >
      <IconSymbol
        name={icon}
        size={18}
        color={ink}
      />
      <Text
        className="text-[13px] leading-[18px] font-display-bold"
        style={{ color: ink }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
  return (
    <View
      className="absolute inset-0 items-center justify-center rounded-full"
      style={{ backgroundColor: fill, borderColor: border, borderWidth: 1.5 }}
    >
      {content}
    </View>
  );
}

/**
 * "Not mine" on the left edge, "Approve" on the right, "Later" under the card. Each fills
 * toward its colour as the card moves its way, and swaps to the action icon once armed.
 */
export function EdgeCues(props: CueProps & { canApprove: boolean; cardTop: number }) {
  const tokens = useThemeTokens();
  const right = useCueStyles('right', props);
  const left = useCueStyles('left', props);
  const down = useCueStyles('down', props);
  const approveFill = props.canApprove ? tokens.mint : tokens.lemon;
  const sideTop = props.cardTop + props.height * 0.38;

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0"
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        className="absolute h-32 w-7"
        style={[{ right: 4, top: sideTop, transformOrigin: '100% 50%' }, right.wrap]}
      >
        <CueFace
          icon="arrow-right"
          label={props.canApprove ? 'Approve' : 'Pick a wallet'}
          fill={tokens.canvas}
          border={tokens.border}
          ink={tokens.muted}
          vertical="down"
        />
        <Animated.View
          className="absolute inset-0"
          style={right.on}
        >
          <CueFace
            icon={props.canApprove ? 'check' : 'wallet-outline'}
            label={props.canApprove ? 'Approve' : 'Pick a wallet'}
            fill={approveFill}
            border={approveFill}
            ink={tokens.onPastel}
            vertical="down"
          />
        </Animated.View>
      </Animated.View>

      <Animated.View
        className="absolute h-32 w-7"
        style={[{ left: 4, top: sideTop, transformOrigin: '0% 50%' }, left.wrap]}
      >
        <CueFace
          icon="arrow-left"
          label="Not mine"
          fill={tokens.canvas}
          border={tokens.border}
          ink={tokens.muted}
          vertical="up"
        />
        <Animated.View
          className="absolute inset-0"
          style={left.on}
        >
          <CueFace
            icon="close"
            label="Not mine"
            fill={tokens.primary}
            border={tokens.primary}
            ink={tokens.primaryForeground}
            vertical="up"
          />
        </Animated.View>
      </Animated.View>

      <View
        className="absolute inset-x-0 items-center"
        style={{ top: props.cardTop + props.height + 12 }}
      >
        <Animated.View
          className="h-8 w-[92px]"
          style={[{ transformOrigin: '50% 100%' }, down.wrap]}
        >
          <CueFace
            icon="arrow-down"
            label="Later"
            fill={tokens.canvas}
            border={tokens.border}
            ink={tokens.muted}
            vertical={null}
          />
          <Animated.View
            className="absolute inset-0"
            style={down.on}
          >
            <CueFace
              icon="clock-outline"
              label="Later"
              fill={tokens.lemon}
              border={tokens.lemon}
              ink={tokens.onPastel}
              vertical={null}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}
