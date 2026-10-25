import { View } from 'react-native';
import { useUniwind } from 'uniwind';

import { CategoryIcon } from '@/components/categories/category-icon';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

export type ChipLook = { name: string; icon: string | null; color: string | null };

/**
 * The 44 chip that opens a picker sheet on the review card and Moni's draft card: a 28 bubble in
 * the item's colour, its name, chevron-down. With nothing picked yet it turns Lemon and asks.
 */
export function PickerChip({
  testID,
  look,
  accessibilityLabel,
  tinted = false,
  empty = { label: 'Pick a wallet', icon: 'wallet-outline' },
  onPress,
}: {
  testID: TestId;
  look: ChipLook | null;
  accessibilityLabel: string;
  /** The category chip takes its category's tint; wallet chips stay Sand. */
  tinted?: boolean;
  /** What the Lemon chip asks for while nothing is picked. */
  empty?: { label: string; icon: IconSymbolName };
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  if (!look) {
    return (
      <Press
        testID={testID}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        radius={{ rest: 22, pressed: 16 }}
        className="h-11 flex-row items-center gap-1.5 bg-lemon pl-3 pr-2.5"
      >
        <IconSymbol
          name={empty.icon}
          size={18}
          color={tokens.onPastel}
        />
        <Text className="text-[14px] leading-[19px] font-display-bold text-on-pastel">
          {empty.label}
        </Text>
        <IconSymbol
          name="chevron-down"
          size={16}
          color={tokens.onPastel}
        />
      </Press>
    );
  }
  return (
    <Press
      testID={testID}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-hairline"
      className="h-11 min-w-0 shrink flex-row items-center gap-1 bg-sand pl-1.5 pr-2"
      style={
        tinted && look.color
          ? { backgroundColor: `${look.color}${dark ? '38' : '73'}` }
          : undefined
      }
    >
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
        className="min-w-0 shrink text-[14px] leading-[19px] font-display-semibold text-foreground"
        numberOfLines={1}
      >
        {look.name}
      </Text>
      <IconSymbol
        name="chevron-down"
        size={16}
        color={tokens.foreground}
      />
    </Press>
  );
}
