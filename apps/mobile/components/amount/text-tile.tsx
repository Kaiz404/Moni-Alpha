import type { ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { FieldBubble } from '@/components/capture/field-bubble';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
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
> & {
  testID: TestId;
  label: string;
  icon: IconSymbolName;
  /** Beside the input, inside the tile, such as a button that fills it. */
  trailing?: ReactNode;
};

/**
 * The typed field of the amount page, shaped like `PickerField size="capture"`
 * (V2A-CaptureType): 60 tall, a 32 bubble, label 12/16 over a 15/20 600 input.
 */
export function TextTile({
  testID,
  label,
  icon,
  trailing,
  ...input
}: TextTileProps) {
  const tokens = useThemeTokens();
  return (
    <View className="h-[60px] flex-row items-center gap-2.5 rounded-tile bg-sand pl-2.5 pr-3">
      <FieldBubble color={tokens.card}>
        <IconSymbol
          name={icon}
          size={17}
          color={tokens.foreground}
        />
      </FieldBubble>
      <View className="min-w-[72px] flex-1 gap-px">
        <Text className="text-[12px] leading-[16px] text-ink-2">
          {label}
        </Text>
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          className="p-0 text-[15px] leading-[20px] font-display-semibold text-foreground"
          placeholderTextColor={tokens.muted}
          {...input}
        />
      </View>
      {trailing}
    </View>
  );
}
