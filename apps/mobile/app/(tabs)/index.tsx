import { memo, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useValue } from '@legendapp/state/react';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { BudgetProgressBar } from '@/components/charts/budget-progress-bar';
import { SyncStatusIndicator } from '@/components/providers/sync-status-indicator';
import { GradientCard } from '@/components/ui/gradient-card';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMinorAmount } from '@/lib/finance/money';
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
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
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
  selected,
  onToggle,
}: {
  walletId: string;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const wallet = useValue(walletById$(walletId));
  const balanceMinor = useValue(walletBalanceMinor$(walletId));
  if (!wallet) return null;
  const cardStyle = getWalletCardStyle(
    wallet.cardStyleId ?? undefined,
  );
  return (
    <Pressable
      onPress={() => onToggle(wallet.id)}
      className="mr-3"
      style={{ width: 188 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${wallet.name}, ${formatMinorAmount(balanceMinor, wallet.currency)}`}
    >
      <GradientCard
        cardStyle={cardStyle}
        className={`min-h-36 rounded-[22px] border p-4 ${selected ? 'border-2 border-primary' : 'border-white/20'}`}
      >
        <View className="flex-row items-start justify-between">
          <View className="min-w-0 flex-1 pr-2">
            <Text
              className="text-xs font-semibold"
              style={{ color: cardStyle.contentMutedColor }}
              numberOfLines={1}
            >
              {wallet.type}
            </Text>
            <Text
              className="mt-1 text-base font-bold"
              style={{ color: cardStyle.contentColor }}
              numberOfLines={1}
            >
              {wallet.name}
            </Text>
          </View>
          <Pressable
            hitSlop={10}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: cardStyle.actionOverlayColor }}
            onPress={(event) => {
              event.stopPropagation();
              router.push({
                pathname: '/wallet/[id]',
                params: { id: wallet.id },
              } as any);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${wallet.name}`}
          >
            <MaterialIcons
              name="chevron-right"
              size={19}
              color={cardStyle.contentColor}
            />
          </Pressable>
        </View>
        <View className="mt-auto pt-7">
          <Text
            className="text-xs font-medium"
            style={{ color: cardStyle.contentMutedColor }}
          >
            {wallet.currency}
          </Text>
          <Text
            className="mt-1 text-xl font-bold"
            numberOfLines={1}
            style={{
              color: cardStyle.contentColor,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatMinorAmount(balanceMinor, wallet.currency)}
          </Text>
        </View>
      </GradientCard>
    </Pressable>
  );
});

export default function HomeScreen() {
  const { user } = useAuth();
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
  const [selectedWalletIds, setSelectedWalletIds] = useState<
    Set<string>
  >(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const activeWalletIds = useMemo(
    () =>
      selectedWalletIds.size
        ? selectedWalletIds
        : new Set(overview.wallets.map((wallet) => wallet.id)),
    [overview.wallets, selectedWalletIds],
  );
  const recent = useMemo(
    () =>
      overview.transactions
        .filter(
          (transaction) =>
            activeWalletIds.has(transaction.walletId) ||
            (transaction.transferToWalletId !== null &&
              activeWalletIds.has(transaction.transferToWalletId)),
        )
        .slice(0, 5),
    [activeWalletIds, overview.transactions],
  );
  const visibleBudgets = budgetProgress.slice(0, 2);
  const openDebts = debts
    .filter(
      ({ debt, balanceMinor }) =>
        debt.status === 'open' && Number(balanceMinor) > 0,
    )
    .slice(0, 2);

  const toggleWallet = (id: string) => {
    setSelectedWalletIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next.size === overview.wallets.length ? new Set() : next;
    });
  };
  const refresh = async () => {
    setRefreshing(true);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    setRefreshing(false);
  };

  return (
    <SafeAreaView
      edges={['top']}
      className="flex-1 bg-canvas"
      style={{ flex: 1 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-32 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-muted">
                {timeAwareGreeting()}
                {displayName(user?.user_metadata?.full_name) ||
                displayName(user?.email)
                  ? `, ${displayName(user?.user_metadata?.full_name) ?? displayName(user?.email)}`
                  : ''}
              </Text>
              <Text className="mt-1 text-[28px] font-bold leading-9 text-foreground">
                Your money, clearly
              </Text>
            </View>
            <View className="pt-1">
              <SyncStatusIndicator />
            </View>
          </View>

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
                <MaterialIcons
                  name="fact-check"
                  size={19}
                  color={tokens.primary}
                />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-bold text-foreground">
                  {pendingProposals.length} ready to review
                </Text>
                <Text className="mt-0.5 text-xs text-muted">
                  Confirm each record before it enters your ledger.
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={21}
                color={tokens.muted}
              />
            </Pressable>
          ) : null}

          <View className="mt-7 rounded-[28px] border border-border bg-card p-5">
            <Text className="text-sm font-semibold text-muted">
              Net worth
            </Text>
            {netWorth.length ? (
              <View className="mt-2 gap-4">
                {netWorth.map((row, index) => (
                  <View key={row.currency}>
                    <View className="flex-row items-baseline justify-between">
                      <Text
                        className={`${index === 0 ? 'text-[30px]' : 'text-xl'} font-bold leading-9 text-foreground`}
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {formatMinorAmount(
                          row.netWorthMinor,
                          row.currency,
                        )}
                      </Text>
                      <Text className="text-sm font-semibold text-muted">
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
                <Text className="text-lg font-bold text-foreground">
                  Add your first account
                </Text>
                <Text className="mt-1 text-sm leading-5 text-muted">
                  Moni will always keep each native currency separate.
                </Text>
              </View>
            )}
            <Text className="mt-4 text-xs font-medium text-muted">
              Native amounts only · Moni never fabricates a converted
              total.
            </Text>
          </View>
        </View>

        <View className="mt-7">
          <View className="mb-3 flex-row items-center justify-between px-5">
            <View>
              <Text className="text-lg font-bold text-foreground">
                Accounts
              </Text>
              <Text className="mt-1 text-sm text-muted">
                Tap an account to filter recent activity.
              </Text>
            </View>
            {selectedWalletIds.size ? (
              <Pressable
                className="min-h-11 justify-center px-2"
                onPress={() => setSelectedWalletIds(new Set())}
              >
                <Text className="text-sm font-semibold text-primary">
                  All accounts
                </Text>
              </Pressable>
            ) : null}
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
                selected={activeWalletIds.has(wallet.id)}
                onToggle={toggleWallet}
              />
            ))}
            <Pressable
              className="min-h-36 w-36 items-center justify-center rounded-[22px] border border-dashed border-border bg-card"
              onPress={() => router.push('/wallet/new' as any)}
              accessibilityRole="button"
              accessibilityLabel="Add wallet"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-muted">
                <MaterialIcons
                  name="add"
                  size={22}
                  color={tokens.primary}
                />
              </View>
              <Text className="mt-2 text-sm font-semibold text-foreground">
                Add wallet
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        <View className="mt-8 px-5">
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-bold text-foreground">
                Budget pulse
              </Text>
              <Text className="mt-1 text-sm text-muted">
                A quick read on this month’s planned spending.
              </Text>
            </View>
            <Pressable
              className="min-h-11 justify-center px-2"
              onPress={() => router.push('/budget' as any)}
            >
              <Text className="text-sm font-semibold text-primary">
                Budgets
              </Text>
            </Pressable>
          </View>
          {visibleBudgets.length ? (
            <View className="overflow-hidden rounded-[22px] border border-border bg-card">
              {visibleBudgets.map((budget, index) => {
                const accent =
                  budget.status === 'over'
                    ? tokens.danger
                    : (budget.categoryColor ?? tokens.primary);
                return (
                  <Pressable
                    key={`${budget.categoryId}:${budget.currency}`}
                    className={`px-4 py-4 ${index ? 'border-t border-border' : ''}`}
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
                    <View className="flex-row items-center justify-between">
                      <View className="min-w-0 flex-1 flex-row items-center pr-3">
                        <View
                          className="mr-2 h-9 w-9 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${accent}22` }}
                        >
                          <Text className="text-base">
                            {budget.categoryIcon ?? '•'}
                          </Text>
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text
                            className="text-base font-semibold text-foreground"
                            numberOfLines={1}
                          >
                            {budget.categoryName}
                          </Text>
                          <Text className="mt-0.5 text-xs text-muted">
                            {budget.budgetAmountMinor === null
                              ? 'No cap set'
                              : `${formatMinorAmount(budget.spentMinor, budget.currency)} of ${formatMinorAmount(budget.budgetAmountMinor, budget.currency)} used`}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-sm font-bold text-foreground">
                        {budget.percentage === null
                          ? '—'
                          : `${budget.percentage}%`}
                      </Text>
                    </View>
                    <View className="mt-3">
                      <BudgetProgressBar
                        percentage={budget.percentage}
                        color={accent}
                        label={
                          budget.remainingMinor === null
                            ? 'Set a cap to track remaining spending.'
                            : budget.remainingMinor < 0
                              ? `${formatMinorAmount(Math.abs(Number(budget.remainingMinor)), budget.currency)} over budget`
                              : `${formatMinorAmount(budget.remainingMinor, budget.currency)} remaining`
                        }
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Pressable
              className="rounded-[22px] border border-dashed border-border px-5 py-6"
              onPress={() => router.push('/budget' as any)}
            >
              <Text className="text-base font-semibold text-foreground">
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
          <View className="mt-8 px-5">
            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-bold text-foreground">
                  Debt pulse
                </Text>
                <Text className="mt-1 text-sm text-muted">
                  Keep shared money clear and explicit.
                </Text>
              </View>
              <Pressable
                className="min-h-11 justify-center px-2"
                onPress={() => router.push('/debts' as any)}
              >
                <Text className="text-sm font-semibold text-primary">
                  All debts
                </Text>
              </Pressable>
            </View>
            <View className="overflow-hidden rounded-[22px] border border-border bg-card">
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
                        className="text-base font-semibold text-foreground"
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
                      className="text-base font-bold text-foreground"
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

        <View className="mt-8 px-5">
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-bold text-foreground">
                Recent activity
              </Text>
              <Text className="mt-1 text-sm text-muted">
                Your newest records, in their original currency.
              </Text>
            </View>
            <Pressable
              className="min-h-11 justify-center px-2"
              onPress={() => router.push('/transaction' as any)}
            >
              <Text className="text-sm font-semibold text-primary">
                See all
              </Text>
            </Pressable>
          </View>
          {recent.length ? (
            <View className="overflow-hidden rounded-[22px] border border-border bg-card">
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
                      <Text className="text-base">
                        {category?.icon ?? '•'}
                      </Text>
                    </View>
                    <View className="min-w-0 flex-1 pr-3">
                      <Text
                        className="text-base font-semibold text-foreground"
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
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className={`text-base font-bold ${amountClass}`}
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
              className="rounded-[22px] border border-dashed border-border px-5 py-6"
              onPress={() => router.push('/transaction/new' as any)}
            >
              <Text className="text-base font-semibold text-foreground">
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
    </SafeAreaView>
  );
}
