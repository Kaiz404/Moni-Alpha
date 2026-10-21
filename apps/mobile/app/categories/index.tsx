import { useValue } from '@legendapp/state/react';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { CategorySpark } from '@/components/categories/category-spark';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListCard } from '@/components/ui/list-card';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { categoryMonths } from '@/lib/finance/activity-series';
import { formatMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import {
  budgetProgress$,
  categoriesForUser$,
  transactions$,
} from '@/lib/finance/selectors';
import type { FinanceCategory } from '@/lib/finance/types';
import { restoreCategory } from '@/lib/supabase/categories';
import { ensureFinanceTimezone } from '@/lib/supabase/profile';
import { tid } from '@/lib/test-ids';
import { resolveTransactionIcon } from '@/lib/transactions/icon';

type Kind = 'expense' | 'income';
type Category = Pick<FinanceCategory, 'id' | 'name' | 'icon' | 'color' | 'type'>;

const KINDS = [
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
] as const;

function Row({
  category,
  meta,
  trailing,
  onPress,
}: {
  category: Category;
  meta: string;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <>
      <TintBubble
        icon={resolveTransactionIcon(category.icon, category.type ?? 'expense')}
        color={category.color}
      />
      <View className="min-w-0 flex-1">
        <Text variant="rowTitle" className="text-foreground" numberOfLines={1}>
          {category.name}
        </Text>
        <Text
          variant="meta"
          className="text-muted"
          numberOfLines={1}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {meta}
        </Text>
      </View>
      {trailing}
    </>
  );
  const className = 'min-h-[66px] flex-row items-center gap-3.5 px-[18px] py-3';
  return onPress ? (
    <Press
      testID={tid('activity', 'categories', 'row', category.id)}
      accessibilityLabel={`${category.name}, ${meta}`}
      onPress={onPress}
      className={className}
    >
      {body}
    </Press>
  ) : (
    <View className={className} accessibilityLabel={`${category.name}, ${meta}`}>
      {body}
    </View>
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
  const now = new Date();
  const today = now.toDateString();

  useEffect(() => {
    void ensureFinanceTimezone()
      .then(setTimezone)
      .catch(() => {});
  }, []);

  const months = useMemo(
    () => categoryMonths(all, currency, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when the day turns over
    [all, currency, today],
  );
  const filed = useMemo(
    () => new Set(all.map((row) => row.categoryId).filter(Boolean)),
    [all],
  );
  const ofKind = categories.filter((category) => category.type === kind);
  const mine = ofKind.filter((c) => c.userId === userId && c.isActive);
  const presets = ofKind.filter((c) => c.userId === null && c.isActive);
  const archived = ofKind.filter((c) => c.userId === userId && !c.isActive);
  const since = `1 ${now.toLocaleDateString('en-US', { month: 'short' })}`;

  const spent = (category: Category) =>
    months[category.id]?.at(-1) ?? 0;

  const presetMeta = (category: Category) => {
    const amount = formatMoney(spent(category), currency);
    if (kind === 'income') return amount;
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
  const create = () =>
    router.push({ pathname: '/categories/form', params: { type: kind } });

  return (
    <Page
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
      <ScrollView contentContainerClassName="gap-section px-screen pb-8">
        <Segmented
          screen="activity"
          name="categories-kind"
          options={KINDS}
          value={kind}
          onChange={setKind}
          accessibilityLabel="Category type"
        />

        <View className="gap-2.5">
          <Text variant="caps" className="pl-1 text-muted" accessibilityRole="header">
            Yours
          </Text>
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
              className="min-h-[56px] flex-row items-center gap-2 rounded-tile border-[1.5px] border-dashed border-hairline px-[18px]"
            >
              <IconSymbol name="plus" size={20} color={tokens.foreground} />
              <Text className="flex-1 text-[15px] leading-[21px] font-display-semibold text-foreground">
                {"Make one for anything the presets don't fit"}
              </Text>
            </Press>
          )}
        </View>

        {presets.length ? (
          <View className="gap-2.5">
            <View className="flex-row items-center justify-between pl-1">
              <Text variant="caps" className="text-muted" accessibilityRole="header">
                {`Presets · since ${since}`}
              </Text>
              <View className="flex-row items-center gap-1">
                <IconSymbol name="lock-outline" size={14} color={tokens.muted} />
                <Text variant="smallest" className="text-muted">
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

        {archived.length ? (
          <View className="gap-2.5">
            <Text variant="caps" className="pl-1 text-muted" accessibilityRole="header">
              Archived · hidden from new transactions
            </Text>
            <View className="overflow-hidden rounded-card border-[1.5px] border-dashed border-hairline">
              {archived.map((category) => (
                <Row
                  key={category.id}
                  category={category}
                  meta="Archived"
                  trailing={
                    <Press
                      testID={tid('activity', 'categories', 'restore', category.id)}
                      accessibilityLabel={`Restore ${category.name}`}
                      onPress={() =>
                        void restoreCategory(category.id).catch((error: unknown) =>
                          Alert.alert(
                            'Not saved',
                            error instanceof Error ? error.message : 'Try again.',
                          ),
                        )
                      }
                      radius={{ rest: 22, pressed: 16 }}
                      pressedClassName="bg-hairline"
                      className="h-11 flex-row items-center gap-1.5 bg-sand px-4"
                    >
                      <IconSymbol name="restore" size={18} color={tokens.foreground} />
                      <Text className="text-[15px] leading-[21px] font-display-semibold text-foreground">
                        Restore
                      </Text>
                    </Press>
                  }
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Page>
  );
}
