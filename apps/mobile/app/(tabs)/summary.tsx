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

import {
  BalanceLineChart,
  CategoryExpenseChart,
} from '@/components/summary/summary-charts';
import { useAuth } from '@/lib/auth/auth-context';
import {
  formatMinorAmount,
  type CurrencyCode,
  type MinorAmount,
} from '@/lib/finance/money';
import {
  financeOverview$,
  netWorthByCurrency$,
} from '@/lib/finance/selectors';

type NetWorthRow = {
  currency: CurrencyCode;
  cashMinor: MinorAmount;
  receivableMinor: MinorAmount;
  payableMinor: MinorAmount;
  netWorthMinor: MinorAmount;
};

export default function SummaryScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(width - 48, 280);
  const overview = useValue(financeOverview$(user?.id ?? null));
  const netWorth = useValue(
    netWorthByCurrency$(user?.id ?? null),
  ) as NetWorthRow[];

  return (
    <SafeAreaView
      edges={['top']}
      className="flex-1 bg-background"
      style={{ flex: 1 }}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-12"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-4 pt-4 text-2xl font-bold text-foreground">
          Summary
        </Text>

        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <Text className="text-base font-semibold text-foreground">
            Cash and net worth
          </Text>
          <Text className="mt-1 text-xs text-muted">
            Amounts remain separated by currency. Debt cash activity
            is excluded from spending.
          </Text>
          {netWorth.length === 0 ? (
            <Text className="mt-4 text-sm text-muted">
              Add a wallet to see your finances here.
            </Text>
          ) : (
            netWorth.map((row) => (
              <View
                key={row.currency}
                className="mt-3 border-t border-border pt-3"
              >
                <View className="flex-row justify-between">
                  <Text className="font-semibold text-foreground">
                    {row.currency}
                  </Text>
                  <Text className="font-bold text-foreground">
                    {formatMinorAmount(
                      row.netWorthMinor,
                      row.currency,
                    )}
                  </Text>
                </View>
                <Text className="mt-1 text-xs text-muted">
                  Cash{' '}
                  {formatMinorAmount(row.cashMinor, row.currency)} ·
                  Owed to you{' '}
                  {formatMinorAmount(
                    row.receivableMinor,
                    row.currency,
                  )}{' '}
                  · You owe{' '}
                  {formatMinorAmount(row.payableMinor, row.currency)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View className="mb-4 rounded-2xl border border-border bg-card p-4">
          <Text className="text-base font-semibold text-foreground">
            Wallet balances
          </Text>
          {overview.wallets.map((wallet) => (
            <View
              key={wallet.id}
              className="mt-3 flex-row items-center justify-between"
            >
              <View>
                <Text className="font-semibold text-foreground">
                  {wallet.name}
                </Text>
                <Text className="text-xs text-muted">
                  {wallet.currency}
                </Text>
              </View>
              <Text className="font-bold text-foreground">
                {formatMinorAmount(
                  overview.balancesByWallet[wallet.id] ?? 0,
                  wallet.currency,
                )}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          className="mb-4 rounded-2xl border border-border bg-card p-4"
          onPress={() => router.push('/heatmap' as any)}
        >
          <Text className="text-base font-semibold text-foreground">
            Transaction pinmap
          </Text>
          <Text className="mt-1 text-sm text-muted">
            Open locations and currency-separated transaction amounts.
          </Text>
        </Pressable>

        {Object.entries(overview.categoryExpensesByCurrency).map(
          ([currency, entries]) => (
            <CategoryExpenseChart
              key={currency}
              currency={currency}
              entries={entries}
              chartWidth={chartWidth}
            />
          ),
        )}

        {overview.balanceLines.map((line) => (
          <BalanceLineChart
            key={line.currency}
            line={line}
            chartWidth={chartWidth}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
