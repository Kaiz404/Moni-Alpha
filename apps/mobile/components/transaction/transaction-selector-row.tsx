import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type TransactionModifierChipProps = {
  accessibilityLabel: string;
  value: string;
  hint?: string;
  leading?: ReactNode;
  onPress: () => void;
};

/** Compact tappable chip for wallet and category pickers in the modifier row. */
export function TransactionModifierChip({
  accessibilityLabel,
  value,
  hint = 'Choose',
  leading,
  onPress,
}: TransactionModifierChipProps) {
  const hasValue = value.trim().length > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="min-h-[52px] flex-1 items-center justify-center rounded-2xl bg-surface-2 px-2 py-2 active:opacity-85"
      onPress={onPress}
    >
      {leading}
      <Text
        className={`mt-1 max-w-full text-center text-xs font-semibold ${
          hasValue ? 'text-foreground' : 'text-muted'
        }`}
        numberOfLines={1}
      >
        {hasValue ? value : hint}
      </Text>
    </Pressable>
  );
}
