import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useValue } from '@legendapp/state/react';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import { ActivityCalendar } from '@/components/charts/activity-calendar';
import { BudgetProgressBar } from '@/components/charts/budget-progress-bar';
import { buildMonthlyTakeaway, previousMonthKey } from '@/components/charts/chart-utils';
import { DonutChart } from '@/components/charts/donut-chart';
import { LineChart } from '@/components/charts/line-chart';
import { SyncStatusIndicator } from '@/components/providers/sync-status-indicator';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { dayKeyInTimezone, monthKeyInTimezone } from '@/lib/finance/dates';
import {
  categoryExpensesByCurrency,
  budgetProgress$,
  financeOverview$,
} from '@/lib/finance/selectors';
import {
  formatMinorAmount,
  minorToNumber,
  type CurrencyCode,
} from '@/lib/finance/money';

type Timeframe = '30D' | '90D' | 'All';

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function currencyText(value: string): CurrencyCode {
  return value as CurrencyCode;
}

export default function InsightsScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const tokens = useThemeTokens();
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  );
  const currentMonth = useMemo(
    () => monthKeyInTimezone(new Date(), timezone),
    [timezone],
  );
  const overview = useValue(financeOverview$(user?.id ?? null));
  const budgetProgress = useValue(
    budgetProgress$(user?.id ?? null, timezone),
  );
  const [currencyPreference, setCurrencyPreference] = useState<string | null>(
    null,
  );
  const [timeframe, setTimeframe] = useState<Timeframe>('90D');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);

  const monthlyExpenses = useMemo(
    () =>
      categoryExpensesByCurrency(
        overview.transactions.filter(
          (transaction) =>
            monthKeyInTimezone(transaction.transactionDate, timezone) ===
            currentMonth,
        ),
        overview.categoriesById,
      ),
    [currentMonth, overview.categoriesById, overview.transactions, timezone],
  );
  const previousExpenses = useMemo(
    () =>
      categoryExpensesByCurrency(
        overview.transactions.filter(
          (transaction) =>
            monthKeyInTimezone(transaction.transactionDate, timezone) ===
            previousMonthKey(currentMonth),
        ),
        overview.categoriesById,
      ),
    [currentMonth, overview.categoriesById, overview.transactions, timezone],
  );
  const currencies = useMemo(
    () =>
      [
        ...new Set([
          ...overview.balanceTotals.map((row) => row.currency),
          ...Object.keys(monthlyExpenses),
          ...overview.balanceLines.map((line) => line.currency),
          ...budgetProgress.map((row) => row.currency),
        ]),
      ].sort(),
    [budgetProgress, monthlyExpenses, overview.balanceLines, overview.balanceTotals],
  );
  const currency = currencies.includes(currencyPreference ?? '')
    ? currencyPreference!
    : (currencies[0] ?? null);
  const categoryEntries = currency ? monthlyExpenses[currency] ?? [] : [];
  const previousEntries = currency ? previousExpenses[currency] ?? [] : [];
  const categoryTotal = categoryEntries.reduce(
    (sum, entry) => sum + minorToNumber(entry.yMinor),
    0,
  );
  const previousTotal = previousEntries.reduce(
    (sum, entry) => sum + minorToNumber(entry.yMinor),
    0,
  );
  const takeaway = buildMonthlyTakeaway({
    total: categoryTotal,
    previousTotal,
    leadingCategoryName: categoryEntries[0]?.name ?? null,
  });
  const balanceLine = overview.balanceLines.find(
    (line) => line.currency === currency,
  );
  const trendData = useMemo(() => {
    const points = balanceLine?.points ?? [];
    if (timeframe === 'All') return points;
    const days = timeframe === '30D' ? 30 : 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const scoped = points.filter((point) => point.x.getTime() >= cutoff);
    return scoped.length ? scoped : points.slice(-1);
  }, [balanceLine?.points, timeframe]);
  const selectedBudgetRows = useMemo(
    () => budgetProgress.filter((row) => row.currency === currency),
    [budgetProgress, currency],
  );
  const activityTransactions = useMemo(
    () =>
      overview.transactions.filter(
        (transaction) =>
          transaction.currency === currency &&
          transaction.type === 'expense' &&
          !transaction.analysisExcluded &&
          monthKeyInTimezone(transaction.transactionDate, timezone) ===
            currentMonth,
      ),
    [currency, currentMonth, overview.transactions, timezone],
  );
  const activityDays = useMemo(() => {
    const days = new Map<string, { amount: number; transactionCount: number }>();
    for (const transaction of activityTransactions) {
      const key = dayKeyInTimezone(transaction.transactionDate, timezone);
      const current = days.get(key) ?? { amount: 0, transactionCount: 0 };
      current.amount += minorToNumber(transaction.amountMinor);
      current.transactionCount += 1;
      days.set(key, current);
    }
    return [...days.entries()].map(([dateKey, value]) => ({
      dateKey,
      ...value,
    }));
  }, [activityTransactions, timezone]);
  const selectedActivityTransactions = selectedDate
    ? activityTransactions.filter(
        (transaction) =>
          dayKeyInTimezone(transaction.transactionDate, timezone) ===
          selectedDate,
      )
    : [];
  const currencyWallets = overview.wallets.filter(
    (wallet) => wallet.currency === currency,
  );

  return (
    <SafeAreaView
      edges={['top']}
      className="flex-1 bg-canvas"
      style={{ flex: 1 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-32 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-7 flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-sm font-semibold text-muted">Patterns, not guesses</Text>
            <Text className="mt-1 text-[28px] font-bold leading-9 text-foreground">
              Insights
            </Text>
          </View>
          <View className="pt-1">
            <SyncStatusIndicator />
          </View>
        </View>

        {!currency ? (
          <View className="rounded-[28px] border border-dashed border-border bg-card px-5 py-8">
            <Text className="text-lg font-bold text-foreground">
              Start with one wallet
            </Text>
            <Text className="mt-1 text-sm leading-5 text-muted">
              Moni keeps currencies separate, so your insights will appear as
              soon as you add a wallet and record activity.
            </Text>
            <Pressable
              className="mt-5 self-start rounded-2xl bg-primary px-4 py-3"
              onPress={() => router.push('/wallet/new' as any)}
            >
              <Text className="font-semibold text-primary-foreground">
                Add a wallet
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-5 -mx-5"
              contentContainerClassName="gap-2 px-5"
            >
              {currencies.map((item) => {
                const active = item === currency;
                return (
                  <Pressable
                    key={item}
                    className={`min-h-11 rounded-full px-4 py-2.5 ${active ? 'bg-primary' : 'border border-border bg-card'}`}
                    onPress={() => {
                      setCurrencyPreference(item);
                      setSelectedDate(null);
                      setSelectedBudget(null);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      className={`font-semibold ${active ? 'text-primary-foreground' : 'text-foreground'}`}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="mb-6 rounded-[28px] border border-border bg-card p-5">
              <Text className="text-sm font-semibold text-muted">
                Where did your money go?
              </Text>
              <View className="mt-1 flex-row items-baseline justify-between">
                <Text className="text-xl font-bold text-foreground">
                  {formatMonth(currentMonth)} spending
                </Text>
                <Text className="text-sm font-semibold text-muted">{currency}</Text>
              </View>
              <View className="mt-2">
                <DonutChart
                  data={categoryEntries.map((entry, index) => ({
                    id: entry.categoryId ?? `uncategorized-${index}`,
                    label: entry.name,
                    value: minorToNumber(entry.yMinor),
                    color: entry.color,
                    icon: entry.icon,
                  }))}
                  colors={tokens.chart}
                  surfaceColor={tokens.card}
                  borderColor={tokens.border}
                  mutedColor={tokens.muted}
                  valueLabel={(value) =>
                    formatMinorAmount(Math.round(value * 100), currencyText(currency))
                  }
                />
              </View>
            </View>

            <View className="mb-6 rounded-[28px] border border-border bg-surface-1 p-5">
              <View className="flex-row items-start">
                <MaterialIcons
                  name="insights"
                  size={20}
                  color={tokens.primary}
                />
                <View className="ml-2 flex-1">
                  <Text className="text-base font-bold text-foreground">
                    {takeaway.headline}
                  </Text>
                  <Text className="mt-1 text-sm leading-5 text-muted">
                    {takeaway.detail}
                  </Text>
                </View>
              </View>
            </View>

            <View className="mb-6 rounded-[28px] border border-border bg-card p-5">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-base font-bold text-foreground">
                    Balance trend
                  </Text>
                  <Text className="mt-1 text-sm text-muted">
                    Tap or drag across the line to inspect a date.
                  </Text>
                </View>
              </View>
              <View className="mt-4 flex-row gap-2">
                {(['30D', '90D', 'All'] as const).map((option) => {
                  const active = option === timeframe;
                  return (
                    <Pressable
                      key={option}
                      className={`min-h-10 rounded-full px-3 py-2 ${active ? 'bg-primary-muted' : 'bg-surface-2'}`}
                      onPress={() => setTimeframe(option)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        className={`text-sm font-semibold ${active ? 'text-primary' : 'text-muted'}`}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View className="mt-4">
                <LineChart
                  data={trendData.map((point, index) => ({
                    id: `${point.x.toISOString()}-${index}`,
                    date: point.x,
                    value: minorToNumber(point.yMinor),
                  }))}
                  width={Math.max(width - 80, 260)}
                  strokeColor={tokens.primary}
                  gridColor={tokens.border}
                  surfaceColor={tokens.card}
                  valueLabel={(value) =>
                    formatMinorAmount(Math.round(value * 100), currencyText(currency))
                  }
                  dateLabel={(date) =>
                    new Intl.DateTimeFormat(undefined, {
                      month: 'short',
                      day: 'numeric',
                    }).format(date)
                  }
                />
              </View>
            </View>

            <View className="mb-6">
              <View className="mb-3 flex-row items-center justify-between">
                <View>
                  <Text className="text-lg font-bold text-foreground">
                    Budget pulse
                  </Text>
                  <Text className="mt-1 text-sm text-muted">
                    Tap a category for the amount behind its progress.
                  </Text>
                </View>
                <Pressable
                  className="min-h-11 items-center justify-center rounded-full px-2"
                  onPress={() => router.push('/budget' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Manage budgets"
                >
                  <Text className="text-sm font-semibold text-primary">Manage</Text>
                </Pressable>
              </View>
              {selectedBudgetRows.length ? (
                <View className="overflow-hidden rounded-[22px] border border-border bg-card">
                  {selectedBudgetRows.map((row, index) => {
                    const rowKey = `${row.categoryId}:${row.currency}`;
                    const expanded = selectedBudget === rowKey;
                    const accent =
                      row.status === 'over'
                        ? tokens.danger
                        : (row.categoryColor ?? tokens.primary);
                    const context =
                      row.budgetAmountMinor === null
                        ? 'No cap set'
                        : `${formatMinorAmount(row.spentMinor, currencyText(currency))} of ${formatMinorAmount(row.budgetAmountMinor, currencyText(currency))} used`;
                    return (
                      <Pressable
                        key={rowKey}
                        className={`px-4 py-4 ${index ? 'border-t border-border' : ''}`}
                        onPress={() =>
                          setSelectedBudget(expanded ? null : rowKey)
                        }
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                      >
                        <View className="flex-row items-center justify-between">
                          <View className="min-w-0 flex-1 flex-row items-center pr-3">
                            <View
                              className="mr-2 h-9 w-9 items-center justify-center rounded-full"
                              style={{ backgroundColor: `${accent}22` }}
                            >
                              <Text className="text-base">
                                {row.categoryIcon ?? '•'}
                              </Text>
                            </View>
                            <View className="min-w-0 flex-1">
                              <Text
                                className="text-base font-semibold text-foreground"
                                numberOfLines={1}
                              >
                                {row.categoryName}
                              </Text>
                              <Text className="mt-0.5 text-xs text-muted">
                                {context}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-sm font-bold text-foreground">
                            {row.percentage === null ? '—' : `${row.percentage}%`}
                          </Text>
                        </View>
                        {expanded ? (
                          <View className="mt-4">
                            <BudgetProgressBar
                              percentage={row.percentage}
                              color={accent}
                              label={
                                row.remainingMinor === null
                                  ? 'Set a monthly cap to track remaining budget.'
                                  : row.remainingMinor < 0
                                    ? `${formatMinorAmount(Math.abs(Number(row.remainingMinor)), currencyText(currency))} over budget`
                                    : `${formatMinorAmount(row.remainingMinor, currencyText(currency))} remaining`
                              }
                            />
                            <Pressable
                              className="mt-3 self-start"
                              onPress={() =>
                                router.push({
                                  pathname: '/transaction',
                                  params: {
                                    categoryId: row.categoryId,
                                    currency,
                                    month: currentMonth,
                                  },
                                } as any)
                              }
                            >
                              <Text className="text-sm font-semibold text-primary">
                                View transactions
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View className="rounded-[22px] border border-dashed border-border px-5 py-6">
                  <Text className="text-sm text-muted">
                    Set a budget or add a categorized expense to track a pulse.
                  </Text>
                </View>
              )}
            </View>

            <View className="mb-6 rounded-[28px] border border-border bg-card p-5">
              <Text className="text-lg font-bold text-foreground">
                Activity calendar
              </Text>
              <Text className="mt-1 text-sm text-muted">
                Spending days in {formatMonth(currentMonth)} · {currency}
              </Text>
              <View className="mt-5">
                <ActivityCalendar
                  month={currentMonth}
                  activities={activityDays}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </View>
              {selectedDate ? (
                <View className="mt-5 border-t border-border pt-4">
                  <Text className="text-sm font-semibold text-foreground">
                    {new Intl.DateTimeFormat(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      timeZone: 'UTC',
                    }).format(new Date(`${selectedDate}T00:00:00Z`))}
                  </Text>
                  {selectedActivityTransactions.length ? (
                    selectedActivityTransactions.slice(0, 3).map((transaction) => (
                      <Pressable
                        key={transaction.id}
                        className="mt-3 flex-row items-center justify-between"
                        onPress={() =>
                          router.push({
                            pathname: '/transaction/[id]',
                            params: { id: transaction.id },
                          } as any)
                        }
                      >
                        <Text
                          className="flex-1 pr-3 text-sm font-medium text-foreground"
                          numberOfLines={1}
                        >
                          {transaction.merchant ??
                            transaction.description ??
                            'Expense'}
                        </Text>
                        <Text
                          className="text-sm font-bold text-foreground"
                          style={{ fontVariant: ['tabular-nums'] }}
                        >
                          {formatMinorAmount(transaction.amountMinor, currencyText(currency))}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text className="mt-2 text-sm text-muted">
                      No expenses recorded on this day.
                    </Text>
                  )}
                </View>
              ) : (
                <Text className="mt-4 text-sm text-muted">
                  Select a highlighted day to see its transactions.
                </Text>
              )}
            </View>

            <View className="mb-6 rounded-[28px] border border-border bg-card p-5">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-lg font-bold text-foreground">
                    Where money sits
                  </Text>
                  <Text className="mt-1 text-sm text-muted">
                    Original {currency} balances only
                  </Text>
                </View>
              </View>
              {currencyWallets.map((wallet) => (
                <Pressable
                  key={wallet.id}
                  className="mt-4 flex-row items-center justify-between"
                  onPress={() =>
                    router.push({
                      pathname: '/wallet/[id]',
                      params: { id: wallet.id },
                    } as any)
                  }
                >
                  <View className="min-w-0 flex-1 pr-3">
                    <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                      {wallet.name}
                    </Text>
                    <Text className="mt-0.5 text-sm text-muted">{wallet.type}</Text>
                  </View>
                  <Text
                    className="text-base font-bold text-foreground"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatMinorAmount(
                      overview.balancesByWallet[wallet.id] ?? 0,
                      currencyText(currency),
                    )}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              className="mb-2 flex-row items-center rounded-[22px] border border-border bg-surface-1 p-4"
              onPress={() => router.push('/heatmap' as any)}
              accessibilityRole="button"
              accessibilityLabel="Open transaction pinmap"
            >
              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-muted">
                <MaterialIcons name="place" size={22} color={tokens.primary} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-foreground">
                  Transaction pinmap
                </Text>
                <Text className="mt-1 text-sm text-muted">
                  Revisit the places behind your recorded activity.
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={tokens.muted} />
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
