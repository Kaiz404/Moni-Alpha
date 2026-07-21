import { useState } from 'react';
import type { TextInputProps } from 'react-native';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

function normalizeAmount(value: string): string {
  const cleaned = value.trim().replace(/,/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return '0.00';

  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount.toFixed(2) : value;
}

type AmountInputProps = Omit<
  TextInputProps,
  'keyboardType' | 'onChangeText' | 'value'
> & {
  value: string;
  onChangeValue: (value: string) => void;
  currency?: string | null;
  onCurrencyPress?: () => void;
  className?: string;
};

/**
 * Shared form boundary for user-entered decimal money. Submission still calls
 * `parseAmountInput`, which is the single conversion to a MinorAmount.
 */
export function AmountInput({
  value,
  onChangeValue,
  currency,
  onCurrencyPress,
  className,
  ...props
}: AmountInputProps) {
  const tokens = useThemeTokens();
  const [isFocused, setIsFocused] = useState(false);
  const displayValue = isFocused ? value : normalizeAmount(value);

  return (
    <View
      className={`rounded-[16px] bg-surface-2 px-4 py-2 ${
        isFocused ? 'border border-primary' : ''
      }`}
    >
      <View className="flex-row items-center gap-2">
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? 'Amount'}
          className={`min-h-13  pr-2 flex-1 text-right text-2xl font-bold leading-8 text-foreground ${className ?? ''}`}
          value={displayValue}
          onChangeText={onChangeValue}
          onFocus={(event) => {
            setIsFocused(true);
            const normalized = normalizeAmount(value);
            if (normalized !== value) onChangeValue(normalized);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onChangeValue(normalizeAmount(value));
            props.onBlur?.(event);
          }}
          keyboardType="decimal-pad"
          placeholder={props.placeholder ?? '0.00'}
          placeholderTextColor={
            props.placeholderTextColor ?? tokens.muted
          }
          textAlign="right"
        />
        <View className="border-l border-primary/15 h-12" />
        {currency ? (
          onCurrencyPress ? (
            <Pressable
              accessibilityLabel={`Change currency, currently ${currency.toUpperCase()}`}
              accessibilityRole="button"
              className="min-h-11 justify-center rounded-lg px-2 active:opacity-70"
              hitSlop={8}
              onPress={onCurrencyPress}
            >
              <Text className="text-lg font-bold tracking-wide text-primary">
                {currency.toUpperCase()}
              </Text>
            </Pressable>
          ) : (
            <Text className="text-lg font-bold tracking-wide text-muted">
              {currency.toUpperCase()}
            </Text>
          )
        ) : null}
      </View>
    </View>
  );
}
