import { useValue } from '@legendapp/state/react';
import type { MinorAmount } from '@repo/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import {
  BillsList,
  type BillLook,
} from '@/components/budget/bills-list';
import { MerchantList } from '@/components/budget/merchant-list';
import { useMerchantNames } from '@/components/merchants/use-merchant-names';
import { useBudgetData } from '@/components/budget/use-budget';
import { PaceChart } from '@/components/charts/pace-chart';
import { monthFromKey } from '@/components/charts/pace-geometry';
import { Button } from '@/components/ui/button';
import { NotFound } from '@/components/ui/empty-tile';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InPlaceField, InPlaceGroup, type Saved } from '@/components/ui/in-place-field';
import { ListCard } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Text } from '@/components/ui/text';
import {
  TintBubble,
  TransactionRow,
} from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { merchantKey } from '@/lib/ai/routine';
import { dayLabel } from '@/lib/dates/day-label';
import { lastPaymentBySeries } from '@/lib/finance/bills';
import { budgetNote } from '@/lib/finance/budget-note';
import {
  cumulativeSpend,
  dailySpend,
  daysInMonth,
  monthKey,
  monthName,
  monthSpend,
  topMerchants,
} from '@/lib/finance/budget-month';
import { currencySymbol, formatMoney } from '@/lib/finance/format-money';
import { merchantName } from '@/lib/finance/merchant-name';
import { PLAN_LIMIT_MINOR } from '@/lib/finance/money';
import { pendingProposals$ } from '@/lib/finance/selectors';
import { openSheet } from '@/lib/sheet/sheet-store';
import { forgetMerchantName, nameMerchant } from '@/lib/supabase/merchant-aliases';
import {
  deleteCategoryBudget,
  upsertCategoryBudget,
} from '@/lib/supabase/category-budgets';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import { proposalRow, transactionRow } from '@/lib/transactions/row';

const SHOWN_ROWS = 5;

const leftTone = {
  plain: 'text-foreground',
  quiet: 'text-foreground',
  near: 'text-state-attention',
  over: 'text-over',
} as const;

/** The one page per category (`V2P-BudgetDetail`): its month, its budget in place, its rows. */
export default function CategoryBudgetScreen() {
  const params = useLocalSearchParams<{
    categoryId: string;
    month?: string;
  }>();
  const tokens = useThemeTokens();
  const data = useBudgetData();
  const { currency, now } = data;
  const month = params.month ?? monthKey(now);
  const isCurrent = month === monthKey(now);
  const category = data.categories.find(
    (item) => item.id === params.categoryId,
  );
  const budgetMinor =
    data.budgets.find(
      (budget) =>
        budget.categoryId === params.categoryId &&
        budget.currency === currency,
    )?.amountMinor ?? null;
  const proposals = useValue(pendingProposals$(data.userId));

  const spend = useMemo(
    () =>
      monthSpend(
        data.transactions,
        month,
        currency,
        params.categoryId,
      ).map((transaction) =>
        transaction.merchant
          ? { ...transaction, merchant: merchantName(transaction.merchant, data.aliases) }
          : transaction,
      ),
    [data.transactions, data.aliases, month, currency, params.categoryId],
  );
  const { toName } = useMerchantNames();
  const { series, chartSeries } = useMemo(() => {
    const { daily, throughDay } = dailySpend(spend, month, now);
    return {
      series: cumulativeSpend(daily, throughDay),
      chartSeries: { month: monthFromKey(month), values: daily.slice(0, throughDay) },
    };
  }, [spend, month, now]);
  const spentMinor = series[series.length - 1] ?? (0 as MinorAmount);
  const { merchants, count: merchantCount } = useMemo(
    () => topMerchants(spend, 3),
    [spend],
  );
  const pending = proposals.filter(
    (proposal) =>
      proposal.categoryId === params.categoryId &&
      proposal.currency === currency &&
      isCurrent,
  );
  const latest = useMemo(
    () => lastPaymentBySeries(data.transactions),
    [data.transactions],
  );
  const bills = isCurrent
    ? data.bills.filter(
        (bill) =>
          bill.status === 'due' &&
          bill.currency === currency &&
          latest.get(bill.seriesKey)?.categoryId ===
            params.categoryId,
      )
    : [];

  if (!category)
    return (
      <Page
        screen="budget"
        kind="pushed"
        title="Budget"
      >
        <NotFound
          icon="chart-box"
          title="This category is gone"
          body="It may have been deleted on another device."
        />
      </Page>
    );

  const name = monthName(month);
  const look = { icon: category.icon, color: category.color };
  const note =
    budgetMinor === null
      ? null
      : budgetNote(spentMinor, budgetMinor, currency);
  const daysLeft = daysInMonth(month) - now.getDate() + 1;
  const bubbleIcon = resolveTransactionIcon(category.icon, 'expense');
  const billLooks: Record<string, BillLook> = Object.fromEntries(
    bills.map((bill) => {
      const payment = latest.get(bill.seriesKey);
      return [
        bill.seriesKey,
        {
          wallet: payment
            ? (data.walletNames[payment.walletId] ?? null)
            : null,
          ...look,
        },
      ];
    }),
  );
  const lookup = {
    categoriesById: { [category.id]: category },
    walletNames: data.walletNames,
  };

  const save = async (typedMinor: MinorAmount): Promise<Saved | void> => {
    const before = budgetMinor;
    if (typedMinor === before) return;
    await upsertCategoryBudget(category.id, currency, typedMinor);
    return {
      text: `${category.name} budget is ${formatMoney(typedMinor, currency, { whole: true })} from ${monthName(monthKey(now))}`,
      undo: () =>
        void (before === null
          ? deleteCategoryBudget(category.id, currency)
          : upsertCategoryBudget(category.id, currency, before)),
    };
  };
  const removeBudget = async () => {
    if (budgetMinor === null) return;
    const confirmed = await openSheet({
      kind: 'confirm',
      title: `Remove the ${category.name} budget?`,
      message:
        'Spending in this category still counts toward the month.',
      confirmLabel: 'Remove budget',
      destructive: true,
    });
    if (!confirmed) return;
    await deleteCategoryBudget(category.id, currency);
    showToast({
      text: `${category.name} budget removed`,
      tone: 'removed',
      undo: () =>
        void upsertCategoryBudget(category.id, currency, budgetMinor),
    });
  };

  return (
    <Page
      screen="budget"
      kind="pushed"
      title={category.name}
      trailing={
        budgetMinor !== null ? (
          <HeaderIconButton
            testID={tid('budget', 'category', 'more')}
            icon="dots-horizontal"
            accessibilityLabel={`More actions for ${category.name}: remove budget`}
            onPress={removeBudget}
          />
        ) : null
      }
    >
      <InPlaceGroup>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3.5 px-5 pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2.5">
          <View className="gap-0.5">
            <Text
              variant="caps"
              className="text-muted"
            >
              {`Spent in ${name}`}
            </Text>
            <View className="flex-row flex-wrap items-baseline gap-2">
              <Text
                testID={tid('budget', 'category', 'spent')}
                variant="amountHero"
                className="text-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatMoney(spentMinor, currency)}
              </Text>
              {budgetMinor !== null ? (
                <Text className="text-[17px] leading-[22px] font-display-semibold text-ink-2">
                  {`of ${formatMoney(budgetMinor, currency, { whole: true })}`}
                </Text>
              ) : null}
            </View>
          </View>
          {note ? (
            <View className="gap-2">
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`${formatMoney(spentMinor, currency)} of ${formatMoney(budgetMinor ?? 0, currency, { whole: true })}, ${note.label}`}
                className="h-3 overflow-hidden rounded-full bg-track"
              >
                <View
                  className={`absolute inset-y-0 left-0 rounded-full ${note.tone === 'over' ? 'bg-coral' : 'bg-ink-2'}`}
                  style={{ width: `${(note.ratio ?? 0) * 100}%` }}
                />
              </View>
              <View className="flex-row justify-between">
                <Text
                  testID={tid('budget', 'category', 'left')}
                  className={`text-[15px] leading-5 font-display-bold ${leftTone[note.tone]}`}
                >
                  {note.label}
                </Text>
                {isCurrent ? (
                  <Text className="text-[15px] leading-5 text-muted">
                    {daysLeft === 1
                      ? '1 day left'
                      : `${daysLeft} days left`}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        <InPlaceField
          testID={tid('budget', 'category-budget')}
          label={`Monthly budget for ${category.name}`}
          kind="amount"
          prefix={currencySymbol(currency)}
          whole
          max={PLAN_LIMIT_MINOR}
          value={budgetMinor}
          hint={(typedMinor) =>
            typedMinor !== null ? (
              <ProgressBar
                spentMinor={spentMinor}
                budgetMinor={typedMinor}
                currency={currency}
                title={`Spent ${formatMoney(spentMinor, currency)} of ${formatMoney(typedMinor, currency, { whole: true })}`}
              />
            ) : (
              <Text className="pl-1 text-[13px] leading-[18px] text-muted">
                {`Type an amount above ${formatMoney(0, currency, { whole: true })}.`}
              </Text>
            )
          }
          onSave={save}
        >
          {({ editable, editor, open }) =>
            editor ? (
              <View className="gap-2 rounded-card bg-card p-3.5">
                <Text className="pl-1 text-[13px] leading-[18px] text-muted">
                  {`Monthly budget for ${category.name}`}
                </Text>
                {editor}
              </View>
            ) : budgetMinor !== null ? (
              <ListCard>
                <View className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3.5">
                  <TintBubble
                    icon={bubbleIcon}
                    color={category.color}
                  />
                  <View className="min-w-0 flex-1">
                    <Text
                      variant="rowTitle"
                      className="text-foreground"
                    >
                      Monthly budget
                    </Text>
                    <Text
                      variant="meta"
                      className="text-muted"
                    >
                      Every month
                    </Text>
                  </View>
                  {editable(
                    <Text
                      variant="rowTitle"
                      className="text-foreground"
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {formatMoney(budgetMinor, currency, { whole: true })}
                    </Text>,
                    {
                      accessibilityLabel: `Monthly budget ${formatMoney(budgetMinor, currency, { whole: true })}. Edit`,
                    },
                  )}
                </View>
              </ListCard>
            ) : (
              <View className="items-start gap-2.5 rounded-tile border-[1.5px] border-dashed border-border-strong px-[18px] py-[22px]">
                <TintBubble
                  icon={bubbleIcon}
                  color={category.color}
                />
                <Text
                  variant="cardTitle"
                  className="text-foreground"
                >
                  {`No budget for ${category.name}`}
                </Text>
                <Text className="text-[14px] leading-5 text-ink-2">
                  {[
                    "Set one and this page shows what's left as you go.",
                    bills[0]
                      ? `${bills[0].name}, ${formatMoney(bills[0].amountMinor, currency)}, is due ${dayLabel(bills[0].dueDate, now)}.`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </Text>
                <Press
                  testID={tid('budget', 'category', 'set-budget')}
                  accessibilityLabel={`Set a budget for ${category.name}`}
                  onPress={open}
                  radius={{ rest: 22, pressed: 16 }}
                  pressedClassName="bg-hairline"
                  className="h-11 flex-row items-center gap-1.5 bg-sand pl-3.5 pr-[18px]"
                >
                  <IconSymbol
                    name="plus"
                    size={20}
                    color={tokens.foreground}
                  />
                  <Text className="text-[15px] leading-5 font-display-semibold text-foreground">
                    Set a budget
                  </Text>
                </Press>
              </View>
            )
          }
        </InPlaceField>

        <View className="gap-2 rounded-card bg-card px-[18px] py-3.5">
          <View className="flex-row items-center justify-between">
            <Text
              variant="caps"
              className="text-muted"
            >
              {`${name} so far`}
            </Text>
            <Text
              variant="meta"
              className="text-muted"
            >
              {spend.length === 1
                ? '1 payment'
                : `${spend.length} payments`}
            </Text>
          </View>
          <PaceChart
            screen="budget"
            mode="pace"
            series={chartSeries}
            budget={budgetMinor}
            currency={currency}
            endsToday={isCurrent}
            what={`${category.name} spending so far in ${name}`}
          />
        </View>

        {bills.length ? (
          <View className="mt-1.5">
            <BillsList
              bills={bills}
              looks={billLooks}
              now={now}
              currency={currency}
              onOpen={(bill) =>
                router.push({
                  pathname: '/bill/[seriesKey]',
                  params: { seriesKey: bill.seriesKey },
                })
              }
            />
          </View>
        ) : null}

        {spend.length || pending.length ? (
          <View className="mt-1.5 gap-2">
            <View className="min-h-11 flex-row items-center justify-between">
              <Text
                variant="sectionTitle"
                className="text-foreground"
                accessibilityRole="header"
              >
                Transactions
              </Text>
              {spend.length > SHOWN_ROWS ? (
                <Button
                  testID={tid('budget', 'category', 'see-all')}
                  variant="tertiary"
                  label="See all"
                  icon="chevron-right"
                  className="-mr-3.5"
                  onPress={() =>
                    router.dismissTo({
                      pathname: '/activity',
                      params: { categoryId: category.id, month },
                    })
                  }
                />
              ) : null}
            </View>
            <ListCard>
              {pending.map((proposal) => (
                <TransactionRow
                  key={proposal.id}
                  testID={tid(
                    'budget',
                    'category',
                    'pending',
                    proposal.id,
                  )}
                  row={proposalRow(proposal, lookup)}
                  metaLead="date"
                  now={now}
                  onPress={() =>
                    router.push({
                      pathname: '/review',
                      params: { id: proposal.id },
                    })
                  }
                />
              ))}
              {spend.slice(0, SHOWN_ROWS).map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  testID={tid(
                    'budget',
                    'category',
                    'row',
                    transaction.id,
                  )}
                  row={transactionRow(transaction, lookup)}
                  metaLead="date"
                  now={now}
                  onPress={() =>
                    router.push({
                      pathname: '/transaction/[id]',
                      params: { id: transaction.id },
                    })
                  }
                />
              ))}
            </ListCard>
          </View>
        ) : null}

        <View className="mt-1.5">
          <MerchantList
            merchants={merchants}
            note={
              merchantCount === 1
                ? '1 merchant'
                : `${merchantCount} merchants`
            }
            currency={currency}
            walletNames={data.walletNames}
            look={() => look}
            codeKey={(merchant) => {
              const key = merchantKey(merchant.name);
              return key && toName.some((entry) => entry.key === key) ? key : null;
            }}
            onName={async (key, raw, typed) => {
              await nameMerchant(key, typed);
              return {
                text: `${raw} is now ${typed}`,
                undo: () => void forgetMerchantName(key),
              };
            }}
          />
        </View>
      </ScrollView>
      </InPlaceGroup>
    </Page>
  );
}
