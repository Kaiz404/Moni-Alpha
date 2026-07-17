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
  ...props
}: FormFieldProps) {
  const tokens = useThemeTokens();
  const helper = error ?? hint;

  return (
    <View className={`mb-4 ${containerClassName ?? ''}`}>
      <Text className="mb-2 text-[15px] font-semibold text-foreground">
        {label}
      </Text>
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={placeholderTextColor ?? tokens.muted}
        className={`min-h-13 rounded-2xl border bg-surface-2 px-4 py-3 text-base text-foreground ${
          error ? 'border-danger' : 'border-border'
        } ${className ?? ''}`}
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
