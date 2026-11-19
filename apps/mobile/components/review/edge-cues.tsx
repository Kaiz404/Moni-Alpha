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
/** Past this much fill the label switches to the ink that reads on the action colour. */
const INK_SWITCH = 0.55;

type CueProps = {
  x: SharedValue<number>;
  /** The one answer to which side is lit, so a cue can't disagree with the card. */
  selection: SharedValue<SwipeSelection>;
  room: SharedValue<SwipeRoom>;
  width: number;
  canApprove: boolean;
};

type Look = { canvas: string; border: string; hex: string };

/**
 * `XA-Review` hintVals: `p` is how far toward this side's threshold the card is, `on` that the
 * decision is armed, `full` that the cue shows its action (armed, or Approve blocked on a wallet).
 */
function useCue(
  side: SwipeSide,
  { x, selection, room, width, canApprove }: CueProps,
  look: Look,
) {
  const read = () => {
    'worklet';
    const current = selection.get();
    const reach = selectionReach(current, { dx: x.get(), width, room: room.get() });
    const mine = current?.side === side;
    const p = mine ? reach : 0;
    const full = mine && current.engaged;
    const on = full && (side !== 'right' || canApprove);
    return { dimmed: !mine && reach > 0, p, on, full, fill: full ? 1 : 0.8 * p };
  };

  const wrap = useAnimatedStyle(() => {
    const cue = read();
    return {
      opacity: cue.dimmed ? 0.3 : 1,
      transform: [{ scale: cue.on ? 1.3 : 1 + 0.18 * cue.p }],
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
  style,
}: {
  icon: IconSymbolName;
  label: string;
  ink: string;
  vertical: 'up' | 'down';
  style: AnimatedStyle<ViewStyle>;
}) {
  return (
    <Animated.View
      className={`${vertical === 'up' ? 'flex-row-reverse' : 'flex-row'} items-center justify-center gap-1.5`}
      style={[
        {
          position: 'absolute',
          width: SIDE_LENGTH,
          height: SIDE_WIDTH,
          left: (SIDE_WIDTH - SIDE_LENGTH) / 2,
          top: (SIDE_LENGTH - SIDE_WIDTH) / 2,
          transform: [{ rotate: vertical === 'down' ? '90deg' : '-90deg' }],
        },
        style,
      ]}
    >
      {/* The rail turns its label, and the arrow stays upright at the top so it points the way to swipe. */}
      <View style={{ transform: [{ rotate: vertical === 'down' ? '-90deg' : '90deg' }] }}>
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
  const vertical = side === 'right' ? 'down' : 'up';
  const layers = [
    { key: 'rest', icon: arrow, ink: tokens.muted, style: cue.layers.rest },
    { key: 'moving', icon: arrow, ink: tokens.foreground, style: cue.layers.moving },
    { key: 'movingOn', icon: arrow, ink: onInk, style: cue.layers.movingOn },
    { key: 'full', icon: action, ink: onInk, style: cue.layers.full },
  ] as const;
  return (
    <Animated.View style={[position, cue.wrap]}>
      <Animated.View
        className="h-32 w-7 rounded-full border-[1.5px]"
        style={cue.face}
      >
        {layers.map((layer) => (
          <CueContent
            key={layer.key}
            icon={layer.icon}
            label={label}
            ink={layer.ink}
            vertical={vertical}
            style={layer.style}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * "Not mine" on the left edge and "Approve" on the right, as `XA-Review` draws them: each fills
 * toward its colour as the card moves its way and swaps its arrow for the action icon once armed.
 */
export function EdgeCues(props: CueProps & { centerY: number }) {
  const tokens = useThemeTokens();
  const base = { canvas: tokens.canvas, border: tokens.border };
  const sideTop = props.centerY - SIDE_LENGTH / 2;

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
        onInk={tokens.onCategory}
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
    </View>
  );
}
