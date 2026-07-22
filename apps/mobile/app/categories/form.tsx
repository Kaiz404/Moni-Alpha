import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useValue } from '@legendapp/state/react';
import {
  categoryIconNames,
  customCategoryColors,
  type CategoryIconName,
  type CustomCategoryColor,
} from '@repo/types';

import { CategoryIcon } from '@/components/categories/category-icon';
import { BrandHeader } from '@/components/ui/brand-header';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { TactilePressable } from '@/components/ui/tactile-pressable';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import { categoriesForUser$ } from '@/lib/finance/selectors';
import {
  createCategory,
  updateCategory,
} from '@/lib/supabase/categories';

export default function CategoryFormScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    type?: 'income' | 'expense';
    returnTo?: string;
  }>();
  const { user } = useAuth();
  const tokens = useThemeTokens();
  const categories = useValue(categoriesForUser$(user?.id ?? null));
  const existing = useMemo(
    () =>
      categories.find(
        (category) =>
          category.id === params.id && category.userId === user?.id,
      ) ?? null,
    [categories, params.id, user?.id],
  );
  const type =
    existing?.type === 'income' || params.type === 'income'
      ? 'income'
      : 'expense';
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<CategoryIconName>(
    (existing?.icon as CategoryIconName) ?? 'package-variant',
  );
  const [color, setColor] = useState<CustomCategoryColor>(
    (existing?.color as CustomCategoryColor) ??
      customCategoryColors[0],
  );
  const [saving, setSaving] = useState(false);
  const hydratedEditFields = useRef(false);

  useEffect(() => {
    if (!existing || hydratedEditFields.current) return;
    setName(existing.name);
    setIcon(existing.icon as CategoryIconName);
    setColor(existing.color as CustomCategoryColor);
    hydratedEditFields.current = true;
  }, [existing]);

  const save = async () => {
    setSaving(true);
    try {
      const id = existing
        ? (await updateCategory(existing.id, { name, icon, color }),
          existing.id)
        : await createCategory({ name, icon, color, type });
      if (params.returnTo)
        router.replace({
          pathname: params.returnTo as any,
          params: { categoryId: id },
        });
      else router.back();
    } catch (error) {
      Alert.alert(
        'Could not save category',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell variant="canvas">
      <BrandHeader
        title={existing ? 'Edit category' : `New ${type} category`}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-5"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-sm font-semibold text-foreground">
          Name
        </Text>
        <TextInput
          className="mt-2 min-h-13 rounded-2xl bg-card px-4 text-base text-foreground"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Pet care"
          placeholderTextColor={tokens.muted}
          maxLength={100}
        />
        <Text className="mb-3 mt-7 text-sm font-semibold text-foreground">
          Icon
        </Text>
        <View className="flex-row flex-wrap">
          {categoryIconNames.map((item) => {
            const selected = item === icon;
            return (
              <TactilePressable
                key={item}
                accessibilityLabel={`Choose ${item} icon`}
                accessibilityState={{ selected }}
                className="mb-3 items-center"
                style={{ width: '25%' }}
                onPress={() => setIcon(item)}
              >
                <View
                  className={`h-12 w-12 items-center justify-center rounded-2xl ${selected ? 'bg-primary-muted' : 'bg-card'}`}
                >
                  <CategoryIcon
                    color={selected ? tokens.primary : tokens.muted}
                    icon={item}
                    size={24}
                  />
                </View>
              </TactilePressable>
            );
          })}
        </View>
        <Text className="mb-3 mt-5 text-sm font-semibold text-foreground">
          Color
        </Text>
        <View className="flex-row flex-wrap">
          {customCategoryColors.map((item) => {
            const selected = item === color;
            return (
              <TactilePressable
                key={item}
                accessibilityLabel={`Choose category color ${item}`}
                accessibilityState={{ selected }}
                className="mb-4 items-center"
                style={{ width: '25%' }}
                onPress={() => setColor(item)}
              >
                <View
                  className="h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: item }}
                >
                  {selected ? (
                    <CategoryIcon
                      color={tokens.foreground}
                      icon="check"
                      size={20}
                    />
                  ) : null}
                </View>
              </TactilePressable>
            );
          })}
        </View>
        <View className="mt-3 flex-row items-center rounded-2xl bg-card p-4">
          <View
            className="mr-3 h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: `${color}33` }}
          >
            <CategoryIcon
              color={color}
              icon={icon}
              size={22}
            />
          </View>
          <Text className="text-base font-semibold text-foreground">
            {name.trim() || 'Category name'}
          </Text>
        </View>
        <PrimaryButton
          className="mt-8"
          icon="check"
          label={existing ? 'Save changes' : 'Create category'}
          loading={saving}
          loadingLabel="Saving category…"
          onPress={() => void save()}
        />
      </ScrollView>
    </ScreenShell>
  );
}
