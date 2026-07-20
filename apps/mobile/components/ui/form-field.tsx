import { useState } from 'react';
import {
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useThemeTokens } from '@/hooks/use-theme-tokens';

type FormFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

/** Accessible, roomy form field for auth and financial entry screens. */
export function FormField({
  label,
  hint,
  error,
  containerClassName,
  className,
  placeholderTextColor,
  accessibilityLabel,
  onFocus,
  onBlur,
  ...props
}: FormFieldProps) {
  const tokens = useThemeTokens();
  const helper = error ?? hint;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className={`mb-4 ${containerClassName ?? ''}`}>
      <Text className="mb-2 text-[15px] font-semibold text-foreground">
        {label}
      </Text>
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={placeholderTextColor ?? tokens.muted}
        className={`min-h-13 rounded-2xl bg-surface-2 px-4 py-3 text-base text-foreground ${
          error
            ? 'border border-danger bg-danger/10'
            : isFocused
              ? 'border border-primary'
              : ''
        } ${className ?? ''}`}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
      />
      {helper ? (
        <Text
          className={`mt-2 text-xs leading-4 ${
            error ? 'text-danger' : 'text-muted'
          }`}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
