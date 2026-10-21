import type { ReactNode } from 'react';
import { TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { currencySymbol } from '@/lib/finance/format-money';
import { tid, type Screen } from '@/lib/test-ids';

const MAX_WHOLE = 100_000;

/** Parse what the user typed: a positive amount under RM100,000, whole or to two decimals. */
export function parseDraft(
  draft: string,
  decimals: boolean,
): number | null {
  const pattern = decimals ? /^\d+(\.\d{0,2})?$/ : /^\d+$/;
  if (!pattern.test(draft.trim())) return null;
  const value = Number(draft);
  return value > 0 && value < MAX_WHOLE ? value : null;
}

type InPlaceFieldProps = {
  screen: Screen;
  name: string;
  accessibilityLabel: string;
  value: string;
  onChangeText: (text: string) => void;
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
  /** An amount shows the currency before the digits and raises the numeric keyboard. */
  currency?: string;
  decimals?: boolean;
  maxLength?: number;
  children?: ReactNode;
};

/**
 * Editing an existing value where it sits (tokens.md "In-place edit"): a Paper
 * field with a 2 ink border, the system keyboard, then cancel and save. Save
 * stays off until the value is valid.
 */
export function InPlaceField({
  screen,
  name,
  accessibilityLabel,
  value,
  onChangeText,
  onCancel,
  onSave,
  canSave,
  currency,
  decimals = false,
  maxLength,
  children,
}: InPlaceFieldProps) {
  const tokens = useThemeTokens();
  const amount = currency !== undefined;
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2">
        <View
          className={`min-w-0 flex-1 flex-row items-center gap-1.5 rounded-field border-2 border-primary bg-card px-3.5 ${amount ? 'h-16' : 'h-[52px]'}`}
        >
          {amount ? (
            <Text className="text-[28px] leading-8 font-display-bold text-muted">
              {currencySymbol(currency)}
            </Text>
          ) : null}
          <TextInput
            testID={tid(screen, name, 'input')}
            accessibilityLabel={accessibilityLabel}
            autoFocus
            value={value}
            onChangeText={(text) =>
              onChangeText(
                amount
                  ? text
                      .replace(decimals ? /[^0-9.]/g : /[^0-9]/g, '')
                      .slice(0, decimals ? 8 : 5)
                  : text.slice(0, maxLength),
              )
            }
            keyboardType={
              amount
                ? decimals
                  ? 'decimal-pad'
                  : 'number-pad'
                : 'default'
            }
            returnKeyType="done"
            onSubmitEditing={() => canSave && onSave()}
            selectionColor={tokens.foreground}
            className={`min-w-0 flex-1 p-0 text-foreground ${amount ? 'font-display-bold text-[40px] leading-[44px]' : 'font-display-semibold text-[18px] leading-[22px]'}`}
            style={{ fontVariant: ['tabular-nums'] }}
          />
        </View>
        <Press
          testID={tid(screen, name, 'cancel')}
          accessibilityLabel="Cancel"
          onPress={onCancel}
          pressedClassName="bg-hairline"
          className="h-11 w-11 items-center justify-center rounded-full bg-sand"
        >
          <IconSymbol
            name="close"
            size={20}
            color={tokens.foreground}
          />
        </Press>
        <Press
          testID={tid(screen, name, 'save')}
          accessibilityLabel="Save"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={onSave}
          pressedClassName="bg-primary-pressed"
          className={`h-11 w-11 items-center justify-center rounded-full ${canSave ? 'bg-primary' : 'bg-inactive'}`}
        >
          <IconSymbol
            name="check"
            size={22}
            color={tokens.primaryForeground}
          />
        </Press>
      </View>
      {children}
    </View>
  );
}

/** The 32 Sand pencil beside a value; its hit area is 44. */
export function Pencil({
  testID,
  accessibilityLabel,
  onPress,
}: {
  testID: `${Screen}.${string}`;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  return (
    <Press
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      pressedClassName="bg-hairline"
      className="h-8 w-8 items-center justify-center rounded-full bg-sand"
    >
      <IconSymbol
        name="pencil-outline"
        size={16}
        color={tokens.foreground}
      />
    </Press>
  );
}
