import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';

import {
  filterCurrencyOptions,
  type CurrencyOption,
} from '@/constants/currencies';
import { IconAction } from '@/components/ui/icon-action';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

export type CurrencyPickerSharedProps = {
  keyboardInset?: number;
  onClose: () => void;
  onSearchFocus?: () => void;
  query: string;
  selectedCode: string;
  setQuery: (value: string) => void;
};

type CurrencyPickerOptionsListProps = {
  keyboardInset?: number;
  nestedScrollEnabled?: boolean;
  onSelect: (option: CurrencyOption) => void;
  options: CurrencyOption[];
  selectedCode: string;
};

function CurrencyOptionRow({
  item,
  onSelect,
  selected,
}: {
  item: CurrencyOption;
  onSelect: (option: CurrencyOption) => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`mb-2 min-h-14 flex-row items-center rounded-2xl px-4 py-3 active:opacity-85 ${
        selected ? 'bg-primary-muted' : 'bg-card'
      }`}
      onPress={() => onSelect(item)}
    >
      <View className="flex-1">
        <View className="flex-row gap-4">
          <Text className="text-base font-semibold text-foreground">
            {item.code}
          </Text>
          <Text className="mt-0.5 text-sm text-muted">
            {item.name}
          </Text>
        </View>
      </View>
      {selected ? (
        <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
          <View className="h-2 w-2 rounded-full bg-primary-foreground" />
        </View>
      ) : null}
    </Pressable>
  );
}

export function CurrencyPickerHeader({
  onClose,
  onSearchFocus,
  query,
  setQuery,
}: Pick<
  CurrencyPickerSharedProps,
  'onClose' | 'onSearchFocus' | 'query' | 'setQuery'
>) {
  const tokens = useThemeTokens();

  return (
    <View className="">
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-[22px] font-bold text-foreground">
          Choose currency
        </Text>
        <IconAction
          accessibilityLabel="Close currency picker"
          icon="close"
          onPress={onClose}
          size={20}
        />
      </View>

      <TextInput
        accessibilityLabel="Search currencies"
        autoCapitalize="none"
        autoCorrect={false}
        className="mb-4 min-h-12 rounded-2xl bg-surface-2 px-4 py-3 text-base text-foreground"
        onChangeText={setQuery}
        onFocus={onSearchFocus}
        placeholder="Search by code or name"
        placeholderTextColor={tokens.muted}
        value={query}
      />
    </View>
  );
}

export function CurrencyPickerOptionsList({
  keyboardInset = 0,
  nestedScrollEnabled = false,
  onSelect,
  options,
  selectedCode,
}: CurrencyPickerOptionsListProps) {
  const normalizedSelected = selectedCode.trim().toUpperCase();

  const renderItem: ListRenderItem<CurrencyOption> = ({ item }) => (
    <CurrencyOptionRow
      item={item}
      onSelect={onSelect}
      selected={item.code === normalizedSelected}
    />
  );

  if (nestedScrollEnabled) {
    return (
      <FlatList
        contentContainerStyle={{ paddingBottom: keyboardInset }}
        data={options}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.code}
        nestedScrollEnabled
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: keyboardInset }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
    >
      {options.map((item) => (
        <CurrencyOptionRow
          key={item.code}
          item={item}
          onSelect={onSelect}
          selected={item.code === normalizedSelected}
        />
      ))}
    </ScrollView>
  );
}

export type CurrencyPickerContentProps = CurrencyPickerSharedProps & {
  onSelect: (option: CurrencyOption) => void;
};

export function CurrencyPickerContent({
  keyboardInset = 0,
  onClose,
  onSelect,
  onSearchFocus,
  query,
  selectedCode,
  setQuery,
}: CurrencyPickerContentProps) {
  const normalizedSelected = selectedCode.trim().toUpperCase();

  const options = useMemo(
    () => filterCurrencyOptions(query, normalizedSelected),
    [normalizedSelected, query],
  );

  return (
    <View className="flex-1">
      <CurrencyPickerHeader
        onClose={onClose}
        onSearchFocus={onSearchFocus}
        query={query}
        setQuery={setQuery}
      />
      <CurrencyPickerOptionsList
        keyboardInset={keyboardInset}
        onSelect={onSelect}
        options={options}
        selectedCode={selectedCode}
      />
    </View>
  );
}
