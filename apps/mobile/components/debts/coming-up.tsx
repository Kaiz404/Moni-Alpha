import { router } from 'expo-router';
import { View } from 'react-native';

import { debtMoney, dueWords } from '@/components/debts/debt-words';
import {
  sendReminder,
  useRemindedToday,
} from '@/components/debts/reminder';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { parseLocalDateInput } from '@/lib/dates/local-date-input';
import type { ComingUpRow } from '@/lib/finance/debt-summary';
import { tid } from '@/lib/test-ids';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** The Lemon block of debts with a due date: Pay what you owe, Remind who owes you. */
export function ComingUp({ rows }: { rows: ComingUpRow[] }) {
  const reminded = useRemindedToday();
  if (rows.length === 0) return null;
  return (
    <View
      accessibilityLabel="Coming up"
      className="rounded-card bg-lemon pb-2 pl-[18px] pr-3.5 pt-3.5"
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
          remindedToday={reminded(row.line.debt.id)}
        />
      ))}
    </View>
  );
}

function Row({
  row,
  remindedToday,
}: {
  row: ComingUpRow;
  remindedToday: boolean;
}) {
  const tokens = useThemeTokens();
  const { line, dueDate, daysLeft } = row;
  const {
    id,
    counterpartyName: name,
    direction,
    note,
    currency,
  } = line.debt;
  const due = parseLocalDateInput(dueDate);
  const amount = debtMoney(line.balanceMinor, currency);
  const iOwe = direction === 'i_owe';
  const title = iOwe
    ? `Pay ${name} ${amount}`
    : `${name} pays ${amount}`;
  const meta = [dueWords(daysLeft), note].filter(Boolean).join(' · ');
  return (
    <View className="pb-1.5">
      <View className="min-h-[60px] flex-row items-center gap-3">
        <View
          importantForAccessibility="no-hide-descendants"
          className="h-[46px] w-11 items-center justify-center rounded-[14px] bg-card"
        >
          <Text className="text-[12px] leading-[14px] font-display-bold tracking-[0.48px] text-ink-2">
            {due ? WEEKDAYS[due.getDay()] : ''}
          </Text>
          <Text className="text-[18px] leading-[20px] font-display-bold text-foreground">
            {due ? due.getDate() : ''}
          </Text>
        </View>
        <View
          accessible
          className="min-w-0 flex-1"
        >
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
        {iOwe ? (
          <Press
            testID={tid('debts', 'coming-up', 'pay', id)}
            accessibilityLabel={title}
            pressedClassName="bg-primary-pressed"
            radius={{ rest: 22, pressed: 16 }}
            className="h-11 justify-center bg-primary px-4"
            onPress={() =>
              router.push({
                pathname: '/debt/amount',
                params: { id, mode: 'repay' },
              })
            }
          >
            <Text className="text-[15px] leading-[21px] font-display-semibold text-primary-foreground">
              Pay
            </Text>
          </Press>
        ) : null}
      </View>
      {iOwe ? null : remindedToday ? (
        <View className="ml-14 h-11 flex-row items-center gap-1.5 opacity-80">
          <IconSymbol
            name="check"
            size={18}
            color={tokens.onPastel}
          />
          <Text className="text-[15px] leading-[21px] font-display-semibold text-on-pastel">
            Reminded today
          </Text>
        </View>
      ) : (
        <Press
          testID={tid('debts', 'coming-up', 'remind', id)}
          accessibilityHint="Opens the share sheet with a message"
          pressedClassName="bg-sand-light"
          radius={{ rest: 22, pressed: 16 }}
          className="ml-14 h-11 flex-row items-center gap-1.5 self-start bg-card pl-3 pr-4"
          onPress={() => void sendReminder(line)}
        >
          <IconSymbol
            name="send-outline"
            size={18}
            color={tokens.foreground}
          />
          <Text className="text-[15px] leading-[21px] font-display-semibold text-foreground">
            Remind {name}
          </Text>
        </Press>
      )}
    </View>
  );
}
