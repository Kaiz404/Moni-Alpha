import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useValue } from '@legendapp/state/react';

import { CategoryIcon } from '@/components/categories/category-icon';
import { BrandHeader } from '@/components/ui/brand-header';
import { IconAction } from '@/components/ui/icon-action';
import { ScreenShell } from '@/components/ui/screen-shell';
import { Surface } from '@/components/ui/surface';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { categoriesForUser$ } from '@/lib/finance/selectors';
import {
  archiveCategory,
  restoreCategory,
} from '@/lib/supabase/categories';

export default function CategoriesScreen() {
  const { user } = useAuth();
  const tokens = useThemeTokens();
  const categories = useValue(categoriesForUser$(user?.id ?? null));
  const active = categories.filter((category) => category.isActive);
  const archived = categories.filter(
    (category) => !category.isActive && category.userId === user?.id,
  );

  const archive = (id: string, name: string) => {
    Alert.alert(
      'Archive category?',
      `${name} will be hidden from new transactions and budgets.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => void archiveCategory(id),
        },
      ],
    );
  };

  const section = (type: 'expense' | 'income', title: string) => (
    <View className="mt-7">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-foreground">
          {title}
        </Text>
        <Pressable
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
          <Text className="ml-1 text-sm font-semibold text-primary">
            Add
          </Text>
        </Pressable>
      </View>
      <Surface className="overflow-hidden">
        {active
          .filter((category) => category.type === type)
          .map((category, index) => {
            const accent = category.color ?? tokens.primary;
            const custom = category.userId === user?.id;
            return (
              <Pressable
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
                <Text className="flex-1 text-[15px] font-semibold text-foreground">
                  {category.name}
                </Text>
                {custom ? (
                  <IconAction
                    accessibilityLabel={`Archive ${category.name}`}
                    icon="archive-outline"
                    onPress={() =>
                      archive(category.id, category.name)
                    }
                  />
                ) : (
                  <Text className="text-xs font-medium text-muted">
                    Preset
                  </Text>
                )}
              </Pressable>
            );
          })}
      </Surface>
    </View>
  );

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="Categories" />
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
            <Text className="mb-3 text-lg font-bold text-foreground">
              Archived
            </Text>
            <Surface className="overflow-hidden">
              {archived.map((category, index) => (
                <Pressable
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
                  <Text className="flex-1 text-[15px] font-semibold text-muted">
                    {category.name}
                  </Text>
                  <Text className="text-sm font-semibold text-primary">
                    Restore
                  </Text>
                </Pressable>
              ))}
            </Surface>
          </View>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}
