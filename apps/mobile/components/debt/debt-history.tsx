import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { SIDE_WORDS } from '@/components/debts/debt-words';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatDay } from '@/lib/dates/day-label';
import { formatMoney } from '@/lib/finance/format-money';
import { financeProjection$ } from '@/lib/finance/projection';
import type {
  FinanceDebt,
  FinanceDebtActivity,
} from '@/lib/finance/types';
import { tid } from '@/lib/test-ids';

const GLYPHS: Record<FinanceDebtActivity['kind'], IconSymbolName> = {
  principal: 'hand-coin-outline',
  repayment: 'cash-refund',
  write_off: 'cancel',
};

/** Every activity on a debt, newest first. Rows that moved money open their transaction. */
export function DebtHistory({
  debt,
  activities,
}: {
  debt: FinanceDebt;
  activities: FinanceDebtActivity[];
}) {
  const tokens = useThemeTokens();
  const walletsById = useValue(financeProjection$.walletsById);
  const words = SIDE_WORDS[debt.direction];
  const owedToMe = debt.direction === 'owed_to_me';
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
            ? walletsById?.[activity.walletId]?.name
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
          const meta = [formatDay(activity.activityDate), where]
            .filter(Boolean)
            .join(' · ');
          const body = (
            <>
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
            </>
          );
          const label = `${title} ${amount}, ${meta}`;
          const transactionId = activity.cashTransactionId;
          return transactionId ? (
            <Press
              key={activity.id}
              testID={tid('debts', 'history', activity.id)}
              accessibilityLabel={label}
              className="flex-row items-center gap-3.5 px-[18px] py-3"
              onPress={() =>
                router.push({
                  pathname: '/transaction/[id]',
                  params: { id: transactionId },
                })
              }
            >
              {body}
            </Press>
          ) : (
            <View
              key={activity.id}
              accessible
              accessibilityLabel={label}
              className="flex-row items-center gap-3.5 px-[18px] py-3"
            >
              {body}
            </View>
          );
        })}
      </ListCard>
    </View>
  );
}
