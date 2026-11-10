import { View, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
  type AnimatedStyle,
} from 'react-native-reanimated';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  selectionReach,
  type SwipeRoom,
  type SwipeSelection,
  type SwipeSide,
} from '@/lib/proposals/review-card-state';

const SIDE_WIDTH = 28;
const SIDE_LENGTH = 128;
const LATER_GAP = 12;
const LATER_HEIGHT = 32;
/** What the Later cue needs under a card, so the deck can keep it clear. */
export const LATER_ROOM = LATER_GAP + LATER_HEIGHT;
/** Past this much fill the label switches to the ink that reads on the action colour. */
const INK_SWITCH = 0.55;

type CueProps = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** The one answer to which side is lit, so a cue can't disagree with the card. */
  selection: SharedValue<SwipeSelection>;
  room: SharedValue<SwipeRoom>;
  width: number;
  height: number;
  canApprove: boolean;
};

type Look = { canvas: string; border: string; hex: string };

/**
 * `XA-Review` hintVals: `p` is how far toward this side's threshold the card is, `on` that the
 * decision is armed, `full` that the cue shows its action (armed, or Approve blocked on a wallet).
 */
function useCue(
  side: SwipeSide,
  { x, y, selection, room, width, height, canApprove }: CueProps,
  look: Look,
) {
  const read = () => {
    'worklet';
    const dy = y.get();
    const current = selection.get();
    const reach = selectionReach(current, { dx: x.get(), dy, width, height, room: room.get() });
    const mine = current?.side === side;
    const p = mine ? reach : 0;
    const full = mine && current.engaged;
    const on = full && (side !== 'right' || canApprove);
    return { dimmed: !mine && reach > 0, mine, p, on, full, fill: full ? 1 : 0.8 * p, dy };
  };

  const wrap = useAnimatedStyle(() => {
    const cue = read();
    return {
      opacity: cue.dimmed ? 0.3 : 1,
      transform: [
        ...(side === 'down' ? [{ translateY: cue.mine ? Math.max(0, cue.dy) * 0.5 : 0 }] : []),
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
  style: AnimatedStyle<ViewStyle>;
}) {
  return (
    <Animated.View
      className={`${vertical === 'up' ? 'flex-row-reverse' : 'flex-row'} items-center justify-center gap-1.5 ${vertical ? '' : sizer ? 'h-full pl-2.5 pr-3.5' : 'absolute inset-0'}`}
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
      {/* The rail turns its label, and the arrow stays upright at the top so it points the way to swipe. */}
      <View style={vertical ? { transform: [{ rotate: vertical === 'down' ? '-90deg' : '90deg' }] } : undefined}>
        <IconSymbol
          name={icon}
          size={18}
          color={ink}
        />
      </View>
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
  side: SwipeSide;
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
export function EdgeCues(props: CueProps & { centerY: number }) {
  const tokens = useThemeTokens();
  const base = { canvas: tokens.canvas, border: tokens.border };
  const sideTop = props.centerY - SIDE_LENGTH / 2;
  const laterTop = props.centerY + props.height / 2 + LATER_GAP;

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
        style={{ top: laterTop }}
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
