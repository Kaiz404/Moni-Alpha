import type { ReactNode } from 'react';
import { Keyboard, View } from 'react-native';

import { FieldBubble } from '@/components/ui/field-bubble';
import {
  IconSymbol,
  type IconSymbolName,
} from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';

type PickerFieldProps = {
  testID: TestId;
  label: string;
  /** The current pick; empty shows `placeholder` in Meta. */
  value: string;
  /** What the screen reader hears when `value` is shortened, such as the full wallet name. */
  spokenValue?: string;
  onPress: () => void;
  /** Shown in Meta while `value` is empty, such as "Pick a date". */
  placeholder?: string;
  /** The glyph in the field's Paper bubble while `leading` is empty. */
  icon: IconSymbolName;
  /** A 32 bubble that stands for the pick, such as the wallet's or the category's tint. */
  leading?: ReactNode;
  className?: string;
  disabled?: boolean;
};

/**
 * The one field that opens a picker sheet, as Type it draws it (V2A-CaptureType): Sand, 60 tall,
 * radius 22, a 32 bubble, label 12/16 Ink 2 over a 15/20 600 value, and a 20 Ink 2 chevron.
 */
export function PickerField({
  testID,
  label,
  value,
  spokenValue,
  onPress,
  placeholder = 'Choose',
  icon,
  leading,
  className,
  disabled = false,
}: PickerFieldProps) {
  const tokens = useThemeTokens();
  const empty = value.trim().length === 0;
  return (
    <Press
      testID={testID}
      accessibilityLabel={`${label}, ${empty ? 'not chosen' : (spokenValue ?? value)}`}
      accessibilityHint="Opens a picker"
      accessibilityState={{ disabled }}
      disabled={disabled}
      radius={{ rest: 22, pressed: 16 }}
      pressedClassName="bg-hairline"
      className={`h-[60px] flex-row items-center gap-2.5 bg-sand px-2.5 ${className ?? ''}`}
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
    >
      {leading ?? <FieldGlyph name={icon} />}
      <FieldText
        label={label}
        value={empty ? placeholder : value}
        muted={empty}
      />
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

/** A glyph in the field's 32 Paper bubble. */
export function FieldGlyph({ name }: { name: IconSymbolName }) {
  const tokens = useThemeTokens();
  return (
    <FieldBubble color={tokens.card}>
      <IconSymbol
        name={name}
        size={17}
        color={tokens.foreground}
      />
    </FieldBubble>
  );
}

/** The field's label 12/16 Ink 2 over its 15/20 600 value. */
export function FieldText({
  label,
  value,
  muted = false,
  trailing,
}: {
  label: string;
  value: string;
  muted?: boolean;
  /** After the value on its line, such as a lock. */
  trailing?: ReactNode;
}) {
  return (
    <View className="min-w-0 flex-1 gap-px">
      <Text
        className="text-[12px] leading-[16px] text-ink-2"
        numberOfLines={1}
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-1.5">
        <Text
          className={`min-w-0 flex-1 text-[15px] leading-[20px] font-display-semibold ${muted ? 'text-muted' : 'text-foreground'}`}
          numberOfLines={1}
        >
          {value}
        </Text>
        {trailing}
      </View>
    </View>
  );
}
