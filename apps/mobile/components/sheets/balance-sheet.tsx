import { minorToNumber } from '@repo/types';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { parseAmountDraft } from '@/components/ui/in-place-field';
import { Sheet, type SheetFrameProps } from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { SheetRequestOf } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';
import { currencySymbol } from '@repo/core';

type BalanceSheetProps = SheetFrameProps & {
  request: SheetRequestOf<'balance'>;
  onSave: (balanceMinor: SheetRequestOf<'balance'>['balanceMinor']) => void;
};

/** The wallet page's balance correction: the amount field and one sentence about what saving adds. */
export function BalanceSheet({ request, onSave, ...frame }: BalanceSheetProps) {
  const tokens = useThemeTokens();
  const { balanceMinor, currency } = request;
  const [draft, setDraft] = useState('');
  const typed = parseAmountDraft(draft, { signed: true });
  const save = () => {
    if (typed !== null) onSave(typed);
  };
  return (
    <Sheet
      {...frame}
      size="fit"
      title="Edit Amount"
      actions={
        <>
          <Button
            testID={tid('wallet', 'balance-sheet', 'cancel')}
            className="flex-1"
            pinned
            variant="secondary"
            label="Cancel"
            onPress={frame.onDismiss}
          />
          <Button
            testID={tid('wallet', 'balance-sheet', 'save')}
            className="flex-1"
            pinned
            label="Save"
            disabled={typed === null}
            onPress={save}
          />
        </>
      }
    >
      <View className="gap-3">
        <Text className="text-[15px] leading-[21px] text-ink-2">
          Adds a balance correction transaction for the difference.
        </Text>
        <View className="h-16 flex-row items-center gap-1 rounded-field border-2 border-foreground bg-card px-3.5">
            <Text className="font-display-bold text-[28px] leading-[32px] text-muted">
              {currencySymbol(currency)}
            </Text>
            <TextInput
              testID={tid('wallet', 'balance-sheet', 'input')}
              accessibilityLabel={`New balance in ${currency}`}
              autoFocus
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={save}
              returnKeyType="done"
              keyboardType="numeric"
              maxLength={12}
              placeholder={minorToNumber(balanceMinor).toFixed(2)}
              placeholderTextColor={tokens.muted}
              cursorColor={tokens.foreground}
              selectionColor={tokens.foreground}
              className="h-full min-w-0 flex-1 p-0 font-display-bold text-[40px] leading-[44px] text-foreground"
              style={{ fontVariant: ['tabular-nums'] }}
            />
          </View>
      </View>
    </Sheet>
  );
}
