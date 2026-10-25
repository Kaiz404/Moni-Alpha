import { useValue } from '@legendapp/state/react';
import type { MinorAmount } from '@repo/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { DueDaySheet } from '@/components/budget/due-day-sheet';
import { Toggle } from '@/components/ui/toggle';
import { useBudgetData } from '@/components/budget/use-budget';
import { Button } from '@/components/ui/button';
import { NotFound } from '@/components/ui/empty-tile';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  InPlaceField,
  InPlaceGroup,
  type Saved,
} from '@/components/ui/in-place-field';
import { ListCard } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { PickerField } from '@/components/ui/picker-field';
import { Text } from '@/components/ui/text';
import {
  TintBubble,
  TransactionRow,
} from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { merchantKey } from '@/lib/ai/routine';
import { formatDate } from '@/lib/dates/day-label';
import {
  parseLocalDateInput,
  toLocalDateInput,
} from '@/lib/dates/local-date-input';
import { billPayments } from '@/lib/finance/bills';
import {
  monthKey,
  monthName,
  monthSpend,
} from '@/lib/finance/budget-month';
import { currencySymbol, formatMoney } from '@/lib/finance/format-money';
import { PLAN_LIMIT_MINOR } from '@/lib/finance/money';
import { ensureBillReminderPermission, reminderAt } from '@/lib/notifications/bill-reminder';
import { openSheet } from '@/lib/sheet/sheet-store';
import { autoAddRules$, wallets$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import {
  createAutoAddRule,
  deleteAutoAddRule,
  type AutoAddRuleRow,
} from '@/lib/supabase/auto-add-rules';
import {
  updateBill,
  type BillPatch,
} from '@/lib/supabase/recurring-overrides';
import {
  createTransaction,
  deleteTransaction,
} from '@/lib/supabase/transactions';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import { transactionRow } from '@/lib/transactions/row';
import { resolveDefaultWalletId } from '@/lib/wallets/default-wallet';

const HISTORY_ROWS = 3;
const REMINDER_TIME = '9:00 am';


/** The same day of the month after a `YYYY-MM-DD`, clamped to that month's length. */
function nextMonthDay(dueDate: string): Date {
  const due = parseLocalDateInput(dueDate) ?? new Date();
  const length = new Date(
    due.getFullYear(),
    due.getMonth() + 2,
    0,
  ).getDate();
  return new Date(
    due.getFullYear(),
    due.getMonth() + 1,
    Math.min(due.getDate(), length),
  );
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Couldn't save that.";
}

/** `V2P-BillDetail`: one bill, its name and amount in place, its schedule, and its payments. */
export default function BillScreen() {
  const tokens = useThemeTokens();
  const { seriesKey } = useLocalSearchParams<{ seriesKey: string }>();
  const data = useBudgetData();
  const { now, currency } = data;
  const bill = data.bills.find(
    (item) => item.seriesKey === seriesKey,
  );
  const override = data.overrides.find(
    (item) => item.seriesKey === seriesKey,
  );
  const [dueOpen, setDueOpen] = useState(false);
  const payments = useMemo(
    () =>
      seriesKey ? billPayments(data.transactions, seriesKey) : [],
    [data.transactions, seriesKey],
  );
  const rules = useValue(() =>
    getRecordValues<AutoAddRuleRow>(autoAddRules$).filter(
      (rule) =>
        rule.user_id === data.userId &&
        rule.merchant_key === seriesKey?.split('|')[2],
    ),
  );
  const linkedApps = useValue(() =>
    Object.fromEntries(
      getRecordValues<{
        id: string;
        notification_package: string | null;
      }>(wallets$).map((wallet) => [
        wallet.id,
        wallet.notification_package,
      ]),
    ),
  );

  if (!bill)
    return (
      <Page
        screen="budget"
        kind="pushed"
        title="Bill"
      >
        <NotFound
          icon="repeat"
          title="This bill isn't due this month"
          body="It may have been stopped or skipped on another device."
        />
      </Page>
    );

  const mainWallets = data.wallets.filter(
    (wallet) => wallet.currency === bill.currency,
  );
  const walletId =
    bill.walletId &&
    mainWallets.some((wallet) => wallet.id === bill.walletId)
      ? bill.walletId
      : (resolveDefaultWalletId(mainWallets) ??
        mainWallets[0]?.id ??
        null);
  const wallet = data.wallets.find((item) => item.id === walletId);
  const category = data.categories.find(
    (item) => item.id === bill.categoryId,
  );
  const once = Boolean(override?.dueOnce);
  const open = bill.status === 'due';
  const period = monthKey(now);
  const nextDue =
    open || once
      ? (parseLocalDateInput(bill.dueDate) ?? now)
      : nextMonthDay(bill.dueDate);
  const remindOn = override?.remind === true;
  const reminder = reminderAt(toLocalDateInput(nextDue));
  const sourceApp = walletId ? linkedApps[walletId] : null;
  const rule = rules.find((item) => item.source_app === sourceApp);
  const lookup = {
    categoriesById: Object.fromEntries(
      data.categories.map((item) => [item.id, item]),
    ),
    walletNames: data.walletNames,
  };

  const save = async (
    patch: BillPatch,
    toast: string,
    undo: BillPatch,
  ) => {
    try {
      await updateBill(bill, patch);
      showToast({
        text: toast,
        undo: () => void updateBill(bill, undo),
      });
    } catch (error) {
      showToast({ text: errorText(error), tone: 'removed' });
    }
  };
  const update = async (patch: BillPatch, undo: BillPatch): Promise<Saved> => {
    await updateBill(bill, patch);
    return { undo: () => void updateBill(bill, undo) };
  };

  const markPaid = async () => {
    if (!walletId) {
      showToast({ text: 'Add a wallet first.', tone: 'removed' });
      return;
    }
    const lastMerchant = payments[0]?.merchant;
    const merchant =
      lastMerchant ??
      (merchantKey(bill.name) === seriesKey.split('|')[2]
        ? bill.name
        : seriesKey.split('|')[2]);
    const paid = await createTransaction(
      {
        walletId,
        amountMinor: bill.amountMinor,
        type: 'expense',
        categoryId: bill.categoryId,
        merchant,
        transactionDate: new Date().toISOString(),
      },
      'manual',
    );
    showToast({
      text: `${bill.name} marked paid`,
      undo: () => void deleteTransaction(paid.id),
    });
  };
  const skip = () =>
    save({ skipPeriod: period }, `${monthName(period)} skipped`, {
      skipPeriod: override?.skipPeriod ?? null,
    });
  const pickDue = async (picked: string) => {
    setDueOpen(false);
    const day = Number(picked.slice(8));
    const was = Number(bill.dueDate.slice(8));
    await save(
      once
        ? { dueOnce: picked, expectedDay: day }
        : { expectedDay: day },
      `Due ${formatDate(parseLocalDateInput(picked) ?? now, now)}`,
      once
        ? { dueOnce: override?.dueOnce ?? null, expectedDay: was }
        : { expectedDay: was },
    );
  };
  const pickWallet = async () => {
    const picked = await openSheet({
      kind: 'wallet',
      title: 'Pays from',
      selectedId: walletId,
      wallets: mainWallets.map((item) => ({
        id: item.id,
        name: item.name,
        currency: item.currency,
        type: item.type,
        icon: item.icon,
        color: item.color,
        cardStyleId: item.cardStyleId,
      })),
    });
    if (!picked?.walletId || picked.walletId === walletId) return;
    const name = data.walletNames[picked.walletId];
    await save({ walletId: picked.walletId }, `Pays from ${name}`, {
      walletId: override?.walletId ?? null,
    });
  };
  const pickCategory = async () => {
    const spent = new Map<string, number>();
    for (const row of monthSpend(data.transactions, period, currency))
      if (row.categoryId)
        spent.set(
          row.categoryId,
          (spent.get(row.categoryId) ?? 0) + Number(row.amountMinor),
        );
    const picked = await openSheet({
      kind: 'category',
      title: 'Category',
      currency: bill.currency,
      selectedId: bill.categoryId,
      categories: data.categories.map((item) => ({
        id: item.id,
        name: item.name,
        icon: item.icon,
        color: item.color,
        custom: item.userId !== null,
        spentMinor: (spent.get(item.id) ?? 0) as MinorAmount,
        budgetMinor:
          data.budgets.find(
            (budget) =>
              budget.categoryId === item.id &&
              budget.currency === currency,
          )?.amountMinor ?? null,
      })),
    });
    if (!picked || picked === bill.categoryId) return;
    const name =
      data.categories.find((item) => item.id === picked)?.name ??
      'Category';
    await save({ categoryId: picked }, `Category is ${name}`, {
      categoryId: override?.categoryId ?? null,
    });
  };
  const setRemind = (next: boolean) => {
    if (next) void ensureBillReminderPermission().catch(() => {});
    return save({ remind: next }, next ? 'Reminder on' : 'Reminder off', {
      remind: remindOn,
    });
  };
  const setAutoAdd = async (next: boolean) => {
    try {
      if (!next && rule) deleteAutoAddRule(rule.id);
      if (next && sourceApp && walletId && bill.categoryId)
        await createAutoAddRule({
          merchantKey: seriesKey.split('|')[2],
          sourceApp,
          walletId,
          categoryId: bill.categoryId,
        });
    } catch (error) {
      showToast({ text: errorText(error), tone: 'removed' });
    }
  };
  const stop = async () => {
    const confirmed = await openSheet({
      kind: 'confirm',
      title: `Stop tracking ${bill.name}?`,
      message:
        'It leaves your bills. Payments already recorded stay in Activity.',
      confirmLabel: 'Stop tracking',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await updateBill(bill, { status: 'dismissed' });
      showToast({
        text: `Stopped tracking ${bill.name}`,
        tone: 'removed',
        undo: () => void updateBill(bill, { status: 'confirmed' }),
      });
      router.back();
    } catch (error) {
      showToast({ text: errorText(error), tone: 'removed' });
    }
  };

  const skippedRow = bill.status === 'skipped';
  const history = payments.slice(
    0,
    skippedRow ? HISTORY_ROWS - 1 : HISTORY_ROWS,
  );
  const bubbleIcon = resolveTransactionIcon(
    category?.icon ?? 'repeat',
    'expense',
  );

  return (
    <View className="flex-1">
      <Page
        screen="budget"
        kind="pushed"
        title="Bill"
      >
        <InPlaceGroup>
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-5 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-3">
            <InPlaceField
              testID={tid('budget', 'bill-name')}
              label="Name"
              kind="text"
              required
              maxLength={30}
              value={bill.name}
              hint={(value) => (value === null ? 'A name needs 1 to 30 letters.' : null)}
              onSave={(name) =>
                name === bill.name
                  ? undefined
                  : update({ name }, { name: override?.name ?? null })
              }
            >
              {({ editable, editor }) =>
                editor ?? (
                  <View className="flex-row items-center gap-3">
                    <TintBubble
                      size={52}
                      icon={bubbleIcon}
                      color={category?.color ?? null}
                    />
                    <View className="min-w-0 flex-1">
                      {editable(
                        <Text
                          testID={tid('budget', 'bill', 'name')}
                          variant="sectionTitle"
                          className="text-foreground"
                          numberOfLines={1}
                        >
                          {bill.name}
                        </Text>,
                        { accessibilityLabel: `Edit name, ${bill.name}` },
                      )}
                      <Text
                        variant="meta"
                        className="text-muted"
                      >
                        {once ? 'Bill · just once' : 'Bill · every month'}
                      </Text>
                    </View>
                  </View>
                )
              }
            </InPlaceField>
            <InPlaceField
              testID={tid('budget', 'bill-amount')}
              label="Amount"
              kind="amount"
              prefix={currencySymbol(bill.currency)}
              max={PLAN_LIMIT_MINOR}
              value={bill.amountMinor}
              hint={(value) =>
                value === null
                  ? `Type an amount above ${formatMoney(0, bill.currency, { whole: true })}.`
                  : `From ${formatDate(nextDue, now)} on. Past payments stay as they were.`
              }
              onSave={(expectedAmountMinor) =>
                expectedAmountMinor === bill.amountMinor
                  ? undefined
                  : update(
                      { expectedAmountMinor },
                      { expectedAmountMinor: bill.amountMinor },
                    )
              }
            >
              {({ editable, editor }) =>
                editor ??
                editable(
                  <Text
                    testID={tid('budget', 'bill', 'amount')}
                    variant="amountHero"
                    className="text-foreground"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {formatMoney(bill.amountMinor, bill.currency)}
                  </Text>,
                  {
                    accessibilityLabel: `Edit amount, ${formatMoney(bill.amountMinor, bill.currency)}`,
                  },
                )
              }
            </InPlaceField>
            {open ? (
              <View className="flex-row gap-2">
                <Button
                  testID={tid('budget', 'bill', 'mark-paid')}
                  label="Mark paid"
                  icon="check"
                  className="flex-1"
                  onPress={markPaid}
                />
                <Button
                  testID={tid('budget', 'bill', 'skip')}
                  variant="secondary"
                  label={`Skip ${monthName(period)}`}
                  className="flex-1"
                  onPress={skip}
                />
              </View>
            ) : null}
          </View>

          <View className="gap-2">
            <View className="flex-row gap-2">
              <PickerField
                testID={tid('budget', 'bill', 'due')}
                label={once ? 'Due · once' : 'Next due · monthly'}
                value={formatDate(nextDue, now)}
                className="flex-1"
                leading={
                  <IconSymbol
                    name="calendar"
                    size={18}
                    color={tokens.foreground}
                  />
                }
                onPress={() => setDueOpen(true)}
              />
              <PickerField
                testID={tid('budget', 'bill', 'wallet')}
                label="Pays from"
                value={wallet?.name ?? ''}
                className="flex-1"
                leading={
                  wallet?.color ? (
                    <View
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: wallet.color }}
                    />
                  ) : undefined
                }
                onPress={pickWallet}
              />
            </View>
            <PickerField
              testID={tid('budget', 'bill', 'category')}
              label="Category"
              value={category?.name ?? ''}
              leading={
                category ? (
                  <IconSymbol
                    name={bubbleIcon}
                    size={18}
                    color={tokens.foreground}
                  />
                ) : undefined
              }
              onPress={pickCategory}
            />
          </View>

          <ListCard>
            <SwitchRow
              icon="bell-outline"
              title="Remind me"
              meta={
                remindOn && reminder
                  ? `1 day before, ${REMINDER_TIME}`
                  : 'Off'
              }
            >
              <Toggle
                testID={tid('budget', 'bill', 'remind')}
                accessibilityLabel="Remind me"
                value={remindOn}
                onChange={setRemind}
              />
            </SwitchRow>
            <SwitchRow
              icon="auto-fix"
              title="Auto-add bank alerts"
              meta={
                rule
                  ? 'Added for you, marked Auto'
                  : sourceApp
                    ? 'You approve each alert'
                    : `Link ${wallet?.name ?? 'the wallet'} to its banking app first`
              }
            >
              <Toggle
                testID={tid('budget', 'bill', 'auto-add')}
                accessibilityLabel="Auto-add bank alerts"
                value={Boolean(rule)}
                disabled={!rule && (!sourceApp || !bill.categoryId)}
                onChange={setAutoAdd}
              />
            </SwitchRow>
          </ListCard>

          {history.length || skippedRow ? (
            <View className="gap-2.5 pt-2">
              <View className="flex-row items-center justify-between">
                <Text
                  variant="sectionTitle"
                  className="text-foreground"
                  accessibilityRole="header"
                >
                  History
                </Text>
                {payments.length > history.length ? (
                  <Button
                    testID={tid('budget', 'bill', 'see-all')}
                    variant="tertiary"
                    label="See all"
                    icon="chevron-right"
                    className="-mr-3.5"
                    onPress={() =>
                      router.dismissTo({
                        pathname: '/activity',
                        params: bill.categoryId
                          ? { categoryId: bill.categoryId }
                          : {},
                      })
                    }
                  />
                ) : null}
              </View>
              <ListCard>
                {skippedRow ? (
                  <View
                    accessible
                    accessibilityLabel={`${bill.name}, skipped in ${monthName(period)}`}
                    className="h-[66px] flex-row items-center gap-3.5 px-[18px]"
                  >
                    <TintBubble
                      icon={bubbleIcon}
                      color={category?.color ?? null}
                    />
                    <View className="min-w-0 flex-1">
                      <Text
                        variant="rowTitle"
                        className="text-foreground"
                        numberOfLines={1}
                      >
                        {bill.name}
                      </Text>
                      <Text
                        variant="meta"
                        className="text-muted"
                      >
                        {`Skipped · ${monthName(period)}`}
                      </Text>
                    </View>
                    <Text
                      variant="rowTitle"
                      className="text-muted"
                    >
                      {formatMoney(0, bill.currency)}
                    </Text>
                  </View>
                ) : null}
                {history.map((payment) => (
                  <TransactionRow
                    key={payment.id}
                    testID={tid(
                      'budget',
                      'bill',
                      'payment',
                      payment.id,
                    )}
                    row={{
                      ...transactionRow(payment, lookup),
                      title: bill.name,
                    }}
                    metaLead="date"
                    now={now}
                    onPress={() =>
                      router.push({
                        pathname: '/transaction/[id]',
                        params: { id: payment.id },
                      })
                    }
                  />
                ))}
              </ListCard>
            </View>
          ) : null}

          <Button
            testID={tid('budget', 'bill', 'stop')}
            variant="destructive"
            icon="trash-can-outline"
            label={`Stop tracking ${bill.name}`}
            onPress={stop}
          />
        </ScrollView>
        </InPlaceGroup>
      </Page>
      <DueDaySheet
        open={dueOpen}
        selected={toLocalDateInput(nextDue)}
        monthly={!once}
        onPick={pickDue}
        onDismiss={() => setDueOpen(false)}
      />
    </View>
  );
}

function SwitchRow({
  icon,
  title,
  meta,
  children,
}: {
  icon: 'bell-outline' | 'auto-fix';
  title: string;
  meta: string;
  children: ReactNode;
}) {
  const tokens = useThemeTokens();
  return (
    <View className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3">
      <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-sand">
        <IconSymbol
          name={icon}
          size={20}
          color={tokens.foreground}
        />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          variant="rowTitle"
          className="text-foreground"
        >
          {title}
        </Text>
        <Text
          variant="meta"
          className="text-muted"
        >
          {meta}
        </Text>
      </View>
      {children}
    </View>
  );
}
