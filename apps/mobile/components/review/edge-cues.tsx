import { View, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
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
/** Past this much fill the label switches to the ink that reads on the action colour. */
const INK_SWITCH = 0.55;

type CueProps = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  intent: SharedValue<SwipeIntent>;
  width: number;
  height: number;
};

type Look = { canvas: string; border: string; hex: string };

/** Which way the card is being dragged, from its offset alone. */
function towardOf(dx: number, dy: number): Side | null {
  'worklet';
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : dx < 0 ? 'left' : null;
  return dy > 0 ? 'down' : null;
}

/**
 * `XA-Review` hintVals: `p` is how far toward this side's threshold the card is, `on` that the
 * decision is armed, `full` that the cue shows its action (armed, or Approve blocked on a wallet).
 */
function useCue(side: Side, { x, y, intent, width, height }: CueProps, look: Look) {
  const read = () => {
    'worklet';
    const dx = x.get();
    const dy = y.get();
    const toward = towardOf(dx, dy);
    const reach =
      toward !== side
        ? 0
        : side === 'down'
          ? dy / (height * FLING_COMMIT_THRESHOLD)
          : Math.abs(dx) / (width * FLING_COMMIT_THRESHOLD);
    const p = Math.min(1, Math.max(0, reach));
    const now = intent.get();
    const on =
      side === 'right' ? now === 'approve' : side === 'left' ? now === 'notMine' : now === 'later';
    const full = on || (side === 'right' && now === 'needsWallet');
    return { toward, p, on, full, fill: full ? 1 : 0.8 * p, dy };
  };

  const wrap = useAnimatedStyle(() => {
    const cue = read();
    return {
      opacity: cue.toward && cue.toward !== side ? 0.3 : 1,
      transform: [
        ...(side === 'down' ? [{ translateY: cue.toward === 'down' ? cue.dy * 0.5 : 0 }] : []),
        { scale: cue.on ? 1.3 : 1 + 0.18 * cue.p },
      ],
    };
  });
  const face = useAnimatedStyle(() => {
    const cue = read();
    return {
      backgroundColor: interpolateColor(cue.fill, [0, 1], [look.canvas, look.hex]),
      borderColor: interpolateColor(cue.full ? 1 : cue.p, [0, 1], [look.border, look.hex]),
    };
  });
  const rest = useAnimatedStyle(() => {
    const cue = read();
    return { opacity: cue.p === 0 && !cue.full ? 1 : 0 };
  });
  const moving = useAnimatedStyle(() => {
    const cue = read();
    return { opacity: cue.p > 0 && !cue.full && cue.fill < INK_SWITCH ? 1 : 0 };
  });
  const movingOn = useAnimatedStyle(() => {
    const cue = read();
    return { opacity: !cue.full && cue.fill >= INK_SWITCH ? 1 : 0 };
  });
  const full = useAnimatedStyle(() => ({ opacity: read().full ? 1 : 0 }));
  return { wrap, face, layers: { rest, moving, movingOn, full } };
}

function CueContent({
  icon,
  label,
  ink,
  vertical,
  sizer,
  style,
}: {
  icon: IconSymbolName;
  label: string;
  ink: string;
  vertical: 'up' | 'down' | null;
  /** The one layer that sets the down cue's width; the others sit over it. */
  sizer: boolean;
  style: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <Animated.View
      className={`flex-row items-center justify-center gap-1.5 ${vertical ? '' : sizer ? 'h-full pl-2.5 pr-3.5' : 'absolute inset-0'}`}
      style={[
        vertical
          ? {
              position: 'absolute',
              width: SIDE_LENGTH,
              height: SIDE_WIDTH,
              left: (SIDE_WIDTH - SIDE_LENGTH) / 2,
              top: (SIDE_LENGTH - SIDE_WIDTH) / 2,
              transform: [{ rotate: vertical === 'down' ? '90deg' : '-90deg' }],
            }
          : undefined,
        style,
      ]}
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
    </Animated.View>
  );
}

function Cue({
  side,
  position,
  props,
  look,
  arrow,
  action,
  label,
  onInk,
}: {
  side: Side;
  /** Where the cue sits and the edge it grows from. */
  position: ViewStyle;
  props: CueProps;
  look: Look;
  arrow: IconSymbolName;
  action: IconSymbolName;
  label: string;
  /** Label colour once the cue has filled with its action colour. */
  onInk: string;
}) {
  const tokens = useThemeTokens();
  const cue = useCue(side, props, look);
  const vertical = side === 'right' ? 'down' : side === 'left' ? 'up' : null;
  const layers = [
    { key: 'rest', icon: arrow, ink: tokens.muted, style: cue.layers.rest },
    { key: 'moving', icon: arrow, ink: tokens.foreground, style: cue.layers.moving },
    { key: 'movingOn', icon: arrow, ink: onInk, style: cue.layers.movingOn },
    { key: 'full', icon: action, ink: onInk, style: cue.layers.full },
  ] as const;
  return (
    <Animated.View style={[position, cue.wrap]}>
      <Animated.View
        className={`rounded-full border-[1.5px] ${vertical ? 'h-32 w-7' : 'h-8'}`}
        style={cue.face}
      >
        {layers.map((layer, i) => (
          <CueContent
            key={layer.key}
            icon={layer.icon}
            label={label}
            ink={layer.ink}
            vertical={vertical}
            sizer={i === 0}
            style={layer.style}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * "Not mine" on the left edge, "Approve" on the right, "Later" under the card, as `XA-Review`
 * draws them: each fills toward its colour as the card moves its way and swaps its arrow for
 * the action icon once armed.
 */
export function EdgeCues(props: CueProps & { canApprove: boolean; cardTop: number }) {
  const tokens = useThemeTokens();
  const base = { canvas: tokens.canvas, border: tokens.border };
  const sideTop = props.cardTop + props.height / 2 - SIDE_LENGTH / 2;

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0"
      importantForAccessibility="no-hide-descendants"
    >
      <Cue
        side="right"
        position={{ position: 'absolute', right: 4, top: sideTop, transformOrigin: '100% 50%' }}
        props={props}
        look={{ ...base, hex: props.canApprove ? tokens.mint : tokens.lemon }}
        arrow="arrow-right"
        action={props.canApprove ? 'check' : 'wallet-outline'}
        label={props.canApprove ? 'Approve' : 'Pick wallet'}
        onInk={tokens.onPastel}
      />
      <Cue
        side="left"
        position={{ position: 'absolute', left: 4, top: sideTop, transformOrigin: '0% 50%' }}
        props={props}
        look={{ ...base, hex: tokens.primary }}
        arrow="arrow-left"
        action="close"
        label="Not mine"
        onInk={tokens.primaryForeground}
      />
      <View
        className="absolute inset-x-0 items-center"
        style={{ top: props.cardTop + props.height + 12 }}
      >
        <Cue
          side="down"
          position={{ transformOrigin: '50% 100%' }}
          props={props}
          look={{ ...base, hex: tokens.lemon }}
          arrow="arrow-down"
          action="clock-outline"
          label="Later"
          onInk={tokens.onPastel}
        />
      </View>
    </View>
  );
}
