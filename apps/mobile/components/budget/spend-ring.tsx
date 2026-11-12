import type { MinorAmount } from '@repo/types';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useUniwind } from 'uniwind';

import {
  arcPath,
  ringHit,
  ringPoint,
  ringSegments,
  type RingOptions,
} from '@/components/budget/ring-geometry';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { SpendSlice } from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';
import { scrubStep } from '@/lib/haptics';
import { springs } from '@/lib/motion/tokens';
import { tid } from '@/lib/test-ids';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

const SIZE = 284;
const CENTRE = SIZE / 2;
const RING = {
  radius: 124,
  strokeWidth: 34,
  gap: 10,
  minSweep: 2,
  maxSegments: 8,
} as const satisfies RingOptions;
const TAP_SLOP = 8;
const SELECTED_GROW = 4;
const DIMMED = 0.6;
const ICON = 20;
const ICON_BOX = 44;
const NUMBER_WIDTH = 186;
const FADE_MS = 180;
const NUMBER_FADE_MS = 140;

const hero = { fontSize: 46, lineHeight: 50, letterSpacing: -1.38 };
const heroPart = { fontSize: 18, letterSpacing: 0 };

// The tab can leave and come back; the ring sweeps in only the first time.
let sweptThisSession = false;

type RingArc = {
  key: string;
  name: string;
  /** Null draws the neutral arc: spending with no category, or the grouped remainder. */
  color: string | null;
  icon: IconSymbolName;
  amountMinor: number;
  share: number;
  start: number;
  sweep: number;
  /** The category names behind a grouped arc; empty for one category. */
  members: string[];
  /** Left the ring this month; it shrinks away and takes no touches. */
  gone: boolean;
};

function ringArcs(slices: readonly SpendSlice[]): RingArc[] {
  return ringSegments(
    slices.map((slice) => Number(slice.spentMinor)),
    RING,
  ).map((segment) => {
    const place = { share: segment.share, start: segment.start, sweep: segment.sweep, gone: false };
    if (segment.indexes.length > 1)
      return {
        ...place,
        key: 'other',
        name: 'Other',
        color: null,
        icon: 'dots-horizontal',
        amountMinor: segment.value,
        members: segment.indexes.map((index) => slices[index].name),
      };
    const slice = slices[segment.indexes[0]];
    return {
      ...place,
      key: slice.categoryId ?? 'none',
      name: slice.name,
      color: slice.color,
      icon: slice.categoryId
        ? resolveTransactionIcon(slice.icon, 'expense')
        : 'help-circle-outline',
      amountMinor: segment.value,
      members: [],
    };
  });
}

type Drawn = {
  source: RingArc[];
  /** The live arcs, then those leaving. */
  arcs: RingArc[];
  /** Arcs spring to their new places; otherwise they jump and the ring fades in. */
  morph: boolean;
  fade: boolean;
};

/**
 * Arcs that swap places would slide through each other, so a month that reorders the ring fades
 * instead, as Reduce Motion always does.
 */
function nextDrawn(drawn: Drawn, arcs: RingArc[], reduceMotion: boolean): Drawn {
  const live = drawn.arcs.filter((arc) => !arc.gone);
  const has = (list: RingArc[], key: string) => list.some((arc) => arc.key === key);
  const before = live.filter((arc) => has(arcs, arc.key));
  const after = arcs.filter((arc) => has(live, arc.key));
  const morph =
    !reduceMotion && before.every((arc, index) => arc.key === after[index].key);
  const leaving = live
    .filter((arc) => !has(arcs, arc.key))
    .map((arc) => ({ ...arc, gone: true }));
  return {
    source: arcs,
    arcs: morph ? [...arcs, ...leaving] : arcs,
    morph,
    fade: !morph,
  };
}

function arcLook(
  color: string | null,
  dark: boolean,
  tokens: ReturnType<typeof useThemeTokens>,
) {
  const neutral = dark ? tokens.inactive : tokens.hairline;
  return { fill: color ?? neutral, glyph: tokens.onCategory };
}

type ArcProps = {
  arc: RingArc;
  morph: boolean;
  fan: boolean;
  selected: boolean;
  dimmed: boolean;
};

function useArcMotion({ arc, morph, fan, dimmed }: ArcProps) {
  const start = useSharedValue(morph && fan ? 0 : arc.start);
  const sweep = useSharedValue(morph ? 0 : arc.sweep);
  const presence = useSharedValue(morph ? 0 : 1);

  useEffect(() => {
    const to = (value: number) =>
      morph ? withSpring(value, springs.value) : value;
    start.set(to(arc.start));
    sweep.set(to(arc.gone ? 0 : arc.sweep));
  }, [arc.start, arc.sweep, arc.gone, morph, start, sweep]);

  useEffect(() => {
    presence.set(
      withSpring(arc.gone ? 0 : dimmed ? DIMMED : 1, springs.press),
    );
  }, [arc.gone, dimmed, presence]);

  return { start, sweep, presence };
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

function ArcStroke(props: ArcProps & { fill: string }) {
  const { fill, selected } = props;
  const { start, sweep, presence } = useArcMotion(props);
  const width = useSharedValue<number>(RING.strokeWidth);

  useEffect(() => {
    width.set(
      withSpring(
        selected ? RING.strokeWidth + SELECTED_GROW : RING.strokeWidth,
        springs.press,
      ),
    );
  }, [selected, width]);

  const animatedProps = useAnimatedProps(() => ({
    d: arcPath(
      CENTRE,
      RING.radius,
      start.get(),
      Math.max(0.01, sweep.get()),
    ),
    strokeWidth: width.get(),
    opacity: presence.get(),
  }));

  return (
    <AnimatedPath
      fill="none"
      stroke={fill}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
}

function ArcIcon(
  props: ArcProps & {
    glyph: string;
    onActivate: () => void;
    amount: string;
    shareWords: string;
  },
) {
  const { arc, glyph, selected, onActivate, amount, shareWords } = props;
  const { start, sweep, presence } = useArcMotion(props);

  const style = useAnimatedStyle(() => {
    const at = ringPoint(
      CENTRE,
      RING.radius,
      start.get() + sweep.get() / 2,
    );
    return {
      opacity: presence.get(),
      transform: [
        { translateX: at.x - ICON_BOX / 2 },
        { translateY: at.y - ICON_BOX / 2 },
      ],
    };
  });

  const within = arc.members.length
    ? `, ${arc.members.join(', ')}`
    : '';
  return (
    <Animated.View
      testID={arc.gone ? undefined : tid('budget', 'slice', arc.name)}
      collapsable={false}
      accessible={!arc.gone}
      accessibilityElementsHidden={arc.gone}
      importantForAccessibility={arc.gone ? 'no-hide-descendants' : 'yes'}
      accessibilityRole="button"
      accessibilityLabel={`${arc.name}${within}, ${amount}, ${shareWords}`}
      accessibilityState={{ selected }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={onActivate}
      className="absolute left-0 top-0 items-center justify-center"
      style={[{ width: ICON_BOX, height: ICON_BOX }, style]}
    >
      <IconSymbol
        name={arc.icon}
        size={ICON}
        color={glyph}
      />
    </Animated.View>
  );
}

/** "RM1,116.20" as a quiet symbol, big digits, quiet cents. */
function RingAmount({
  testID,
  text,
  whole,
}: {
  testID?: ReturnType<typeof tid>;
  text: string;
  whole: boolean;
}) {
  const parts = /^([^\d]*)([\d,]+)(\.\d+)?$/.exec(text);
  const quiet = 'font-display-bold text-muted';
  return (
    <Text
      testID={testID}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      maxFontSizeMultiplier={1.2}
      className="text-center font-display-bold text-foreground"
      style={[hero, { width: NUMBER_WIDTH }]}
    >
      {parts ? (
        <>
          <Text className={quiet} style={heroPart}>
            {parts[1]}
          </Text>
          {parts[2]}
          {!whole && parts[3] ? (
            <Text className={quiet} style={heroPart}>
              {parts[3]}
            </Text>
          ) : null}
        </>
      ) : (
        text
      )}
    </Text>
  );
}

/** "31% of spending", without a tiny share rounding to none or a big one to all of it. */
export function shareOfSpending(share: number): string {
  if (share > 0 && share < 0.01) return 'Under 1% of spending';
  if (share < 1 && share > 0.99) return 'Over 99% of spending';
  return `${Math.round(share * 100)}% of spending`;
}

type SpendRingProps = {
  slices: readonly SpendSlice[];
  /** The month's spending, the same total the rest of the tab shows. */
  totalMinor: MinorAmount;
  budgetMinor: MinorAmount | null;
  currency: string;
  month: string;
  monthName: string;
};

/**
 * The month's spending by category: separate round-capped arcs round the total, biggest first.
 * Tap an arc to read it in the middle; tap it again, or the middle, for the total.
 */
export function SpendRing({
  slices,
  totalMinor,
  budgetMinor,
  currency,
  month,
  monthName,
}: SpendRingProps) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  const reduceMotion = useReducedMotion();
  const arcs = useMemo(() => ringArcs(slices), [slices]);
  const [drawn, setDrawn] = useState<Drawn>(() => {
    const entering = !sweptThisSession;
    return {
      source: arcs,
      arcs,
      morph: entering && !reduceMotion,
      fade: entering && reduceMotion,
    };
  });
  if (drawn.source !== arcs) setDrawn(nextDrawn(drawn, arcs, reduceMotion));

  const fan = !sweptThisSession;
  useEffect(() => {
    if (arcs.length) sweptThisSession = true;
  }, [arcs.length]);

  const opacity = useSharedValue(drawn.fade ? 0 : 1);
  useEffect(() => {
    if (!drawn.fade) return;
    opacity.set(0);
    opacity.set(
      withTiming(1, { duration: FADE_MS, reduceMotion: ReduceMotion.Never }),
    );
  }, [drawn, opacity]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  const [picked, setPicked] = useState<{ month: string; key: string } | null>(
    null,
  );
  const selected =
    picked?.month === month
      ? (arcs.find((arc) => arc.key === picked.key) ?? null)
      : null;

  const toggle = (key: string) => {
    scrubStep();
    setPicked(selected?.key === key ? null : { month, key });
  };
  const backToTotal = () => {
    if (!selected) return;
    scrubStep();
    setPicked(null);
  };

  const tap = Gesture.Tap()
    .withTestId('budget.spend-ring.tap')
    .runOnJS(true)
    .onEnd((event, success) => {
      if (!success) return;
      const hit = ringHit(arcs, event.x - CENTRE, event.y - CENTRE, {
        radius: RING.radius,
        strokeWidth: RING.strokeWidth,
        slop: TAP_SLOP,
      });
      if (hit?.kind === 'centre') backToTotal();
      else if (hit) toggle(arcs[hit.index].key);
    });

  const [width, setWidth] = useState(SIZE);
  const scale = Math.min(1, width / SIZE);

  const total = formatMoney(totalMinor, currency);
  const spentNothing = Number(totalMinor) === 0;
  const budgetWords =
    budgetMinor === null
      ? null
      : `of ${formatMoney(budgetMinor, currency, { whole: true })}`;
  const overMinor =
    budgetMinor === null ? 0 : Number(totalMinor) - Number(budgetMinor);
  const overWords =
    overMinor > 0
      ? `${formatMoney(overMinor, currency, { whole: true })} over`
      : null;

  return (
    <View
      testID={tid('budget', 'spend-ring')}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className="items-center justify-center"
      style={{ height: SIZE * scale }}
    >
      <GestureDetector gesture={tap}>
        <View
          collapsable={false}
          style={{
            width: SIZE,
            height: SIZE,
            transform: [{ scale }],
          }}
        >
          <Animated.View
            className="absolute inset-0"
            style={ringStyle}
          >
            <Svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              style={{ position: 'absolute' }}
            >
              {arcs.length ? null : (
                <Circle
                  cx={CENTRE}
                  cy={CENTRE}
                  r={RING.radius}
                  fill="none"
                  stroke={tokens.sand}
                  strokeWidth={RING.strokeWidth}
                />
              )}
              {drawn.arcs.map((arc) => (
                <ArcStroke
                  key={arc.key}
                  arc={arc}
                  fill={arcLook(arc.color, dark, tokens).fill}
                  morph={drawn.morph}
                  fan={fan}
                  selected={selected?.key === arc.key}
                  dimmed={selected !== null && selected.key !== arc.key}
                />
              ))}
            </Svg>
            {drawn.arcs.map((arc) => (
              <ArcIcon
                key={arc.key}
                arc={arc}
                glyph={arcLook(arc.color, dark, tokens).glyph}
                morph={drawn.morph}
                fan={fan}
                selected={selected?.key === arc.key}
                dimmed={selected !== null && selected.key !== arc.key}
                amount={formatMoney(arc.amountMinor, currency)}
                shareWords={shareOfSpending(arc.share)}
                onActivate={() => toggle(arc.key)}
              />
            ))}
          </Animated.View>
          <View
            pointerEvents="box-none"
            className="absolute inset-0 items-center justify-center"
          >
            {selected ? (
              <Animated.View
                key={`${month}:${selected.key}`}
                testID={tid('budget', 'spend-ring', 'selected')}
                collapsable={false}
                entering={FadeIn.duration(NUMBER_FADE_MS)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${selected.name}, ${formatMoney(selected.amountMinor, currency)}, ${shareOfSpending(selected.share)}`}
                accessibilityHint="Shows the month's total"
                accessibilityActions={[{ name: 'activate' }]}
                onAccessibilityAction={backToTotal}
                className="items-center"
              >
                <RingAmount
                  text={formatMoney(selected.amountMinor, currency)}
                  whole={false}
                />
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  className="text-[15px] leading-[21px] font-display-semibold text-foreground"
                  style={{ maxWidth: NUMBER_WIDTH }}
                >
                  {selected.name}
                </Text>
                <Text
                  variant="meta"
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  className="text-muted"
                  style={{ maxWidth: NUMBER_WIDTH }}
                >
                  {selected.members.length
                    ? `${selected.members.length} categories · ${Math.max(1, Math.round(selected.share * 100))}%`
                    : shareOfSpending(selected.share)}
                </Text>
              </Animated.View>
            ) : (
              <Animated.View
                key={month}
                collapsable={false}
                entering={FadeIn.duration(NUMBER_FADE_MS)}
                accessible
                accessibilityLabel={`Spent in ${monthName}, ${total}${budgetWords ? ` ${budgetWords}` : ''}${overWords ? `, ${overWords}` : ''}`}
                className="items-center"
              >
                <RingAmount
                  testID={tid('budget', 'spend-ring', 'total')}
                  text={spentNothing ? formatMoney(0, currency, { whole: true }) : total}
                  whole={spentNothing}
                />
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                  className={`text-[13px] leading-[18px] ${overWords ? 'font-display-bold text-over' : 'text-muted'}`}
                >
                  {overWords ?? budgetWords ?? 'spent'}
                </Text>
              </Animated.View>
            )}
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
