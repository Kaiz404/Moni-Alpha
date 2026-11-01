import { router, useScrollToTop } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  BillsList,
  type BillLook,
} from '@/components/budget/bills-list';
import { BudgetRings } from '@/components/budget/budget-rings';
import { CalendarView } from '@/components/budget/calendar-view';
import { MerchantList } from '@/components/budget/merchant-list';
import { openSpending } from '@/components/budget/open-spending';
import { ReportRow } from '@/components/budget/report-row';
import { SpendRing } from '@/components/budget/spend-ring';
import {
  useBudgetData,
  useBudgetMonth,
} from '@/components/budget/use-budget';
import { openCaptureChooser } from '@/components/nav/capture-chooser';
import { useTabBarClearance } from '@/components/nav/tab-bar';
import { SyncBanner } from '@/components/providers/sync-banner';
import { Button } from '@/components/ui/button';
import { EmptyTile } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { lastPaymentBySeries } from '@/lib/finance/bills';
import {
  leftSentence,
  monthKey,
  monthName,
  monthShort,
  spendMonths,
  spendSlices,
  type BudgetMonth,
} from '@/lib/finance/budget-month';
import { formatMoney } from '@/lib/finance/format-money';
import { buildReport, changePhrase } from '@/lib/reports/report';
import { openSheet } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';

type BudgetView = 'month' | 'calendar';

const VIEWS = [
  { value: 'month', label: 'Month' },
  { value: 'calendar', label: 'Calendar' },
] as const;

export default function BudgetScreen() {
  const scroll = useRef<ScrollView>(null);
  useScrollToTop(scroll);
  const tokens = useThemeTokens();
  const clearance = useTabBarClearance();
  const data = useBudgetData();
  const current = monthKey(data.now);
  const [chosen, setChosen] = useState<string | null>(null);
  const month = chosen ?? current;
  const [view, setView] = useState<BudgetView>('month');
  const budget = useBudgetMonth(data, month);
  const months = useMemo(
    () => spendMonths(data.transactions, data.currency, data.now),
    [data.transactions, data.currency, data.now],
  );
  const categoriesById = useMemo(
    () =>
      Object.fromEntries(
        data.categories.map((category) => [category.id, category]),
      ),
    [data.categories],
  );

  const chooseMonth = async () => {
    const picked = await openSheet({
      kind: 'month',
      selected: month,
      months: months.map((item) => {
        const [year] = item.month.split('-');
        const spent = formatMoney(item.spentMinor, data.currency);
        return {
          month: item.month,
          name: `${monthName(item.month)} ${year}`,
          meta:
            item.month === current
              ? `${spent} so far`
              : `${spent} spent`,
        };
      }),
    });
    if (picked) setChosen(picked === current ? null : picked);
  };

  return (
    <Page
      screen="budget"
      kind="tabRoot"
      title="Budget"
      trailing={
        data.wallets.length ? (
          <Press
            testID={tid('budget', 'month')}
            onPress={chooseMonth}
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
        ref={scroll}
        className="flex-1"
        contentContainerClassName="gap-3 px-5"
        contentContainerStyle={{ paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}
      >
        <SyncBanner screen="budget" />
        {!data.wallets.length ? (
          <EmptyTile
            icon="wallet-outline"
            title="Start with one wallet"
            body="A bank account, an e-wallet or the cash in your pocket."
            action={{
              testID: tid('budget', 'add-a-wallet'),
              label: 'Add a wallet',
              icon: 'plus',
              onPress: () => router.push('/wallet/new'),
            }}
          />
        ) : (
          <>
            <Segmented
              screen="budget"
              name="view"
              options={VIEWS}
              value={view}
              onChange={setView}
              accessibilityLabel="Budget view"
            />
            {view === 'month' ? (
              <MonthView
                budget={budget}
                data={data}
                monthsSpent={months}
              />
            ) : (
              <CalendarView
                month={budget}
                transactions={data.transactions}
                categoriesById={categoriesById}
                walletNames={data.walletNames}
                bills={data.bills}
                aliases={data.aliases}
                now={data.now}
              />
            )}
          </>
        )}
      </ScrollView>
    </Page>
  );
}

function MonthView({
  budget,
  data,
  monthsSpent,
}: {
  budget: BudgetMonth;
  data: ReturnType<typeof useBudgetData>;
  monthsSpent: { month: string; spentMinor: number }[];
}) {
  const { currency } = budget;
  const name = monthName(budget.month);
  const sentence = leftSentence(budget);
  const looks = useMemo(() => {
    const latest = lastPaymentBySeries(data.transactions);
    const categories = Object.fromEntries(
      data.categories.map((category) => [category.id, category]),
    );
    const result: Record<string, BillLook> = {};
    for (const bill of budget.billsDue) {
      const payment = latest.get(bill.seriesKey);
      const category = payment?.categoryId
        ? categories[payment.categoryId]
        : undefined;
      result[bill.seriesKey] = {
        wallet: payment
          ? (data.walletNames[payment.walletId] ?? null)
          : null,
        icon: category?.icon ?? null,
        color: category?.color ?? null,
      };
    }
    return result;
  }, [
    budget.billsDue,
    data.transactions,
    data.categories,
    data.walletNames,
  ]);

  const history = monthsSpent
    .filter((item) => item.month < budget.month)
    .slice(0, 3);
  const emptyBody =
    history.length === 3
      ? `You spent about ${formatMoney(
          history.reduce((sum, item) => sum + item.spentMinor, 0) / 3,
          currency,
          { whole: true },
        )} a month from ${monthName(history[2].month)} to ${monthName(history[0].month)}. Set budgets and Moni starts each category from there.`
      : 'Set a budget for each category and this tab shows what is left as you spend.';
  const firstExpense = budget.isCurrent && budget.spentMinor === 0;
  const slices = useMemo(
    () =>
      spendSlices(
        data.transactions,
        budget.month,
        currency,
        data.everyCategory,
      ),
    [data.transactions, budget.month, currency, data.everyCategory],
  );
  const report = useMemo(
    () =>
      buildReport({
        month: budget.month,
        now: data.now,
        currency,
        transactions: data.transactions,
        categories: data.everyCategory,
        aliases: data.aliases,
      }),
    [budget.month, data.now, currency, data.transactions, data.everyCategory, data.aliases],
  );

  return (
    <View className="gap-3">
      <View
        accessibilityLabel={`Spent in ${name}`}
        className="gap-2 rounded-card bg-card px-[18px] py-3.5"
      >
        <Text
          variant="caps"
          className="text-muted"
        >
          {`Spent in ${name}`}
        </Text>
        <SpendRing
          slices={slices}
          totalMinor={budget.spentMinor}
          budgetMinor={budget.budgetMinor}
          currency={currency}
          month={budget.month}
          monthName={name}
        />
        {sentence ? (
          <Text
            testID={tid('budget', 'left')}
            variant="meta"
            className="text-ink-2"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {sentence}
          </Text>
        ) : null}
        {firstExpense ? (
          <View className="items-start gap-2 pt-1">
            <Text
              variant="meta"
              className="text-ink-2"
            >
              Add one with the +, or let Moni read your alerts.
            </Text>
            <Button
              testID={tid('budget', 'add-expense')}
              label="Add an expense"
              icon="plus"
              variant="secondary"
              onPress={() => void openCaptureChooser()}
            />
          </View>
        ) : null}
      </View>
      <View className="mt-2">
        <BudgetRings
          budgeted={budget.budgeted}
          unbudgeted={budget.unbudgeted}
          currency={currency}
          month={budget.month}
          emptyBody={emptyBody}
        />
      </View>
      {budget.isCurrent ? (
        <View className="mt-2">
          <BillsList
            bills={budget.billsDue}
            looks={looks}
            now={data.now}
            currency={currency}
            monthEnd={`${budget.daysInMonth} ${monthShort(budget.month)}`}
            onOpen={(bill) =>
              router.push({
                pathname: '/bill/[seriesKey]',
                params: { seriesKey: bill.seriesKey },
              })
            }
            onAdd={() => router.push('/bill/new')}
          />
        </View>
      ) : null}
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
                testID={tid('budget', 'by-category', row.categoryId ?? 'none')}
                icon={row.icon}
                color={row.color}
                title={row.name}
                meta={
                  changePhrase(row.spentMinor, row.previousMinor, report.comparison, currency) ??
                  `Nothing in ${report.comparison.label}`
                }
                amount={formatMoney(row.spentMinor, currency)}
                onPress={() =>
                  openSpending({ kind: 'category', categoryId: row.categoryId }, budget.month)
                }
              />
            ))}
          </ListCard>
        </View>
      ) : null}
      {report.merchants.length ? (
        <View className="mt-2">
          <MerchantList
            merchants={report.merchants}
            note={
              report.merchantCount > report.merchants.length
                ? `${report.merchantCount} merchants`
                : undefined
            }
            currency={currency}
            walletNames={data.walletNames}
            look={(merchant) => merchant}
            onOpen={(merchant) =>
              openSpending({ kind: 'merchant', name: merchant.name }, budget.month)
            }
          />
        </View>
      ) : null}
    </View>
  );
}
