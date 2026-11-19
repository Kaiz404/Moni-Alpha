import type { MinorAmount } from '@repo/types';
import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AskMoniButton } from '@/components/budget/ask-moni-button';
import { CategoryRing, RingAmount, type RingSlice } from '@/components/budget/category-ring';
import {
  useBudgetData,
  useBudgetMonth,
} from '@/components/budget/use-budget';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InPlaceField, InPlaceGroup } from '@/components/ui/in-place-field';
import { ListCard } from '@/components/ui/list-card';
import { Page, PageActions, PageScroll } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { pickedSuggestion$ } from '@/lib/budget/suggestion';
import { PLAN_LIMIT_MINOR } from '@/lib/finance/money';
import {
  setMonthlyBudget,
  upsertCategoryBudget,
} from '@/lib/supabase/category-budgets';
import { tid, type TestId } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';
import { currencySymbol, formatMoney, monthName } from '@repo/core';
import { deviceCalendar } from '@/lib/dates/device-calendar';

const TOTAL = 'total';
/** Leaves room for the pencil inside the ring. */
const TOTAL_WIDTH = 150;

const fieldOf = (id: string) =>
  id === TOTAL ? tid('budget', 'total') : tid('budget', 'cap', id);

/** Whole units from minor, rounded down, as budgets are typed. */
const wholeOf = (minor: number) => Math.floor(minor / 100);

/**
 * `V2P-BudgetEdit`: the monthly total and each category cap, edited in place
 * on the system keyboard, kept as a draft until "Save N budgets".
 */
export default function EditBudgetsScreen() {
  const tokens = useThemeTokens();
  const data = useBudgetData();
  const { currency } = data;
  const month = useBudgetMonth(data, deviceCalendar.monthKey(data.now));
  const saved = useMemo(
    () =>
      Object.fromEntries(
        data.budgets
          .filter((budget) => budget.currency === currency)
          .map((budget) => [
            budget.categoryId,
            wholeOf(budget.amountMinor),
          ]),
      ),
    [data.budgets, currency],
  );
  const savedTotal =
    data.monthlyTotalMinor === null
      ? null
      : wholeOf(data.monthlyTotalMinor);
  const [caps, setCaps] = useState<Record<string, number>>(saved);
  const [total, setTotal] = useState<number | null>(savedTotal);
  const [editing, setEditing] = useState<TestId | null>(null);
  const [typedMinor, setTypedMinor] = useState<MinorAmount | null>(null);
  const [saving, setSaving] = useState(false);
  const picked = useValue(pickedSuggestion$);
  useEffect(() => {
    if (!picked) return;
    pickedSuggestion$.set(null);
    const amount = wholeOf(picked.amountMinor);
    if (picked.target.kind === 'total') setTotal(amount);
    else {
      const { id } = picked.target;
      setCaps((current) => ({ ...current, [id]: amount }));
    }
  }, [picked]);

  const spentByCategory = useMemo(
    () =>
      Object.fromEntries(
        [...month.budgeted, ...month.unbudgeted].map((row) => [
          row.categoryId,
          row.spentMinor,
        ]),
      ),
    [month.budgeted, month.unbudgeted],
  );
  const live = (id: string) =>
    editing === fieldOf(id) && typedMinor !== null
      ? wholeOf(typedMinor)
      : id === TOTAL
        ? (total ?? 0)
        : (caps[id] ?? 0);
  const rows = data.categories.filter(
    (category) => category.id in caps,
  );
  const extras = data.categories
    .filter((category) => !(category.id in caps))
    .sort(
      (a, b) =>
        (spentByCategory[b.id] ?? 0) - (spentByCategory[a.id] ?? 0),
    );
  const sum = rows.reduce(
    (acc, category) => acc + live(category.id),
    0,
  );
  const liveTotal =
    total === null && editing !== fieldOf(TOTAL) ? sum : live(TOTAL);
  const whole = (value: number) =>
    formatMoney(value * 100, currency, { whole: true });
  const spent = (id: string) =>
    formatMoney(spentByCategory[id] ?? 0, currency);
  const counted = rows.filter(
    (category) => live(category.id) > 0,
  ).length;
  const thisMonth = monthName(deviceCalendar.monthKey(data.now));

  const ringSlices = useMemo(
    () =>
      data.categories.flatMap((category): RingSlice[] => {
        const cap =
          editing === fieldOf(category.id) && typedMinor !== null
            ? wholeOf(typedMinor)
            : (caps[category.id] ?? 0);
        return cap > 0
          ? [
              {
                categoryId: category.id,
                name: category.name,
                icon: category.icon,
                color: category.color,
                amountMinor: (cap * 100) as MinorAmount,
              },
            ]
          : [];
      }),
    [data.categories, caps, editing, typedMinor],
  );
  const status = total === null
    ? { text: 'in budgets', over: false }
    : liveTotal >= sum
      ? { text: `${whole(liveTotal - sum)} for everything else`, over: false }
      : { text: `${whole(sum - liveTotal)} more in budgets`, over: true };

  const dropIfUnset = (id: string) => {
    if (caps[id] !== 0) return;
    const { [id]: _, ...rest } = caps;
    setCaps(rest);
  };
  const saveAll = async () => {
    setSaving(true);
    try {
      const changed = Object.entries(caps).filter(
        ([id, cap]) => cap > 0 && saved[id] !== cap,
      );
      for (const [id, cap] of changed)
        await upsertCategoryBudget(
          id,
          currency,
          (cap * 100) as MinorAmount,
        );
      if (total !== savedTotal) await setMonthlyBudget(total);
      showToast({
        text:
          counted === 1
            ? '1 budget saved'
            : `${counted} budgets saved`,
      });
      router.back();
    } catch {
      showToast({ text: "Couldn't save that. Try again.", tone: 'removed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      headerScrolls
      screen="budget"
      kind="pushed"
      title="Edit budgets"
      subtitle={`From ${thisMonth}`}
    >
      <InPlaceGroup
        editing={editing}
        onEditingChange={setEditing}
      >
      <PageScroll
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3 rounded-card bg-card px-[18px] py-4">
          <Text
            variant="caps"
            className="text-muted"
          >
            Monthly total
          </Text>
          <InPlaceField
            testID={tid('budget', 'total')}
            label="Monthly total"
            kind="amount"
            prefix={currencySymbol(currency)}
            whole
            max={PLAN_LIMIT_MINOR}
            value={liveTotal ? ((liveTotal * 100) as MinorAmount) : null}
            hint={
              <Text
                variant="meta"
                className="text-muted"
              >
                {`${whole(sum)} in budgets`}
              </Text>
            }
            onDraftChange={setTypedMinor}
            onSave={(minor) => setTotal(wholeOf(minor))}
          >
            {({ editable, editor }) =>
              editor ?? (
                <CategoryRing
                  testID={tid('budget', 'edit', 'ring')}
                  slices={ringSlices}
                  currency={currency}
                  month={deviceCalendar.monthKey(data.now)}
                  of="budgets"
                  wholeAmounts
                  centre={
                    <View className="items-center">
                      {editable(
                        <RingAmount
                          text={whole(liveTotal)}
                          whole
                          width={TOTAL_WIDTH}
                        />,
                        { accessibilityLabel: `Monthly total ${whole(liveTotal)}. Edit` },
                      )}
                      <Text
                        testID={tid('budget', 'edit', 'status')}
                        numberOfLines={1}
                        maxFontSizeMultiplier={1.2}
                        className={`text-[13px] leading-[18px] ${status.over ? 'font-display-bold text-over' : 'text-muted'}`}
                      >
                        {status.text}
                      </Text>
                    </View>
                  }
                />
              )
            }
          </InPlaceField>
          <AskMoniButton
            testID={tid('budget', 'edit', 'ask-moni')}
            label="Ask Moni to suggest"
            accessibilityLabel="Ask Moni to suggest a budget"
            href={{ pathname: '/budget/suggest', params: { from: 'edit' } }}
            disabled={editing !== null}
          />
        </View>

        {rows.length ? (
          <View className="gap-2.5">
            <Text
              variant="sectionTitle"
              className="text-foreground"
              accessibilityRole="header"
            >
              Budgets
            </Text>
            <ListCard>
              {rows.map((category) => {
                const cap = caps[category.id];
                const was = saved[category.id];
                const spentMinor = Number(spentByCategory[category.id] ?? 0);
                return (
                  <InPlaceField
                    key={category.id}
                    testID={tid('budget', 'cap', category.id)}
                    label={`${category.name} budget`}
                    kind="amount"
                    prefix={currencySymbol(currency)}
                    whole
                    max={PLAN_LIMIT_MINOR}
                    value={cap ? ((cap * 100) as MinorAmount) : null}
                    hint={(typed) => {
                      const leftMinor = (typed ?? 0) - spentMinor;
                      return (
                        <Text
                          variant="meta"
                          className={typed !== null && leftMinor < 0 ? 'text-over' : 'text-muted'}
                        >
                          {typed === null
                            ? `Type an amount above ${whole(0)}.`
                            : leftMinor >= 0
                              ? `${formatMoney(leftMinor, currency, { whole: true })} left this month`
                              : `${formatMoney(-leftMinor, currency, { whole: true })} over this month`}
                        </Text>
                      );
                    }}
                    onDraftChange={setTypedMinor}
                    onCancel={() => dropIfUnset(category.id)}
                    onSave={(minor) => setCaps({ ...caps, [category.id]: wholeOf(minor) })}
                  >
                    {({ editable, editor }) => (
                      <View>
                        <View className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3">
                          <View>
                            <TintBubble
                              icon={resolveTransactionIcon(category.icon, 'expense')}
                              color={category.color}
                            />
                            <View
                              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-card"
                              style={{ backgroundColor: category.color ?? tokens.inactive }}
                            />
                          </View>
                          <View className="min-w-0 flex-1">
                            <Text
                              variant="rowTitle"
                              className="text-foreground"
                              numberOfLines={1}
                            >
                              {category.name}
                            </Text>
                            <Text
                              variant="meta"
                              className="text-muted"
                              numberOfLines={1}
                            >
                              {`${was !== undefined && was !== cap ? `Was ${whole(was)} · ` : ''}${spent(category.id)} spent`}
                            </Text>
                          </View>
                          {editor
                            ? null
                            : editable(
                                <Text
                                  variant="rowTitle"
                                  className="text-foreground"
                                  style={{ fontVariant: ['tabular-nums'] }}
                                >
                                  {whole(cap)}
                                </Text>,
                                {
                                  accessibilityLabel: `Edit ${category.name} budget, ${whole(cap)}`,
                                },
                              )}
                        </View>
                        {editor ? <View className="px-[18px] pb-3">{editor}</View> : null}
                      </View>
                    )}
                  </InPlaceField>
                );
              })}
            </ListCard>
          </View>
        ) : null}

        {extras.length ? (
          <View className="gap-2.5">
            <Text
              variant="sectionTitle"
              className="text-foreground"
              accessibilityRole="header"
            >
              No budget yet
            </Text>
            <ListCard>
              {extras.map((category) => (
                <View
                  key={category.id}
                  className="min-h-[66px] flex-row items-center gap-3.5 py-3 pl-[18px] pr-3"
                >
                  <TintBubble
                    icon={resolveTransactionIcon(
                      category.icon,
                      'expense',
                    )}
                    color={category.color}
                  />
                  <View className="min-w-0 flex-1">
                    <Text
                      variant="rowTitle"
                      className="text-foreground"
                      numberOfLines={1}
                    >
                      {category.name}
                    </Text>
                    <Text
                      variant="meta"
                      className="text-muted"
                      numberOfLines={1}
                    >
                      {`${spent(category.id)} spent in ${thisMonth}`}
                    </Text>
                  </View>
                  <Press
                    testID={tid(
                      'budget',
                      'edit',
                      'set',
                      category.name,
                    )}
                    accessibilityLabel={`Set a budget for ${category.name}`}
                    disabled={editing !== null}
                    radius={{ rest: 22, pressed: 16 }}
                    pressedClassName="bg-hairline"
                    className="h-11 flex-row items-center gap-1 bg-sand pl-2.5 pr-3.5"
                    onPress={() => {
                      setCaps({ ...caps, [category.id]: 0 });
                      setEditing(fieldOf(category.id));
                    }}
                  >
                    <IconSymbol
                      name="plus"
                      size={18}
                      color={tokens.foreground}
                    />
                    <Text className="text-[14px] font-display-semibold text-foreground">
                      Set
                    </Text>
                  </Press>
                </View>
              ))}
            </ListCard>
          </View>
        ) : null}
      </PageScroll>
      </InPlaceGroup>
      <PageActions>
        <Button
          testID={tid('budget', 'edit', 'save')}
          className="flex-1"
          label={
            counted === 1
              ? 'Save 1 budget'
              : `Save ${counted} budgets`
          }
          pinned
          loading={saving}
          loadingLabel="Saving"
          disabled={editing !== null}
          onPress={saveAll}
        />
      </PageActions>
    </Page>
  );
}
