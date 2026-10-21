import { View } from 'react-native';

import { monthName } from '@/components/charts/pace-geometry';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import { formatMoney } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';

import { debtPhrase, type SpentSummary } from './spent-summary';

function dueWhen(dueDate: string, now: Date): string {
  const due = parseLocalDateInput(dueDate);
  if (!due) return `on ${dueDate}`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `on ${formatDate(due, now)}`;
}

/** The next bill due and what is set aside for the rest of the month (D1 names debts due here). */
export function BillsStrip({
  summary,
  currency,
  now,
  onPress,
}: {
  summary: SpentSummary;
  currency: string;
  now: Date;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const next = summary.bills[0];
  if (!next) return null;
  const count = summary.bills.length;
  const lastDay = new Date(summary.month.year, summary.month.month + 1, 0);
  const debts = debtPhrase(summary.debtsDue, currency);
  const headline = `${next.name} ${formatMoney(next.amountMinor, currency)} is due ${dueWhen(next.dueDate, now)}`;
  const detail = debts
    ? `${formatMoney(summary.billsMinor + summary.debtsMinor, currency)} set aside for bills and ${debts}`
    : `${count} ${count === 1 ? 'bill' : 'bills'}, ${formatMoney(summary.billsMinor, currency)} by ${lastDay.getDate()} ${monthName(summary.month).slice(0, 3)}, already set aside`;

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
