import { useValue } from '@legendapp/state/react';
import { View } from 'react-native';

import { SIDE_WORDS } from '@/components/debts/debt-words';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { InPlaceField } from '@/components/ui/in-place-field';
import { ListCard } from '@/components/ui/list-card';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { financeProjection$ } from '@/lib/finance/projection';
import { editDebtActivityAmount } from '@/lib/supabase/debts';
import { tid } from '@/lib/test-ids';
import {
  compactWalletNames,
  currencySymbol,
  type FinanceDebt,
  type FinanceDebtActivity,
  dayLabel,
  formatMoney,
} from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

const GLYPHS: Record<FinanceDebtActivity['kind'], IconSymbolName> = {
  principal: 'hand-coin-outline',
  repayment: 'cash-refund',
  write_off: 'cancel',
};

/** Amounts must stay below this: the column is DECIMAL(12,2). */
const MAX_MINOR = 1_000_000_000_000;

/**
 * Every activity on a debt, newest first. What was lent, borrowed or paid back edits in place, with its
 * wallet row; a written-off debt keeps its amounts.
 */
export function DebtHistory({
  debt,
  activities,
}: {
  debt: FinanceDebt;
  activities: FinanceDebtActivity[];
}) {
  const tokens = useThemeTokens();
  const walletsById = useValue(financeProjection$.walletsById);
  const compactNames = compactWalletNames(Object.values(walletsById ?? {}));
  const words = SIDE_WORDS[debt.direction];
  const owedToMe = debt.direction === 'owed_to_me';
  const writtenOff = activities.some((activity) => activity.kind === 'write_off');
  return (
    <View className="gap-2 pt-1">
      <Text
        variant="sectionTitle"
        className="text-foreground"
        accessibilityRole="header"
      >
        History
      </Text>
      <ListCard>
        {activities.map((activity) => {
          const wallet = activity.walletId
            ? compactNames[activity.walletId]
            : null;
          const comesIn =
            activity.kind === 'repayment' ? owedToMe : !owedToMe;
          const where =
            activity.kind === 'write_off'
              ? 'no money moved'
              : wallet
                ? `${comesIn ? 'into' : 'from'} ${wallet}`
                : !activity.walletId &&
                    activity.kind === 'principal' &&
                    !owedToMe
                  ? `${debt.counterpartyName} paid directly`
                  : null;
          const title =
            activity.kind === 'principal'
              ? words.principal
              : activity.kind === 'repayment'
                ? words.repaid
                : 'Written off';
          const plus = activity.kind === 'repayment' && owedToMe;
          const amount = `${plus ? '+' : ''}${formatMoney(activity.amountMinor, debt.currency)}`;
          const meta = [dayLabel(deviceCalendar.dayKey(activity.activityDate), deviceCalendar.dayKey(new Date())), where]
            .filter(Boolean)
            .join(', ');
          const body = (
            <View className="flex-row items-center gap-3.5">
              <View
                className={`h-[42px] w-[42px] items-center justify-center rounded-full ${activity.kind === 'repayment' ? 'bg-primary-muted' : 'bg-sand'}`}
              >
                <IconSymbol
                  name={GLYPHS[activity.kind]}
                  size={20}
                  color={tokens.foreground}
                />
              </View>
              <View className="min-w-0 flex-1">
                <Text
                  variant="rowTitle"
                  className="text-foreground"
                  numberOfLines={1}
                >
                  {title}
                </Text>
                <Text
                  variant="meta"
                  className="text-muted"
                  numberOfLines={1}
                >
                  {meta}
                </Text>
              </View>
              <Text
                variant="rowTitle"
                className={
                  plus
                    ? 'text-deep-mint'
                    : activity.kind === 'write_off'
                      ? 'text-muted'
                      : 'text-foreground'
                }
              >
                {amount}
              </Text>
            </View>
          );
          const label = `${title} ${amount}, ${meta}`;
          if (writtenOff || activity.kind === 'write_off')
            return (
              <View
                key={activity.id}
                accessible
                accessibilityLabel={label}
                className="px-[18px] py-3"
              >
                {body}
              </View>
            );
          return (
            <InPlaceField
              key={activity.id}
              testID={tid('debts', 'history', activity.id)}
              label="Amount"
              kind="amount"
              prefix={currencySymbol(debt.currency)}
              max={MAX_MINOR}
              value={activity.amountMinor}
              onSave={(amountMinor) =>
                amountMinor === activity.amountMinor
                  ? undefined
                  : { undo: editDebtActivityAmount(debt, activity.id, amountMinor) }
              }
            >
              {({ editable, editor }) =>
                editor ? (
                  <View className="gap-1.5 px-[18px] py-3">
                    <Text
                      variant="meta"
                      className="text-muted"
                    >
                      {title}
                    </Text>
                    {editor}
                  </View>
                ) : (
                  editable(body, {
                    accessibilityLabel: `Edit amount, ${label}`,
                    className: 'flex-row items-center gap-2 px-[18px] py-3',
                    pressedClassName: 'bg-sand-light',
                  })
                )
              }
            </InPlaceField>
          );
        })}
      </ListCard>
    </View>
  );
}
