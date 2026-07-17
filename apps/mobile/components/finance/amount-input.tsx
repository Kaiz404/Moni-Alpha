import type { TextInputProps } from 'react-native';
import { Text, TextInput, View } from 'react-native';

type AmountInputProps = Omit<TextInputProps, 'keyboardType' | 'onChangeText' | 'value'> & {
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
  className = 'rounded-xl border border-border bg-card px-3 py-3 text-foreground',
  ...props
}: AmountInputProps) {
  return (
    <View className="flex-row items-center gap-2">
      <TextInput
        {...props}
        className={`flex-1 ${className}`}
        value={value}
        onChangeText={onChangeValue}
        keyboardType="decimal-pad"
        placeholder={props.placeholder ?? '0.00'}
      />
      {currency ? <Text className="text-xs font-semibold text-muted">{currency.toUpperCase()}</Text> : null}
    </View>
  );
}
