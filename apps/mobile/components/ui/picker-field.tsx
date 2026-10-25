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
  /** The current pick; empty shows `placeholder` in Meta. */
  value: string;
  onPress: () => void;
  /** Shown in Meta while `value` is empty, such as "Pick a date". */
  placeholder?: string;
  /** An 18 glyph or 10 dot just before the value, as V2F-Components draws the category and wallet fields. */
  mark?: ReactNode;
  /** A bubble beside the label and value, for the capture pages' larger marks. */
  leading?: ReactNode;
  className?: string;
  disabled?: boolean;
  /**
   * `capture` is the Type it field (V2A-CaptureType): 60 tall, radius 22, a 32
   * bubble in `leading`, label 12/16 Ink 2 over a 15/20 600 value, and a 20
   * Ink 2 chevron at the end.
   */
  size?: 'default' | 'capture';
};

/**
 * The Sand field that opens a picker sheet (V2F-Components "Pickers"):
 * radius 16, 64 tall, label 13/18 over the value row: mark, value 16/22
 * 600, and an 18 chevron-down, 6 apart.
 */
export function PickerField({
  testID,
  label,
  value,
  onPress,
  placeholder = 'Choose',
  mark,
  leading,
  className,
  disabled = false,
  size = 'default',
}: PickerFieldProps) {
  const tokens = useThemeTokens();
  const empty = value.trim().length === 0;
  const shown = empty ? placeholder : value;
  if (size === 'capture') {
    return (
      <Press
        testID={testID}
        accessibilityLabel={`${label}, ${empty ? 'not chosen' : value}`}
        accessibilityHint="Opens a picker"
        accessibilityState={{ disabled }}
        disabled={disabled}
        radius={{ rest: 22, pressed: 16 }}
        pressedClassName="bg-hairline"
        className={`h-[60px] flex-row items-center gap-2.5 bg-sand px-2.5 ${className ?? ''}`}
        onPress={onPress}
      >
        {leading}
        <View className="min-w-0 flex-1 gap-px">
          <Text
            className="text-[12px] leading-[16px] text-ink-2"
            numberOfLines={1}
          >
            {label}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {mark}
            <Text
              className={`min-w-0 flex-1 text-[15px] leading-[20px] font-display-semibold ${empty ? 'text-muted' : 'text-foreground'}`}
              numberOfLines={1}
            >
              {shown}
            </Text>
          </View>
        </View>
        <View pointerEvents="none">
          <IconSymbol
            name="chevron-down"
            size={20}
            color={tokens.ink2}
          />
        </View>
      </Press>
    );
  }
  return (
    <Press
      testID={testID}
      accessibilityLabel={`${label}, ${empty ? 'not chosen' : value}`}
      accessibilityHint="Opens a picker"
      accessibilityState={{ disabled }}
      disabled={disabled}
      pressedClassName="bg-hairline"
      className={`h-16 flex-row items-center gap-2.5 rounded-field bg-sand px-3.5 ${className ?? ''}`}
      onPress={onPress}
    >
      {leading}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          variant="meta"
          className="text-muted"
          numberOfLines={1}
        >
          {label}
        </Text>
        <View className="flex-row items-center gap-1.5">
          {mark}
          <Text
            variant="rowTitle"
            className={`min-w-0 flex-1 ${empty ? 'text-muted' : 'text-foreground'}`}
            numberOfLines={1}
          >
            {shown}
          </Text>
          <View pointerEvents="none">
            <IconSymbol
              name="chevron-down"
              size={18}
              color={tokens.foreground}
            />
          </View>
        </View>
      </View>
    </Press>
  );
}
