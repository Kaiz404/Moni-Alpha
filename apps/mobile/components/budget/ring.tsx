import type { MinorAmount } from '@repo/types';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useUniwind } from 'uniwind';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import { springs } from '@/lib/motion/tokens';
import type { TestId } from '@/lib/test-ids';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const BOX = 44;
const STROKE = 5;
const RADIUS = (BOX - STROKE) / 2 - 0.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const NEAR_LIMIT = 0.75;

export type RingTone = 'plain' | 'near' | 'over' | 'unbudgeted';

/** The two-line label under a ring, its sweep from 0 to 1, and how to colour it. */
export function ringState(
  spentMinor: MinorAmount,
  budgetMinor: MinorAmount | null,
  currency: string,
): { amount: string; word: string; sweep: number; tone: RingTone } {
  if (budgetMinor === null || budgetMinor <= 0)
    return {
      amount: formatMoney(spentMinor, currency),
      word: 'spent',
      sweep: 0,
      tone: 'unbudgeted',
    };
  const left = budgetMinor - spentMinor;
  if (left < 0)
    return {
      amount: formatMoney(-left, currency, { whole: true }),
      word: 'over',
      sweep: 1,
      tone: 'over',
    };
  const sweep = spentMinor / budgetMinor;
  return {
    amount: formatMoney(left, currency, { whole: true }),
    word: 'left',
    sweep,
    tone: sweep >= NEAR_LIMIT ? 'near' : 'plain',
  };
}

const amountClass: Record<RingTone, string> = {
  plain: 'text-foreground',
  near: 'text-state-attention',
  over: 'text-over',
  unbudgeted: 'text-foreground',
};

type RingProps = {
  testID: TestId;
  name: string;
  icon: string | null;
  color: string | null;
  spentMinor: MinorAmount;
  budgetMinor: MinorAmount | null;
  currency: string;
  onPress: () => void;
};

/**
 * One budget on the Budget tab root: a 44 ring with stroke 5, Sand track, and
 * an Ink 2 fill from 12 o'clock on the `value` spring, the category bubble
 * inside, and what is left under it. Over budget is a full Coral ring.
 */
export function Ring({
  testID,
  name,
  icon,
  color,
  spentMinor,
  budgetMinor,
  currency,
  onPress,
}: RingProps) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  const state = ringState(spentMinor, budgetMinor, currency);
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.set(withSpring(state.sweep, springs.value));
  }, [state.sweep, sweep]);

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, sweep.get()))),
  }));

  const spent = formatMoney(spentMinor, currency);
  const label =
    state.tone === 'unbudgeted'
      ? `${name}, ${spent} spent, no budget yet`
      : `${name}, ${spent} of ${formatMoney(budgetMinor ?? 0, currency, { whole: true })}, ${state.amount} ${state.word}`;

  return (
    <Press
      testID={testID}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(state.sweep * 100) }}
      className="min-h-[78px] items-center gap-1 rounded-field pt-0.5"
    >
      <View style={{ width: BOX, height: BOX }}>
        <Svg
          width={BOX}
          height={BOX}
          viewBox={`0 0 ${BOX} ${BOX}`}
          style={{ position: 'absolute' }}
        >
          <Circle
            cx={BOX / 2}
            cy={BOX / 2}
            r={16}
            fill={color ? `${color}${dark ? '38' : '73'}` : tokens.sand}
          />
          {state.tone === 'unbudgeted' ? (
            <Circle
              cx={BOX / 2}
              cy={BOX / 2}
              r={RADIUS}
              fill="none"
              stroke={tokens.hairline}
              strokeWidth={2}
              strokeDasharray="3 4"
            />
          ) : (
            <>
              <Circle
                cx={BOX / 2}
                cy={BOX / 2}
                r={RADIUS}
                fill="none"
                stroke={tokens.track}
                strokeWidth={STROKE}
              />
              <AnimatedCircle
                cx={BOX / 2}
                cy={BOX / 2}
                r={RADIUS}
                fill="none"
                stroke={state.tone === 'over' ? tokens.coral : tokens.ink2}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                animatedProps={arc}
                transform={`rotate(-90 ${BOX / 2} ${BOX / 2})`}
              />
            </>
          )}
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          <IconSymbol
            name={resolveTransactionIcon(icon, 'expense')}
            size={18}
            color={color && dark ? color : tokens.foreground}
          />
        </View>
      </View>
      <View className="items-center">
        <Text
          className={`text-[12px] leading-4 font-display-bold ${amountClass[state.tone]}`}
          style={{ fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
        >
          {state.amount}
        </Text>
        <Text
          className={`text-[12px] leading-[14px] ${state.tone === 'over' ? 'text-over' : 'text-muted'}`}
        >
          {state.word}
        </Text>
      </View>
    </Press>
  );
}
