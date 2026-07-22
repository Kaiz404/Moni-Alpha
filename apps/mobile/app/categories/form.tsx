import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useValue } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  categoryIconNames,
  categoryNameMaxLength,
  customCategoryColors,
  decimalToMinor,
  type CategoryIconName,
  type CustomCategoryColor,
} from '@repo/types';

import { BudgetProgressItem } from '@/components/budgets/budget-progress-item';
import { CategoryIcon } from '@/components/categories/category-icon';
import { BrandHeader } from '@/components/ui/brand-header';
import { FormField } from '@/components/ui/form-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { Surface } from '@/components/ui/surface';
import { TactilePressable } from '@/components/ui/tactile-pressable';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import {
  categoriesForUser$,
  type BudgetProgress,
} from '@/lib/finance/selectors';
import {
  createCategory,
  updateCategory,
} from '@/lib/supabase/categories';

const iconColumns = Array.from(
  { length: Math.ceil(categoryIconNames.length / 2) },
  (_, index) => categoryIconNames.slice(index * 2, index * 2 + 2),
);
const colorColumns = Array.from(
  { length: Math.ceil(customCategoryColors.length / 2) },
  (_, index) => customCategoryColors.slice(index * 2, index * 2 + 2),
);
const pickerColumnWidth = 56;

export default function CategoryFormScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    type?: 'income' | 'expense';
    returnTo?: string;
  }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
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
  const nameInputRef = useRef<TextInput>(null);
  const [previewStats] = useState(() => {
    const budgetDollars = 200 + Math.floor(Math.random() * 301);
    const percentage = 35 + Math.floor(Math.random() * 46);
    const spentDollars = Math.round(
      (budgetDollars * percentage) / 100,
    );

    return {
      budgetAmountMinor: decimalToMinor(budgetDollars),
      percentage: Math.round((spentDollars / budgetDollars) * 100),
      remainingMinor: decimalToMinor(budgetDollars - spentDollars),
      spentMinor: decimalToMinor(spentDollars),
    };
  });
  const hydratedEditFields = useRef(false);

  const blurNameInput = () => nameInputRef.current?.blur();

  const previewBudget = useMemo<BudgetProgress>(
    () => ({
      budgetAmountMinor: previewStats.budgetAmountMinor,
      categoryColor: color,
      categoryIcon: icon,
      categoryId: existing?.id ?? 'category-preview',
      categoryIsActive: true,
      categoryName: name.trim() || 'Category name',
      currency: 'USD',
      percentage: previewStats.percentage,
      remainingMinor: previewStats.remainingMinor,
      spentMinor: previewStats.spentMinor,
      status: 'on_track',
    }),
    [color, existing?.id, icon, name, previewStats],
  );

  useEffect(() => {
    if (!existing || hydratedEditFields.current) return;
    setName(existing.name);
    setIcon(existing.icon as CategoryIconName);
    setColor(existing.color as CustomCategoryColor);
    hydratedEditFields.current = true;
  }, [existing]);

  useEffect(() => {
    const subscription = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        nameInputRef.current?.blur();
      },
    );
    return () => subscription.remove();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const id = existing
        ? (await updateCategory(existing.id, { name, icon, color }),
          existing.id)
        : await createCategory({ name, icon, color, type });
      if (params.returnTo) {
        // Return to the already-open form so a category created from a budget
        // does not add a second budget form above this screen in the stack.
        router.dismissTo({
          pathname: params.returnTo as any,
          params: { categoryId: id },
        } as never);
      } else router.back();
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
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 pb-8"
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={blurNameInput}
            showsVerticalScrollIndicator={false}
          >
            <Text className="mt-6 text-base font-bold text-foreground">
              Preview
            </Text>
            <Surface
              className="mt-3"
              style={{ backgroundColor: `${color}33` }}
            >
              <BudgetProgressItem
                budget={previewBudget}
                variant="compact"
              />
            </Surface>

            <Surface className="mt-6">
              <FormField
                autoCapitalize="words"
                containerClassName="mb-0"
                hint={`${name.length} / ${categoryNameMaxLength} characters`}
                label="Category name"
                maxLength={categoryNameMaxLength}
                onChangeText={setName}
                placeholder="e.g. Pet care"
                ref={nameInputRef}
                value={name}
              />
            </Surface>

            <Text className="mt-4 text-base font-bold text-foreground">
              Icon
            </Text>
            <Surface
              tone="muted"
              className="mt-3 p-3"
            >
              <ScrollView
                horizontal
                decelerationRate="fast"
                directionalLockEnabled
                nestedScrollEnabled
                onScrollBeginDrag={blurNameInput}
                showsHorizontalScrollIndicator={false}
                snapToAlignment="start"
                snapToInterval={pickerColumnWidth}
              >
                {iconColumns.map((column, columnIndex) => (
                  <View
                    key={`icon-column-${columnIndex}`}
                    className="mr-2 gap-2"
                  >
                    {column.map((item) => {
                      const selected = item === icon;
                      return (
                        <TactilePressable
                          key={item}
                          accessibilityLabel={`Choose ${item} icon`}
                          accessibilityState={{ selected }}
                          className="h-12 w-12 items-center justify-center rounded-2xl"
                          onPress={() => {
                            blurNameInput();
                            setIcon(item);
                          }}
                        >
                          <View
                            className={`h-12 w-12 items-center justify-center rounded-2xl ${selected ? 'bg-primary-muted' : 'bg-card'}`}
                          >
                            <CategoryIcon
                              color={
                                selected
                                  ? tokens.primary
                                  : tokens.muted
                              }
                              icon={item}
                              size={22}
                            />
                          </View>
                        </TactilePressable>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </Surface>

            <Text className="mt-4 text-base font-bold text-foreground">
              Color
            </Text>
            <Surface
              tone="muted"
              className="mt-3 p-3"
            >
              <ScrollView
                horizontal
                decelerationRate="fast"
                directionalLockEnabled
                nestedScrollEnabled
                onScrollBeginDrag={blurNameInput}
                showsHorizontalScrollIndicator={false}
                snapToAlignment="start"
                snapToInterval={pickerColumnWidth}
              >
                {colorColumns.map((column, columnIndex) => (
                  <View
                    key={`color-column-${columnIndex}`}
                    className="mr-2 gap-2"
                  >
                    {column.map((item) => {
                      const selected = item === color;
                      return (
                        <TactilePressable
                          key={item}
                          accessibilityLabel={`Choose category color ${item}`}
                          accessibilityState={{ selected }}
                          className="h-12 w-12 items-center justify-center rounded-2xl"
                          onPress={() => {
                            blurNameInput();
                            setColor(item);
                          }}
                        >
                          <View
                            className={`h-12 w-12 items-center justify-center rounded-2xl ${selected ? 'border-2 border-foreground' : ''}`}
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
                ))}
              </ScrollView>
            </Surface>
          </ScrollView>

          <View
            className="border-t border-border-subtle bg-canvas px-5 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          >
            <PrimaryButton
              icon="check"
              label={existing ? 'Save changes' : 'Create category'}
              loading={saving}
              loadingLabel="Saving category…"
              onPress={() => {
                blurNameInput();
                void save();
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
