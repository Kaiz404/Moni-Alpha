import type { ReactNode } from 'react';
import { View } from 'react-native';

import { CategoryIcon } from '@/components/categories/category-icon';
import type { ChipLook } from '@/components/review/picker-chip';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press, PressRows } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

/** One rounded group: it clips each row's press fill to its corners, and 1 of hairline shows between rows. */
export function FieldRows({ children }: { children: ReactNode }) {
  return (
    <View className="gap-px overflow-hidden rounded-field bg-hairline">
      <PressRows>{children}</PressRows>
    </View>
  );
}

/**
 * A 48 row that opens a picker sheet: its label on the left, and on the right the value's 28
 * bubble, name and chevron. With nothing picked yet the right side turns Lemon and asks.
 */
export function FieldRow({
  testID,
  label,
  look,
  empty = { label: 'Pick a wallet', icon: 'wallet-outline' },
  accessibilityLabel,
  onPress,
}: {
  testID: TestId;
  label: string;
  look: ChipLook | null;
  /** What the Lemon capsule asks for while nothing is picked. */
  empty?: { label: string; icon: IconSymbolName };
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      pressedClassName="bg-hairline"
      className="h-12 flex-row items-center gap-3 bg-sand-light px-3"
    >
      <Text className="text-[14px] leading-[19px] text-ink-2">{label}</Text>
      <View className="min-w-0 flex-1 flex-row items-center justify-end gap-1.5">
        {look ? (
          <>
            <View
              className="h-7 w-7 items-center justify-center rounded-full bg-card"
              style={look.color ? { backgroundColor: look.color } : undefined}
            >
              <CategoryIcon
                icon={look.icon}
                color={look.color ? tokens.onPastel : tokens.foreground}
                size={16}
              />
            </View>
            <Text
              className="min-w-0 shrink text-[15px] leading-[20px] font-display-semibold text-foreground"
              numberOfLines={1}
            >
              {look.name}
            </Text>
            <IconSymbol
              name="chevron-down"
              size={16}
              color={tokens.foreground}
            />
          </>
        ) : (
          <View className="h-8 min-w-0 shrink flex-row items-center gap-1 rounded-full bg-lemon pl-2.5 pr-1.5">
            <IconSymbol
              name={empty.icon}
              size={16}
              color={tokens.onPastel}
            />
            <Text
              className="min-w-0 shrink text-[14px] leading-[19px] font-display-bold text-on-pastel"
              numberOfLines={1}
            >
              {empty.label}
            </Text>
            <IconSymbol
              name="chevron-down"
              size={16}
              color={tokens.onPastel}
            />
          </View>
        )}
      </View>
    </Press>
  );
}
