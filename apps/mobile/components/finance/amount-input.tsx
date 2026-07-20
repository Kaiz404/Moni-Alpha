import { useState } from 'react';
import type { TextInputProps } from 'react-native';
import { Text, TextInput, View } from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

type AmountInputProps = Omit<
  TextInputProps,
  'keyboardType' | 'onChangeText' | 'value'
> & {
  value: string;
  onChangeValue: (value: string) => void;
  currency?: string | null;
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
  className,
  ...props
}: AmountInputProps) {
  const tokens = useThemeTokens();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      className={`rounded-[16px] bg-surface-2 px-4 py-2 ${
        isFocused ? 'border border-primary' : ''
      }`}
    >
      <View className="flex-row items-baseline gap-2">
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? 'Amount'}
          className={`min-h-13 flex-1 py-1 text-right text-[28px] font-bold leading-8 text-foreground ${className ?? ''}`}
          value={value}
          onChangeText={onChangeValue}
          onFocus={(event) => {
            setIsFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            props.onBlur?.(event);
          }}
          keyboardType="decimal-pad"
          placeholder={props.placeholder ?? '0.00'}
          placeholderTextColor={
            props.placeholderTextColor ?? tokens.muted
          }
          textAlign="right"
        />
        {currency ? (
          <Text className="pb-1 text-xs font-bold tracking-wide text-muted">
            {currency.toUpperCase()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
