import { View } from 'react-native';

import { useBudgetData, useBudgetMonth } from '@/components/budget/use-budget';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { monthKey } from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';

/**
 * Safe to spend a day before and after this session's approvals: "RM24 → RM23" over
 * "RM420 left for 18 days after these.", or null without a budget or anything left.
 */
function useSafeToSpend(addedMinor: number) {
  const data = useBudgetData();
  const { left } = useBudgetMonth(data, monthKey(data.now));
  if (!left || left.leftMinor <= 0) return null;
  const whole = (minor: number) => formatMoney(minor, data.currency, { whole: true });
  const before = Math.floor((left.leftMinor + addedMinor) / left.daysLeft / 100) * 100;
  const days = `${left.daysLeft} ${left.daysLeft === 1 ? 'day' : 'days'}`;
  return {
    line:
      before === left.perDayMinor
        ? whole(left.perDayMinor)
        : `${whole(before)} → ${whole(left.perDayMinor)}`,
    sentence: `${whole(left.leftMinor)} left for ${days}${addedMinor > 0 ? ' after these' : ''}.`,
  };
}

export function CaughtUp({
  sentence,
  addedMinor,
}: {
  sentence: string;
  /** Main-currency spending this session approved, for the safe to spend a day change. */
  addedMinor: number;
}) {
  const tokens = useThemeTokens();
  const safe = useSafeToSpend(addedMinor);
  return (
    <View
      testID={tid('review', 'caught-up')}
      className="gap-3.5 rounded-card bg-block-mint px-[18px] py-[22px]"
    >
      <View className="h-16 w-16 items-center justify-center rounded-full bg-primary">
        <IconSymbol
          name="check-all"
          size={34}
          color={tokens.primaryForeground}
        />
      </View>
      <View className="gap-1">
        <Text
          variant="screenTitle"
          className="text-on-pastel"
          accessibilityRole="header"
        >
          All caught up
        </Text>
        <Text
          variant="body"
          className="text-on-pastel"
        >
          {sentence}
        </Text>
      </View>
      {safe ? (
        <View
          testID={tid('review', 'safe-to-spend')}
          className="gap-0.5"
        >
          <Text
            variant="caps"
            className="text-on-pastel"
          >
            Safe to spend a day
          </Text>
          <Text className="text-[34px] leading-[40px] font-display-bold text-on-pastel">
            {safe.line}
          </Text>
          <Text
            variant="meta"
            className="text-on-pastel"
          >
            {safe.sentence}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Opened with nothing waiting. */
export function NothingToReview() {
  const tokens = useThemeTokens();
  return (
    <View
      testID={tid('review', 'empty')}
      className="gap-3.5 rounded-card border-[1.5px] border-dashed border-hairline px-[22px] py-7"
    >
      <View className="h-16 w-16 items-center justify-center rounded-full bg-sand">
        <IconSymbol
          name="check-all"
          size={30}
          color={tokens.foreground}
        />
      </View>
      <Text
        variant="screenTitle"
        className="text-foreground"
        accessibilityRole="header"
      >
        Nothing to review
      </Text>
      <Text
        variant="body"
        className="text-ink-2"
      >
        Bank alerts and Moni chat entries land here until you decide. Routine ones are added for
        you and marked Auto.
      </Text>
    </View>
  );
}
