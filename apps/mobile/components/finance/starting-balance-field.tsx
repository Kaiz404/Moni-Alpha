import { useState } from 'react';
import { Text } from 'react-native';

import { AmountInput } from '@/components/finance/amount-input';
import { CurrencyPickerModal } from '@/components/finance/currency-picker-modal';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

type StartingBalanceFieldProps = {
  currency: string;
  hint?: string;
  label?: string;
  onChangeValue: (value: string) => void;
  onCurrencyChange: (currency: string) => void;
  value: string;
};

export function StartingBalanceField({
  currency,
  hint,
  label = 'Starting balance',
  onChangeValue,
  onCurrencyChange,
  value,
}: StartingBalanceFieldProps) {
  const tokens = useThemeTokens();
  const [pickerVisible, setPickerVisible] = useState(false);

  return (
    <>
      <Text className="mb-2 text-[15px] font-semibold text-foreground">
        {label}
      </Text>
      <AmountInput
        accessibilityLabel={label}
        className="min-h-13 px-4 py-3 text-right text-xl font-semibold text-foreground"
        currency={currency}
        onChangeValue={onChangeValue}
        onCurrencyPress={() => setPickerVisible(true)}
        placeholder="0.00"
        placeholderTextColor={tokens.muted}
        value={value}
      />
      {hint ? (
        <Text className="mt-2 text-xs leading-4 text-muted">{hint}</Text>
      ) : null}
      <CurrencyPickerModal
        onClose={() => setPickerVisible(false)}
        onSelect={onCurrencyChange}
        selectedCode={currency}
        visible={pickerVisible}
      />
    </>
  );
}
