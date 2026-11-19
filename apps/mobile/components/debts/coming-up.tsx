import { router } from 'expo-router';
import { View } from 'react-native';

import { debtMoney } from '@/components/debts/debt-words';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';
import { type ComingUpRow, dayOfMonth, dueWords, parseDayKey, weekdayShort } from '@repo/core';

/** The Lemon block of debts with a due date; each row opens its debt, where the actions live. */
export function ComingUp({ rows }: { rows: ComingUpRow[] }) {
  if (rows.length === 0) return null;
  return (
    <View
      accessibilityLabel="Coming up"
      className="rounded-card bg-block-lemon pb-2 pl-[18px] pr-3.5 pt-3.5"
    >
      <View className="min-h-[18px] justify-center pb-1">
        <Text
          variant="caps"
          className="text-on-pastel"
          accessibilityRole="header"
        >
          Coming up
        </Text>
      </View>
      {rows.map((row) => (
        <Row
          key={row.line.debt.id}
          row={row}
        />
      ))}
    </View>
  );
}

function Row({ row }: { row: ComingUpRow }) {
  const tokens = useThemeTokens();
  const { line, dueDate, daysLeft } = row;
  const {
    id,
    counterpartyName: name,
    direction,
    note,
    currency,
  } = line.debt;
  const due = parseDayKey(dueDate);
  const amount = debtMoney(line.balanceMinor, currency);
  const title =
    direction === 'i_owe'
      ? `Pay ${name} ${amount}`
      : `${name} pays ${amount}`;
  const meta = [dueWords(daysLeft), note].filter(Boolean).join(', ');
  return (
    <Press
      testID={tid('debts', 'coming-up', id)}
      accessibilityLabel={`${title}, ${meta}`}
      pressedClassName="bg-sand-light"
      radius={{ rest: 16, pressed: 16 }}
      className="-ml-2 min-h-[60px] flex-row items-center gap-3 py-1.5 pl-2"
      onPress={() =>
        router.push({ pathname: '/debt/[id]', params: { id } })
      }
    >
      <View className="h-[46px] w-11 items-center justify-center rounded-[14px] bg-card">
        <Text className="text-[12px] leading-[14px] font-display-bold tracking-[0.48px] text-ink-2">
          {due ? weekdayShort(due).toUpperCase() : ''}
        </Text>
        <Text className="text-[18px] leading-[20px] font-display-bold text-foreground">
          {due ? dayOfMonth(due) : ''}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-on-pastel"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          variant="meta"
          className="text-on-pastel opacity-80"
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
      <IconSymbol
        name="chevron-right"
        size={20}
        color={tokens.onPastel}
      />
    </Press>
  );
}
