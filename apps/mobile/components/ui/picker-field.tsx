import type { ReactNode } from 'react';
import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

type PickerFieldProps = {
  testID: TestId;
  label: string;
  /** The current pick; empty shows "Choose" in Meta. */
  value: string;
  onPress: () => void;
  leading?: ReactNode;
  className?: string;
};

/**
 * The Sand field that opens a picker sheet (V2F-Components "Pickers"):
 * radius 16, 64 tall, label 13/18 over value 16/22 600, chevron-down.
 */
export function PickerField({
  testID,
  label,
  value,
  onPress,
  leading,
  className,
}: PickerFieldProps) {
  const tokens = useThemeTokens();
  const empty = value.trim().length === 0;
  return (
    <Press
      testID={testID}
      accessibilityLabel={`${label}, ${empty ? 'not chosen' : value}`}
      accessibilityHint="Opens a picker"
      pressedClassName="bg-hairline"
      className={`h-16 flex-row items-center gap-2.5 rounded-field bg-sand px-3.5 ${className ?? ''}`}
      onPress={onPress}
    >
      {leading}
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] leading-[18px] text-muted" numberOfLines={1}>
          {label}
        </Text>
        <Text
          className={`text-base leading-[22px] font-display-semibold ${empty ? 'text-muted' : 'text-foreground'}`}
          numberOfLines={1}
        >
          {empty ? 'Choose' : value}
        </Text>
      </View>
      <View pointerEvents="none">
        <IconSymbol name="chevron-down" size={20} color={tokens.foreground} />
      </View>
    </Press>
  );
}
