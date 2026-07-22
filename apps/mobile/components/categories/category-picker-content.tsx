import { Pressable, ScrollView, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/categories/category-icon';
import { IconAction } from '@/components/ui/icon-action';
import {
  BOTTOM_SHEET_PRIMARY_ACTION_SPACE,
  BottomSheetPrimaryAction,
} from '@/components/ui/bottom-sheet-primary-action';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { CategoryPickerItem } from './category-picker-modal';

type CategoryPickerContentProps = {
  categories: CategoryPickerItem[];
  suggested?: CategoryPickerItem[];
  selectedId?: string | null;
  title?: string;
  onSelect: (category: CategoryPickerItem) => void;
  onClose: () => void;
  onCreate?: () => void;
};

/** Shared picker body. Choosing an option changes selection but never dismisses its sheet. */
export function CategoryPickerContent({
  categories,
  suggested = [],
  selectedId,
  title = 'Choose category',
  onSelect,
  onClose,
  onCreate,
}: CategoryPickerContentProps) {
  const tokens = useThemeTokens();
  const suggestedIds = new Set(
    suggested.map((category) => category.id),
  );
  const remaining = categories.filter(
    (category) => !suggestedIds.has(category.id),
  );

  const row = (category: CategoryPickerItem) => {
    const selected = category.id === selectedId;
    const accent = category.color ?? tokens.primary;
    return (
      <Pressable
        key={category.id}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className={`mb-2 min-h-14 flex-row items-center rounded-2xl px-4 py-3 active:opacity-85 ${
          selected ? 'bg-primary-muted' : 'bg-card'
        }`}
        onPress={() => onSelect(category)}
      >
        <View
          className="mr-3 h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}` }}
        >
          <CategoryIcon
            color={tokens.foreground}
            icon={category.icon}
            size={20}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-base font-semibold text-foreground">
            {category.name}
          </Text>
          {category.budgetUsage ? (
            <Text
              className="mt-0.5 text-xs font-medium text-muted"
              numberOfLines={1}
            >
              {category.budgetUsage}
            </Text>
          ) : null}
        </View>
        {selected ? (
          <CategoryIcon
            color={tokens.primary}
            icon="check"
            size={20}
          />
        ) : null}
      </Pressable>
    );
  };

  return (
    <View className="flex-1">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-xl font-bold text-foreground">
            {title}
          </Text>
        </View>
        <IconAction
          accessibilityLabel="Close category picker"
          icon="close"
          onPress={onClose}
        />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: BOTTOM_SHEET_PRIMARY_ACTION_SPACE,
        }}
        showsVerticalScrollIndicator={false}
      >
        {suggested.length ? (
          <>
            <Text className="mb-1 mt-2 px-1 text-xs font-bold uppercase tracking-wide text-muted">
              Recent
            </Text>
            {suggested.map(row)}
          </>
        ) : null}
        <Text className="mb-1 mt-4 px-1 text-xs font-bold uppercase tracking-wide text-muted">
          All categories
        </Text>
        {remaining.map(row)}
        {onCreate ? (
          <Pressable
            className="mt-3 min-h-13 flex-row items-center rounded-2xl bg-primary-muted px-4"
            onPress={() => {
              onCreate();
              onClose();
            }}
          >
            <CategoryIcon
              color={tokens.primary}
              icon="plus"
              size={21}
            />
            <Text className="ml-3 text-[15px] font-semibold text-primary">
              Create category
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <BottomSheetPrimaryAction
        icon="check"
        label="Use category"
        onPress={onClose}
      />
    </View>
  );
}
