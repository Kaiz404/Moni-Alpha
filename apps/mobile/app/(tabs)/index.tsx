import { memo, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { Page } from '@/components/ui/page';
import { useValue } from '@legendapp/state/react';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { BudgetProgressItem } from '@/components/budgets/budget-progress-item';
import { ConfirmBalanceCard } from '@/components/wallets/confirm-balance-card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SolidWalletCard } from '@/components/ui/solid-wallet-card';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { resolveWalletIcon } from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMinorAmount } from '@/lib/finance/money';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import {
  budgetProgress$,
  debtsWithBalance$,
  financeOverview$,
  netWorthByCurrency$,
  pendingProposals$,
  walletBalanceMinor$,
  walletById$,
} from '@/lib/finance/selectors';

function timeAwareGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

/** "Wednesday, 14 Oct", as the Home header draws it. */
function headerDate(date: Date): string {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', options).format(date);
  return `${part({ weekday: 'long' })}, ${part({ day: 'numeric' })} ${part({ month: 'short' })}`;
}

function displayName(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  return trimmed ? (trimmed.split(/\s+/)[0] ?? null) : null;
}

function transactionDateLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

const WalletCard = memo(function WalletCard({
  walletId,
}: {
  walletId: string;
}) {
  const wallet = useValue(walletById$(walletId));
  const balanceMinor = useValue(walletBalanceMinor$(walletId));
  if (!wallet) return null;
  const cardStyle = getWalletCardStyle(
    wallet.cardStyleId ?? undefined,
  );
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/wallet/[id]',
          params: { id: wallet.id },
        } as any)
      }
      className="mr-2"
      style={{ width: 150 }}
      accessibilityRole="button"
      accessibilityLabel={`Open ${wallet.name}, ${formatMinorAmount(balanceMinor, wallet.currency)}`}
    >
      <SolidWalletCard
        cardStyle={cardStyle}
        className="w-full flex-col justify-between p-4"
      >
        <View
          pointerEvents="none"
          className="absolute -bottom-0 -right-3"
          style={{ opacity: 0.18 }}
        >
          <IconSymbol
            name={resolveWalletIcon(undefined, wallet.type)}
            size={60}
            color={cardStyle.contentColor}
          />
        </View>
        <View className="flex-row items-start justify-between">
          <View className="min-w-0 flex-1 pr-2">
            <Text
              className="text-base font-display-bold"
              style={{ color: cardStyle.contentColor }}
              numberOfLines={1}
            >
              {wallet.name}
            </Text>
          </View>
        </View>
        <View className="mt-auto pt-2">
          <Text
            className="mt-1 text-xl font-display-bold"
            numberOfLines={1}
            style={{
              color: cardStyle.contentColor,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatMinorAmount(balanceMinor, wallet.currency)}
          </Text>
        </View>
      </SolidWalletCard>
    </Pressable>
  );
});

export default function HomeScreen() {
  const { user } = useAuth();

  const userInitial = useMemo(() => {
    const ch = (user?.email ?? '').charAt(0).toUpperCase();
    return ch || '?';
  }, [user?.email]);

  const name =
    displayName(user?.user_metadata?.full_name) ??
    displayName(user?.email);
  const greeting = name
    ? `${timeAwareGreeting()}, ${name}`
    : timeAwareGreeting();

  const tokens = useThemeTokens();
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  );
  const overview = useValue(financeOverview$(user?.id ?? null));
  const netWorth = useValue(netWorthByCurrency$(user?.id ?? null));
  const budgetProgress = useValue(
    budgetProgress$(user?.id ?? null, timezone),
  );
  const debts = useValue(debtsWithBalance$(user?.id ?? null));
  const pendingProposals = useValue(
    pendingProposals$(user?.id ?? null),
  );
  const [refreshing, setRefreshing] = useState(false);
  const recent = useMemo(
    () => overview.transactions.slice(0, 5),
    [overview.transactions],
  );
  const visibleBudgets = budgetProgress.slice(0, 2);
  const openDebts = debts
    .filter(
      ({ debt, balanceMinor }) =>
        debt.status === 'open' && Number(balanceMinor) > 0,
    )
    .slice(0, 2);

  const refresh = async () => {
    setRefreshing(true);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    setRefreshing(false);
  };

  return (
    <Page
      screen="home"
      kind="home"
      initial={userInitial}
      date={headerDate(new Date())}
      greeting={greeting}
      onAvatarPress={() => router.push('/(tabs)/profile')}
      onAskMoni={() => router.push('/(tabs)/chat')}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5">
          <ConfirmBalanceCard />

          {pendingProposals.length ? (
            <Pressable
              className="mt-5 flex-row items-center rounded-2xl bg-surface-1 px-4 py-3"
              onPress={() =>
                router.push({
                  pathname: '/proposal/[id]',
                  params: { id: pendingProposals[0]!.id },
                } as any)
              }
              accessibilityRole="button"
              accessibilityLabel={`${pendingProposals.length} transaction proposal${pendingProposals.length === 1 ? '' : 's'} ready for review`}
            >
              <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-muted">
                <MaterialDesignIcons
                  name="file-document-check"
                  size={19}
                  color={tokens.primary}
                />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-display-bold text-foreground">
                  {pendingProposals.length} ready to review
                </Text>
              </View>
              <MaterialDesignIcons
                name="chevron-right"
                size={21}
                color={tokens.muted}
              />
            </Pressable>
          ) : null}

          <View className="rounded-card bg-sand-light mt-7 p-5">
            <Text className="text-sm font-display-semibold text-muted">
              Net worth
            </Text>
            {netWorth.length ? (
              <View className="mt-2 gap-4">
                {netWorth.map((row, index) => (
                  <View key={row.currency}>
                    <View className="flex-row items-baseline justify-between">
                      <Text
                        className={`${index === 0 ? 'text-[30px]' : 'text-xl'} font-display-bold leading-9 text-foreground`}
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {formatMinorAmount(
                          row.netWorthMinor,
                          row.currency,
                        )}
                      </Text>
                      <Text className="text-sm font-display-semibold text-muted">
                        {row.currency}
                      </Text>
                    </View>
                    <Text className="mt-1 text-sm leading-5 text-muted">
                      Cash{' '}
                      {formatMinorAmount(row.cashMinor, row.currency)}{' '}
                      · Owed to you{' '}
                      {formatMinorAmount(
                        row.receivableMinor,
                        row.currency,
                      )}{' '}
                      · You owe{' '}
                      {formatMinorAmount(
                        row.payableMinor,
                        row.currency,
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className="mt-2">
                <Text className="text-lg font-display-bold text-foreground">
                  Add your first account
                </Text>
              </View>
            )}
          </View>
        </View>

        <View className="mt-4">
          <View className="mb-1 flex-row items-center justify-between px-5">
            <View>
              <Text className="text-lg font-display-bold text-foreground">
                Wallets
              </Text>
            </View>
            <Pressable
              className="h-11 w-11 items-center justify-center"
              onPress={() => router.push('/wallet/new' as any)}
              accessibilityRole="button"
              accessibilityLabel="Add wallet"
            >
              <MaterialDesignIcons
                name="plus"
                size={22}
                color={tokens.primary}
              />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-5"
          >
            {overview.wallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                walletId={wallet.id}
              />
            ))}
          </ScrollView>
        </View>

        <View className="mt-4 px-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-display-bold text-foreground">
                Budgets
              </Text>
            </View>
            <Pressable
              className="min-h-11 justify-center px-2"
              onPress={() => router.push('/budget' as any)}
            >
              <MaterialDesignIcons
                name="chevron-right"
                size={20}
                color={tokens.primary}
                accessibilityLabel="Go to Budgets"
              />
            </Pressable>
          </View>
          {visibleBudgets.length ? (
            <View className="rounded-card bg-accent-lemon/30 overflow-hidden">
              {visibleBudgets.map((budget, index) => {
                return (
                  <Pressable
                    key={`${budget.categoryId}:${budget.currency}`}
                    className={index ? 'border-t border-border' : ''}
                    onPress={() =>
                      router.push({
                        pathname: '/transaction',
                        params: {
                          categoryId: budget.categoryId,
                          currency: budget.currency,
                          month: new Date().toISOString().slice(0, 7),
                        },
                      } as any)
                    }
                  >
                    <BudgetProgressItem budget={budget} />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Pressable
              className="rounded-[22px] bg-surface-2 px-5 py-6"
              onPress={() => router.push('/budget' as any)}
            >
              <Text className="text-base font-display-semibold text-foreground">
                Plan a monthly cap
              </Text>
              <Text className="mt-1 text-sm leading-5 text-muted">
                Budgets make your remaining spending visible without
                changing any records.
              </Text>
            </Pressable>
          )}
        </View>

        {openDebts.length ? (
          <View className="mt-4 px-5">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-display-bold text-foreground">
                  Debt pulse
                </Text>
              </View>
              <Pressable
                className="min-h-11 justify-center px-2"
                onPress={() => router.push('/debts' as any)}
              >
                <MaterialDesignIcons
                  name="chevron-right"
                  size={20}
                  color={tokens.primary}
                  accessibilityLabel="Go to Debt Pulse"
                />
              </Pressable>
            </View>
            <View className="rounded-card bg-accent-lilac/30 overflow-hidden">
              {openDebts.map(({ debt, balanceMinor }, index) => {
                const owedToYou = debt.direction === 'owed_to_me';
                return (
                  <Pressable
                    key={debt.id}
                    className={`flex-row items-center justify-between px-4 py-4 ${index ? 'border-t border-border' : ''}`}
                    onPress={() =>
                      router.push(`/debt/${debt.id}` as any)
                    }
                  >
                    <View className="min-w-0 flex-1 pr-3">
                      <Text
                        className="text-base font-display-semibold text-foreground"
                        numberOfLines={1}
                      >
                        {debt.counterpartyName}
                      </Text>
                      <Text className="mt-1 text-sm text-muted">
                        {owedToYou ? 'Owed to you' : 'You owe'}
                        {debt.dueDate ? ` · Due ${debt.dueDate}` : ''}
                      </Text>
                    </View>
                    <Text
                      className="text-base font-display-bold text-foreground"
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {formatMinorAmount(balanceMinor, debt.currency)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View className="mt-4 px-5">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-display-bold text-foreground">
                Recent activity
              </Text>
            </View>
            <Pressable
              className="min-h-11 justify-center px-2"
              onPress={() => router.push('/transaction' as any)}
            >
              <MaterialDesignIcons
                name="chevron-right"
                size={20}
                color={tokens.primary}
                accessibilityLabel="Go to Recent Activity"
              />
            </Pressable>
          </View>
          {recent.length ? (
            <View className="rounded-card bg-accent-aqua/30 overflow-hidden">
              {recent.map((transaction, index) => {
                const category = transaction.categoryId
                  ? overview.categoriesById[transaction.categoryId]
                  : null;
                const isTransfer = transaction.type === 'transfer';
                const sign = isTransfer
                  ? ''
                  : transaction.type === 'income'
                    ? '+'
                    : '−';
                const amountClass = isTransfer
                  ? 'text-transfer'
                  : transaction.type === 'income'
                    ? 'text-income'
                    : 'text-expense';
                return (
                  <Pressable
                    key={transaction.id}
                    className={`flex-row items-center px-4 py-4 ${index ? 'border-t border-border' : ''}`}
                    onPress={() =>
                      router.push(
                        transaction.debtActivityId
                          ? ('/debts' as any)
                          : ({
                              pathname: '/transaction/[id]',
                              params: { id: transaction.id },
                            } as any),
                      )
                    }
                  >
                    <View
                      className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: category?.color
                          ? `${category.color}22`
                          : tokens.surface2,
                      }}
                    >
                      <IconSymbol
                        name={resolveTransactionIcon(
                          category?.icon,
                          transaction.type,
                        )}
                        size={20}
                        color={category?.color ?? tokens.muted}
                      />
                    </View>
                    <View className="min-w-0 flex-1 pr-3">
                      <Text
                        className="text-base font-display-semibold text-foreground"
                        numberOfLines={1}
                      >
                        {transaction.merchant ??
                          transaction.description ??
                          transaction.type}
                      </Text>
                      <Text className="mt-1 text-xs text-muted">
                        {category?.name ??
                          (transaction.type === 'transfer'
                            ? 'Transfer'
                            : transaction.type === 'income'
                              ? 'Income'
                              : 'Expense')}{' '}
                        ·{' '}
                        {transactionDateLabel(
                          transaction.transactionDate,
                        )}
                        {transaction.autoAdded ? ' · Auto' : ''}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className={`text-base font-display-bold ${amountClass}`}
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {sign}
                        {formatMinorAmount(
                          transaction.amountMinor,
                          transaction.currency,
                        )}
                      </Text>
                      <Text className="mt-1 text-xs text-muted">
                        {transaction.type === 'transfer'
                          ? 'Transfer'
                          : transaction.type === 'income'
                            ? 'Income'
                            : 'Expense'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Pressable
              className="rounded-[22px] bg-surface-2 px-5 py-6"
              onPress={() => router.push('/transaction/new' as any)}
            >
              <Text className="text-base font-display-semibold text-foreground">
                Your activity will live here
              </Text>
              <Text className="mt-1 text-sm leading-5 text-muted">
                Add a transaction yourself, or use Moni’s capture menu
                when you are ready.
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </Page>
  );
}
