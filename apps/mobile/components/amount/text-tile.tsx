import type { ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { FieldGlyph } from '@/components/ui/picker-field';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

type TextTileProps = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'autoCapitalize'
  | 'autoComplete'
  | 'maxLength'
  | 'multiline'
  | 'onBlur'
  | 'keyboardType'
  | 'returnKeyType'
  | 'accessibilityLabel'
> & {
  testID: TestId;
  label: string;
  icon: IconSymbolName;
  /** Before the input on its line, such as a currency symbol. */
  prefix?: string;
  /** Beside the input, inside the tile, such as a button that fills it. */
  trailing?: ReactNode;
};

/**
 * The typed field, shaped like `PickerField`
 * (V2A-CaptureType): 60 tall, a 32 bubble, label 12/16 over a 15/20 600 input.
 */
export function TextTile({
  testID,
  label,
  icon,
  prefix,
  trailing,
  ...input
}: TextTileProps) {
  const tokens = useThemeTokens();
  const field = (layout: string) => (
    <TextInput
      testID={testID}
      accessibilityLabel={label}
      className={`${layout}p-0 text-[15px] leading-[20px] font-display-semibold text-foreground`}
      placeholderTextColor={tokens.muted}
      {...input}
    />
  );
  return (
    <View className="min-h-[60px] flex-row items-center gap-2.5 rounded-tile bg-sand py-2 pl-2.5 pr-3">
      <FieldGlyph name={icon} />
      <View className="min-w-[72px] flex-1 gap-px">
        <Text className="text-[12px] leading-[16px] text-ink-2">
          {label}
        </Text>
        {prefix ? (
          <View className="flex-row items-center">
            <Text className="text-[15px] leading-[20px] font-display-semibold text-muted">
              {prefix}
            </Text>
            {field('min-w-0 flex-1 ')}
          </View>
        ) : (
          field('')
        )}
      </View>
      {trailing}
    </View>
  );
}
