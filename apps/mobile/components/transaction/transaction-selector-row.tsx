import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type TransactionModifierChipProps = {
  accessibilityLabel: string;
  value: string;
  hint?: string;
  detail?: string;
  leading?: ReactNode;
  /** The wallet or category colour used to make the selected value recognisable. */
  accentColor?: string;
  onPress: () => void;
};

/** Labeled surface tile with a compact wallet or category colour marker. */
export function TransactionModifierChip({
  accessibilityLabel,
  value,
  hint = 'Choose',
  detail,
  leading,
  accentColor,
  onPress,
}: TransactionModifierChipProps) {
  const tokens = useThemeTokens();
  const hasValue = value.trim().length > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="min-h-[76px] flex-1 justify-center rounded-2xl bg-surface-2 px-3 py-2 active:opacity-85"
      onPress={onPress}
    >
      <Text
        className="text-[11px] font-bold uppercase tracking-wide text-muted"
        numberOfLines={1}
      >
        {hint}
      </Text>
      <View className="mt-1 flex-row items-center">
        {leading ? (
          <View
            className="mr-2 h-8 w-8 items-center justify-center rounded-full bg-card"
            style={
              accentColor
                ? { backgroundColor: accentColor }
                : undefined
            }
          >
            {leading}
          </View>
        ) : null}
        <Text
          className={`min-w-0 flex-1 text-sm font-bold ${
            hasValue ? 'text-foreground' : 'text-muted'
          }`}
          numberOfLines={1}
        >
          {hasValue ? value : `Choose ${hint.toLowerCase()}`}
        </Text>
        <IconSymbol
          color={tokens.muted}
          name="chevron-down"
          size={18}
        />
      </View>
      {detail && hasValue ? (
        <Text
          className="ml-10 mt-0.5 text-xs font-medium text-muted"
          numberOfLines={1}
        >
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}
