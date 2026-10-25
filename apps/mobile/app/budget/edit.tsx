import type { MinorAmount } from '@repo/types';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import {
  useBudgetData,
  useBudgetMonth,
} from '@/components/budget/use-budget';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { InPlaceField, InPlaceGroup } from '@/components/ui/in-place-field';
import { ListCard } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { monthKey, monthName } from '@/lib/finance/budget-month';
import { currencySymbol, formatMoney } from '@/lib/finance/format-money';
import { PLAN_LIMIT_MINOR } from '@/lib/finance/money';
import {
  setMonthlyBudget,
  upsertCategoryBudget,
} from '@/lib/supabase/category-budgets';
import { tid, type TestId } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

const TOTAL = 'total';
const DONUT = 96;
const DONUT_R = 40;
const DONUT_C = 2 * Math.PI * DONUT_R;
const ARC_GAP = 2;

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
  const month = useBudgetMonth(data, monthKey(data.now));
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
  const thisMonth = monthName(monthKey(data.now));

  const scale = Math.max(liveTotal, sum, 1);
  const arcs: {
    id: string;
    color: string;
    dash: string;
    offset: number;
  }[] = [];
  for (let i = 0, at = 0; i < rows.length; i += 1) {
    const length = (live(rows[i].id) / scale) * DONUT_C;
    if (length <= 0) continue;
    arcs.push({
      id: rows[i].id,
      color: rows[i].color ?? tokens.inactive,
      dash: `${Math.max(length - ARC_GAP, 1)} ${DONUT_C}`,
      offset: -at,
    });
    at += length;
  }
  const fits = liveTotal >= sum;
  const status = fits
    ? {
        pill: `${whole(liveTotal - sum)} unassigned`,
        sentence: `${whole(sum)} across ${counted === 1 ? '1 budget' : `${counted} budgets`}. The rest covers everything else.`,
      }
    : {
        pill: `${whole(sum - liveTotal)} over the total`,
        sentence: `${whole(sum)} across ${counted === 1 ? '1 budget' : `${counted} budgets`}, more than the total. Raise it or lower one.`,
      };

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
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      screen="budget"
      kind="pushed"
      title="Edit budgets"
      subtitle={`From ${thisMonth}`}
    >
      <InPlaceGroup
        editing={editing}
        onEditingChange={setEditing}
      >
      <ScrollView
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
            onDraftChange={setTypedMinor}
            onSave={(minor) => setTotal(wholeOf(minor))}
          >
            {({ editable, editor }) =>
              editor ??
              editable(
                <Text
                  className="text-[40px] leading-[44px] font-display-bold text-foreground"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {whole(liveTotal)}
                </Text>,
                { accessibilityLabel: `Monthly total ${whole(liveTotal)}. Edit` },
              )
            }
          </InPlaceField>
          <View className="flex-row items-center gap-4">
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={`The ${whole(liveTotal)} monthly total: ${rows
                .map(
                  (category) =>
                    `${category.name} ${whole(live(category.id))}`,
                )
                .join(', ')}. ${status.pill}.`}
            >
              <Svg
                width={DONUT}
                height={DONUT}
              >
                <Circle
                  cx={DONUT / 2}
                  cy={DONUT / 2}
                  r={DONUT_R}
                  fill="none"
                  stroke={tokens.track}
                  strokeWidth={12}
                />
                {arcs.map((arc) => (
                  <Circle
                    key={arc.id}
                    cx={DONUT / 2}
                    cy={DONUT / 2}
                    r={DONUT_R}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={12}
                    strokeDasharray={arc.dash}
                    strokeDashoffset={arc.offset}
                    transform={`rotate(-90 ${DONUT / 2} ${DONUT / 2})`}
                  />
                ))}
              </Svg>
            </View>
            <View className="min-w-0 flex-1 items-start gap-2">
              <View
                className={`h-7 flex-row items-center gap-1.5 rounded-full px-3 ${fits ? 'bg-primary-muted' : 'bg-destructive-fill'}`}
              >
                <View
                  className={`h-1.5 w-1.5 rounded-full ${fits ? 'bg-state-approved' : 'bg-state-destructive'}`}
                />
                <Text
                  className={`text-[13px] font-display-bold ${fits ? 'text-state-approved' : 'text-state-destructive'}`}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {status.pill}
                </Text>
              </View>
              <Text
                variant="meta"
                className="text-ink-2"
              >
                {status.sentence}
              </Text>
            </View>
          </View>
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
                          <TintBubble
                            icon={resolveTransactionIcon(category.icon, 'expense')}
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
      </ScrollView>
      </InPlaceGroup>
      <View className="border-t-[1.5px] border-sand bg-canvas px-5 pb-[26px] pt-3">
        <Button
          testID={tid('budget', 'edit', 'save')}
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
      </View>
    </Page>
  );
}
