import { useState, type ReactNode, type Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

type AuthFieldProps = Omit<TextInputProps, 'testID' | 'className'> & {
  testID: TestId;
  label: string;
  icon?: IconSymbolName;
  hint?: string;
  /** Wrong details: Over border and icon; the message sits below the last field. */
  invalid?: boolean;
  trailing?: ReactNode;
  ref?: Ref<TextInput>;
};

/** V2H-Login field: 13/600 label over a 52-tall Paper field with a 1.5 Hairline border. */
export function AuthField({
  testID,
  label,
  icon,
  hint,
  invalid = false,
  trailing,
  ref,
  onFocus,
  onBlur,
  ...input
}: AuthFieldProps) {
  const tokens = useThemeTokens();
  const [focused, setFocused] = useState(false);
  const border = invalid
    ? 'border-over'
    : focused
      ? 'border-foreground'
      : 'border-hairline';
  return (
    <View className="gap-2">
      <Text className="text-[13px] leading-[18px] font-display-semibold text-ink-2">
        {label}
      </Text>
      <View
        className={`flex-row items-center gap-2.5 rounded-field border-[1.5px] bg-card ${border} ${trailing ? 'pl-[18px] pr-1' : 'px-[18px]'}`}
      >
        {icon ? (
          <IconSymbol
            name={icon}
            size={20}
            color={invalid ? tokens.over : tokens.muted}
          />
        ) : null}
        <TextInput
          {...input}
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={tokens.muted}
          className="h-[52px] min-w-0 flex-1 font-display text-[16px] text-foreground"
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {trailing}
      </View>
      {hint ? (
        <Text
          variant="meta"
          className="text-muted"
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
