import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { useValue } from '@legendapp/state/react';

import { CategoryIcon } from '@/components/categories/category-icon';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { categoriesForUser$ } from '@/lib/finance/selectors';
import {
  archiveCategory,
  restoreCategory,
} from '@/lib/supabase/categories';
import { HeaderIconButton } from '@/components/ui/header-icon-button';
import { openSheet } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';
import { Page } from '@/components/ui/page';

export default function CategoriesScreen() {
  const { user } = useAuth();
  const tokens = useThemeTokens();
  const categories = useValue(categoriesForUser$(user?.id ?? null));
  const active = categories.filter((category) => category.isActive);
  const archived = categories.filter(
    (category) => !category.isActive && category.userId === user?.id,
  );

  const archive = async (id: string, name: string) => {
    const confirmed = await openSheet({
      kind: 'confirm',
      title: `Archive ${name}?`,
      message: 'It is hidden from new transactions and budgets.',
      confirmLabel: 'Archive',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (confirmed) void archiveCategory(id);
  };

  const section = (type: 'expense' | 'income', title: string) => (
    <View className="mt-7">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-display-bold text-foreground">
          {title}
        </Text>
        <Pressable
          testID={tid('activity', 'add')}
          className="min-h-11 flex-row items-center px-2"
          onPress={() =>
            router.push({
              pathname: '/categories/form',
              params: { type },
            } as never)
          }
        >
          <CategoryIcon
            color={tokens.primary}
            icon="plus"
            size={19}
          />
          <Text className="ml-1 text-sm font-display-semibold text-primary">
            Add
          </Text>
        </Pressable>
      </View>
      <View className="rounded-card bg-card overflow-hidden">
        {active
          .filter((category) => category.type === type)
          .map((category, index) => {
            const accent = category.color ?? tokens.primary;
            const custom = category.userId === user?.id;
            return (
              <Pressable
                testID={tid('activity', 'edit', category.id)}
                key={category.id}
                className={`min-h-15 flex-row items-center px-4 ${index ? 'border-t border-border-subtle' : ''}`}
                onPress={() =>
                  custom &&
                  router.push({
                    pathname: '/categories/form',
                    params: { id: category.id },
                  } as never)
                }
                accessibilityRole={custom ? 'button' : undefined}
                accessibilityLabel={
                  custom
                    ? `Edit ${category.name}`
                    : `${category.name}, preset category`
                }
              >
                <View
                  className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${accent}33` }}
                >
                  <CategoryIcon
                    color={accent}
                    icon={category.icon}
                    size={20}
                  />
                </View>
                <Text className="flex-1 text-[15px] font-display-semibold text-foreground">
                  {category.name}
                </Text>
                {custom ? (
                  <HeaderIconButton
                    testID={tid('activity', 'archive', category.id)}
                    accessibilityLabel={`Archive ${category.name}`}
                    icon="archive-outline"
                    onPress={() =>
                      archive(category.id, category.name)
                    }
                  />
                ) : (
                  <Text className="text-xs font-display-semibold text-muted">
                    Preset
                  </Text>
                )}
              </Pressable>
            );
          })}
      </View>
    </View>
  );

  return (
    <Page
      screen="activity"
      kind="pushed"
      title="Categories"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-sm leading-5 text-muted">
          Presets stay consistent. Add custom categories when your
          spending needs a clearer home.
        </Text>
        {section('expense', 'Expenses')}
        {section('income', 'Income')}
        {archived.length ? (
          <View className="mt-8">
            <Text className="mb-3 text-lg font-display-bold text-foreground">
              Archived
            </Text>
            <View className="rounded-card bg-card overflow-hidden">
              {archived.map((category, index) => (
                <Pressable
                  testID={tid('activity', 'restore', category.id)}
                  key={category.id}
                  className={`min-h-15 flex-row items-center px-4 ${index ? 'border-t border-border-subtle' : ''}`}
                  onPress={() => void restoreCategory(category.id)}
                >
                  <View
                    className="mr-3 h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: `${category.color ?? tokens.muted}33`,
                    }}
                  >
                    <CategoryIcon
                      color={category.color ?? tokens.muted}
                      icon={category.icon}
                      size={20}
                    />
                  </View>
                  <Text className="flex-1 text-[15px] font-display-semibold text-muted">
                    {category.name}
                  </Text>
                  <Text className="text-sm font-display-semibold text-primary">
                    Restore
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Page>
  );
}
