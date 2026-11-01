import { useValue } from '@legendapp/state/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useBudgetData } from '@/components/budget/use-budget';
import { categoryLink, merchantLink } from '@/components/reports/report-link';
import { ReportRow } from '@/components/reports/report-row';
import { TrendChart } from '@/components/reports/trend-chart';
import { EmptyTile } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { PickerField } from '@/components/ui/picker-field';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { dayLabel } from '@/lib/dates/day-label';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { monthKey, monthName, spendMonths } from '@/lib/finance/budget-month';
import { formatMoney, formatSignedMoney } from '@/lib/finance/format-money';
import { financeProjection$ } from '@/lib/finance/projection';
import {
  buildReport,
  changePhrase,
  periodRange,
  rangeLabel,
  type ReportPeriod,
  type ReportRange,
} from '@/lib/reports/report';
import { openSheet } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';

type ReportView = 'month' | 'custom';

const VIEWS = [
  { value: 'month', label: 'Month' },
  { value: 'custom', label: 'Custom' },
] as const;

export default function ReportsScreen() {
  const tokens = useThemeTokens();
  const params = useLocalSearchParams<{ month?: string }>();
  const data = useBudgetData();
  const current = monthKey(data.now);
  const [view, setView] = useState<ReportView>('month');
  const [month, setMonth] = useState(
    params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : current,
  );
  const [range, setRange] = useState<ReportRange>(() => ({
    from: `${current}-01`,
    to: toLocalDateInput(data.now),
  }));
  const categories = useValue(() =>
    Object.values(financeProjection$.categoriesById.get()).filter(
      (category) => category.userId === null || category.userId === data.userId,
    ),
  );
  const period = useMemo<ReportPeriod>(
    () => (view === 'month' ? { kind: 'month', month } : { kind: 'custom', ...range }),
    [view, month, range],
  );
  const report = useMemo(
    () =>
      buildReport({
        period,
        now: data.now,
        currency: data.currency,
        transactions: data.transactions,
        categories,
        aliases: data.aliases,
      }),
    [period, data.now, data.currency, data.transactions, categories, data.aliases],
  );
  const months = useMemo(
    () => spendMonths(data.transactions, data.currency, data.now),
    [data.transactions, data.currency, data.now],
  );

  const chooseMonth = async () => {
    const picked = await openSheet({
      kind: 'month',
      selected: month,
      months: months.map((item) => ({
        month: item.month,
        name: `${monthName(item.month)} ${item.month.slice(0, 4)}`,
        meta: `${formatMoney(item.spentMinor, data.currency)} ${item.month === current ? 'so far' : 'spent'}`,
      })),
    });
    if (picked) setMonth(picked);
  };
  const chooseDay = async (end: keyof ReportRange) => {
    const picked = await openSheet({ kind: 'date', selected: range[end] });
    if (picked) setRange(periodRange({ kind: 'custom', ...range, [end]: picked }));
  };
  const openInActivity = (link: Record<string, string>) =>
    router.dismissTo({ pathname: '/activity', params: link });

  const { currency, comparison } = report;
  const change = changePhrase(report.spentMinor, report.previousSpentMinor, comparison, currency);
  const name =
    period.kind === 'month'
      ? period.month.slice(0, 4) === current.slice(0, 4)
        ? monthName(period.month)
        : `${monthName(period.month)} ${period.month.slice(0, 4)}`
      : rangeLabel(report.range, data.now);

  return (
    <Page
      screen="reports"
      kind="pushed"
      title="Reports"
      trailing={
        view === 'month' && data.wallets.length ? (
          <Press
            testID={tid('reports', 'month')}
            onPress={() => void chooseMonth()}
            accessibilityLabel={`Month: ${monthName(month)} ${month.slice(0, 4)}. Change month`}
            accessibilityHint="Opens a picker"
            radius={{ rest: 22, pressed: 16 }}
            pressedClassName="bg-hairline"
            className="h-11 flex-row items-center gap-1 bg-sand pl-4 pr-3"
          >
            <Text className="text-[15px] leading-[21px] font-display-semibold text-foreground">
              {monthName(month)}
            </Text>
            <IconSymbol
              name="chevron-down"
              size={18}
              color={tokens.foreground}
            />
          </Press>
        ) : null
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {!data.wallets.length ? (
          <EmptyTile
            icon="wallet-outline"
            title="Start with one wallet"
            body="A bank account, an e-wallet or the cash in your pocket."
            action={{
              testID: tid('reports', 'add-a-wallet'),
              label: 'Add a wallet',
              icon: 'plus',
              onPress: () => router.push('/wallet/new'),
            }}
          />
        ) : (
          <>
            <Segmented
              screen="reports"
              name="view"
              options={VIEWS}
              value={view}
              onChange={setView}
              accessibilityLabel="Report period"
            />
            {view === 'custom' ? (
              <View className="flex-row gap-2">
                <PickerField
                  testID={tid('reports', 'from')}
                  label="From"
                  value={dayLabel(report.range.from, data.now)}
                  onPress={() => void chooseDay('from')}
                  className="flex-1"
                />
                <PickerField
                  testID={tid('reports', 'to')}
                  label="To"
                  value={dayLabel(report.range.to, data.now)}
                  onPress={() => void chooseDay('to')}
                  className="flex-1"
                />
              </View>
            ) : null}
            <View className="gap-2 rounded-card bg-card px-[18px] py-3.5">
              <Text
                variant="caps"
                className="text-muted"
                numberOfLines={1}
              >
                {name}
              </Text>
              <View className="flex-row gap-3">
                <View className="min-w-0 flex-1">
                  <Text
                    variant="meta"
                    className="text-ink-2"
                  >
                    Spent
                  </Text>
                  <Text
                    testID={tid('reports', 'spent')}
                    variant="sectionTitle"
                    className="text-foreground"
                    style={{ fontVariant: ['tabular-nums'] }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatMoney(report.spentMinor, currency)}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    variant="meta"
                    className="text-ink-2"
                  >
                    Money in
                  </Text>
                  <Text
                    testID={tid('reports', 'in')}
                    variant="sectionTitle"
                    className="text-deep-mint"
                    style={{ fontVariant: ['tabular-nums'] }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatSignedMoney('income', report.inMinor, currency)}
                  </Text>
                </View>
              </View>
              {change ? (
                <Text
                  variant="meta"
                  className="text-ink-2"
                  numberOfLines={1}
                >
                  {change}
                </Text>
              ) : null}
              <TrendChart
                trend={report.trend}
                selected={period.kind === 'month' ? period.month : null}
                currency={currency}
                onSelect={(picked) => {
                  setMonth(picked);
                  setView('month');
                }}
              />
            </View>
            {report.categories.length ? (
              <View className="mt-2 gap-2">
                <Text
                  variant="sectionTitle"
                  className="text-foreground"
                  accessibilityRole="header"
                >
                  By category
                </Text>
                <ListCard>
                  {report.categories.map((row) => (
                    <ReportRow
                      key={row.categoryId ?? 'none'}
                      testID={tid('reports', 'category', row.categoryId ?? 'none')}
                      icon={row.icon}
                      color={row.color}
                      title={row.name}
                      meta={
                        changePhrase(row.spentMinor, row.previousMinor, comparison, currency) ??
                        `Nothing in ${comparison.label}`
                      }
                      amount={formatMoney(row.spentMinor, currency)}
                      onPress={() => openInActivity(categoryLink(row.categoryId, report.range))}
                    />
                  ))}
                </ListCard>
              </View>
            ) : (
              <EmptyTile
                icon="chart-bar"
                tone="quiet"
                title="Nothing spent in this period"
                body="Pick another month, or tap a bar with spending."
              />
            )}
            {report.merchants.length ? (
              <View className="mt-2 gap-2">
                <View className="flex-row items-baseline justify-between">
                  <Text
                    variant="sectionTitle"
                    className="text-foreground"
                    accessibilityRole="header"
                  >
                    Top merchants
                  </Text>
                  {report.merchantCount > report.merchants.length ? (
                    <Text
                      variant="meta"
                      className="text-muted"
                    >
                      {`${report.merchantCount} merchants`}
                    </Text>
                  ) : null}
                </View>
                <ListCard>
                  {report.merchants.map((merchant) => {
                    const category = categories.find((item) => item.id === merchant.categoryId);
                    return (
                      <ReportRow
                        key={merchant.name}
                        testID={tid('reports', 'merchant', merchant.name)}
                        icon={category?.icon ?? null}
                        color={category?.color ?? null}
                        title={merchant.name}
                        meta={`${merchant.payments === 1 ? '1 payment' : `${merchant.payments} payments`} · ${data.walletNames[merchant.walletId] ?? 'Wallet'}`}
                        amount={formatMoney(merchant.spentMinor, currency)}
                        onPress={() => openInActivity(merchantLink(merchant.name))}
                      />
                    );
                  })}
                </ListCard>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Page>
  );
}
