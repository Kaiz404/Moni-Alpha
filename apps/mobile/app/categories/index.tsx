import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { CategoryBubble } from '@/components/categories/category-bubble';
import { CategorySpark } from '@/components/categories/category-spark';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Page, PageScroll } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { categoryMonths } from '@/lib/finance/activity-series';
import { formatMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import {
  budgetProgress$,
  categoriesForUser$,
  transactions$,
} from '@/lib/finance/selectors';
import type { FinanceCategory } from '@/lib/finance/types';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import { tid } from '@/lib/test-ids';
import { listParams } from '@/lib/transactions/list-scope';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

type Kind = 'expense' | 'income';

function dayOf(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}
type Category = Pick<FinanceCategory, 'id' | 'userId' | 'name' | 'icon' | 'color' | 'type'>;

const KINDS = [
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
] as const;

function Bubble({ category }: { category: Category }) {
  const icon = resolveTransactionIcon(category.icon, category.type ?? 'expense');
  return category.userId && category.color ? (
    <CategoryBubble icon={icon} color={category.color} />
  ) : (
    <TintBubble icon={icon} color={category.color} />
  );
}

function Row({
  category,
  meta,
  trailing,
  onPress,
}: {
  category: Category;
  meta: string;
  trailing?: ReactNode;
  onPress: () => void;
}) {
  return (
    <Press
      testID={tid('activity', 'categories', 'row', category.id)}
      accessibilityLabel={`${category.name}, ${meta}`}
      onPress={onPress}
      className="min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3"
    >
      <Bubble category={category} />
      <View className="min-w-0 flex-1">
        <Text variant="rowTitle" className="text-foreground" numberOfLines={1}>
          {category.name}
        </Text>
        <Text
          variant="meta"
          className={category.userId ? 'text-muted' : 'text-ink-2'}
          numberOfLines={1}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {meta}
        </Text>
      </View>
      {trailing}
    </Press>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="caps" className="text-ink-2" accessibilityRole="header">
      {children}
    </Text>
  );
}

export default function CategoriesScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const tokens = useThemeTokens();
  const currency = useMainCurrency();
  const categories = useValue(categoriesForUser$(userId));
  const all = useValue(transactions$({ userId }));
  const [timezone, setTimezone] = useState('UTC');
  const progress = useValue(budgetProgress$(userId, timezone));
  const [kind, setKind] = useState<Kind>('expense');
  const todayKey = toLocalDateInput(new Date());
  const today = dayOf(todayKey);

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);

  const months = categoryMonths(all, currency, today);
  const filed = new Set(all.map((row) => row.categoryId).filter(Boolean));
  const ofKind = categories.filter((category) => category.type === kind);
  const mine = ofKind.filter((c) => c.userId === userId && c.isActive);
  const presets = ofKind.filter((c) => c.userId === null && c.isActive);
  const since = `1 ${today.toLocaleDateString('en-US', { month: 'short' })}`;

  const spent = (category: Category) =>
    months[category.id]?.at(-1) ?? 0;

  const presetMeta = (category: Category) => {
    const amount = formatMoney(spent(category), currency);
    if (kind === 'income') return `${amount} this month`;
    const budget = progress.find(
      (row) =>
        row.categoryId === category.id &&
        row.currency === currency &&
        row.budgetAmountMinor !== null,
    );
    if (!budget?.budgetAmountMinor) return `${amount} · no budget`;
    const left = Number(budget.budgetAmountMinor) - spent(category);
    return left < 0
      ? `${amount} · ${formatMoney(-left, currency, { whole: true })} over`
      : `${amount} of ${formatMoney(budget.budgetAmountMinor, currency, { whole: true })}`;
  };

  const customMeta = (category: Category) =>
    spent(category) > 0
      ? `Custom · ${formatMoney(spent(category), currency)} since ${since}`
      : filed.has(category.id)
        ? `Custom · nothing since ${since}`
        : 'Custom · nothing filed yet';

  const edit = (id: string) =>
    router.push({ pathname: '/categories/form', params: { id } });
  /** Expense presets open their category page; income has no budget, so it lists the month's rows under Categories. */
  const open = (category: Category) =>
    kind === 'expense'
      ? router.push({ pathname: '/budget/[categoryId]', params: { categoryId: category.id } })
      : router.push({
          pathname: '/transactions',
          params: listParams(category.name, {
            kind: 'category',
            categoryId: category.id,
            month: todayKey.slice(0, 7),
          }),
        });
  const create = () =>
    router.push({ pathname: '/categories/form', params: { type: kind } });

  return (
    <Page
      headerScrolls
      screen="activity"
      kind="pushed"
      title="Categories"
      trailing={
        <HeaderIconButton
          testID={tid('activity', 'categories', 'new')}
          icon="plus"
          accessibilityLabel={kind === 'income' ? 'New income category' : 'New expense category'}
          onPress={create}
        />
      }
    >
      <PageScroll contentContainerClassName="gap-3 px-screen pb-10">
        <Segmented
          screen="activity"
          name="categories-kind"
          options={KINDS}
          value={kind}
          onChange={setKind}
          accessibilityLabel="Category type"
        />

        <View className="gap-1.5">
          <View className="px-1.5">
            <SectionLabel>Yours</SectionLabel>
          </View>
          {mine.length ? (
            <ListCard>
              {mine.map((category) => (
                <Row
                  key={category.id}
                  category={category}
                  meta={customMeta(category)}
                  onPress={() => edit(category.id)}
                />
              ))}
            </ListCard>
          ) : (
            <Press
              testID={tid('activity', 'categories', 'make-one')}
              onPress={create}
              pressedClassName="bg-sand-light"
              className="flex-row items-center gap-2 rounded-tile border-[1.5px] border-dashed border-hairline px-4 py-3.5"
            >
              <IconSymbol name="plus" size={20} color={tokens.foreground} />
              <Text className="min-w-0 flex-1 text-[15px] leading-[21px] font-display-semibold text-foreground">
                {"Make one for anything the presets don't fit"}
              </Text>
            </Press>
          )}
        </View>

        {presets.length ? (
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between px-1.5">
              <SectionLabel>{`Presets · since ${since}`}</SectionLabel>
              <View className="flex-row items-center gap-1">
                <IconSymbol name="lock-outline" size={16} color={tokens.muted} />
                <Text variant="meta" className="text-muted">
                  Fixed for everyone
                </Text>
              </View>
            </View>
            <ListCard>
              {presets.map((category) => (
                <Row
                  key={category.id}
                  category={category}
                  meta={presetMeta(category)}
                  onPress={() => open(category)}
                  trailing={
                    <CategorySpark
                      totals={months[category.id] ?? [0, 0]}
                      color={category.color}
                    />
                  }
                />
              ))}
            </ListCard>
          </View>
        ) : null}
      </PageScroll>
    </Page>
  );
}
