import { View } from 'react-native';

import { monthFromKey, monthName } from '@/components/charts/pace-geometry';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';

import type { BudgetMonth } from '@/lib/finance/budget-month';
import { debtPhrase, dueWhen } from '@/lib/finance/spent-summary';

/** The next bill due and what is set aside for the rest of the month (D1 names debts due here). */
export function BillsStrip({
  month,
  currency,
  now,
  onPress,
}: {
  month: BudgetMonth;
  currency: string;
  now: Date;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const next = month.billsDue[0];
  if (!next) return null;
  const count = month.billsDue.length;
  const billsMinor = month.billsDue.reduce((sum, bill) => sum + Number(bill.amountMinor), 0);
  const debtsDue = month.left?.debtsDue ?? [];
  const debtsMinor = debtsDue.reduce((sum, debt) => sum + Number(debt.amountMinor), 0);
  const debts = debtPhrase(debtsDue, currency);
  const headline = `${next.name} ${formatMoney(next.amountMinor, currency)} is due ${dueWhen(next.dueDate, now)}`;
  const detail = debts
    ? `${formatMoney(billsMinor + debtsMinor, currency)} set aside for bills and ${debts}`
    : `${count} ${count === 1 ? 'bill' : 'bills'}, ${formatMoney(billsMinor, currency)} by ${month.daysInMonth} ${monthName(monthFromKey(month.month)).slice(0, 3)}, already set aside`;

  return (
    <Press
      testID={tid('home', 'bills')}
      accessibilityLabel={`${headline}. ${detail}`}
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-3 rounded-tile border-[1.5px] border-hairline py-3 pl-[18px] pr-3"
    >
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
        >
          {headline}
        </Text>
        <Text
          testID={tid('home', 'bills', 'detail')}
          variant="meta"
          className="text-muted"
        >
          {detail}
        </Text>
      </View>
      <IconSymbol
        name="chevron-right"
        size={20}
        color={tokens.muted}
      />
    </Press>
  );
}
