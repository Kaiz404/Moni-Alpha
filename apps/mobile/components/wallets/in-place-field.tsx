import type { ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { tid } from '@/lib/test-ids';

/** The 32 Sand pencil after a value that edits in place; its hit area is 44. */
export function Pencil({
  part,
  label,
  onPress,
}: {
  part: string;
  label: string;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={tid('wallet', part, 'pencil')}
      accessibilityLabel={label}
      hitSlop={6}
      pressedClassName="bg-hairline"
      className="h-8 w-8 items-center justify-center rounded-full bg-sand"
      onPress={onPress}
    >
      <IconSymbol
        name="pencil-outline"
        size={16}
        color={tokens.foreground}
      />
    </Press>
  );
}

type InPlaceFieldProps = Omit<TextInputProps, 'testID' | 'style'> & {
  /** `wallet.<part>.input`, `.cancel`, `.save`. */
  part: 'name' | 'balance';
  saveLabel: string;
  onCancel: () => void;
  onSave: () => void;
  /** The currency symbol before an amount, 28/700 Meta. */
  prefix?: string;
};

/**
 * tokens.md in-place edit: a Paper field with a 2 ink border and radius 16,
 * then cancel (Sand) and save (Ink). Amounts are 64 tall at 40/44 700, names
 * 52 tall at 18/600. The phone's own keyboard does the typing.
 */
export function InPlaceField({
  part,
  saveLabel,
  onCancel,
  onSave,
  prefix,
  ...input
}: InPlaceFieldProps) {
  const tokens = useThemeTokens();
  const amount = part === 'balance';
  return (
    <View className="flex-row items-center gap-2">
      <View
        className={`min-w-0 flex-1 flex-row items-center gap-1 rounded-field border-2 border-foreground bg-card px-3.5 ${amount ? 'h-16' : 'h-[52px]'}`}
      >
        {prefix ? (
          <Text className="font-display-bold text-[28px] leading-[32px] text-muted">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          {...input}
          testID={tid('wallet', part, 'input')}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={onSave}
          placeholderTextColor={tokens.muted}
          cursorColor={tokens.foreground}
          selectionColor={tokens.foreground}
          className={`min-w-0 flex-1 p-0 text-foreground ${amount ? 'font-display-bold text-[40px] leading-[44px]' : 'font-display-semibold text-[18px] leading-[22px]'}`}
          style={
            amount ? { fontVariant: ['tabular-nums'] } : undefined
          }
        />
      </View>
      <Press
        testID={tid('wallet', part, 'cancel')}
        accessibilityLabel="Cancel"
        pressedClassName="bg-hairline"
        className="h-11 w-11 items-center justify-center rounded-full bg-sand"
        onPress={onCancel}
      >
        <IconSymbol
          name="close"
          size={20}
          color={tokens.foreground}
        />
      </Press>
      <Press
        testID={tid('wallet', part, 'save')}
        accessibilityLabel={saveLabel}
        pressedClassName="bg-primary-pressed"
        className="h-11 w-11 items-center justify-center rounded-full bg-primary"
        onPress={onSave}
      >
        <IconSymbol
          name="check"
          size={22}
          color={tokens.primaryForeground}
        />
      </Press>
    </View>
  );
}

export function FieldNote({ children }: { children: ReactNode }) {
  return (
    <Text
      variant="meta"
      accessibilityLiveRegion="polite"
      className="text-ink-2"
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {children}
    </Text>
  );
}
