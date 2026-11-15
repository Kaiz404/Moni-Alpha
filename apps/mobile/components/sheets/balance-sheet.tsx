import { minorToNumber } from '@repo/types';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { parseAmountDraft } from '@/components/ui/in-place-field';
import { Sheet, type SheetFrameProps } from '@/components/ui/sheet/sheet';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { currencySymbol } from '@/lib/finance/format-money';
import type { SheetRequestOf } from '@/lib/sheet/sheet-store';
import { tid } from '@/lib/test-ids';
import { balanceDiffLine } from '@/lib/wallets/wallet-page';

type BalanceSheetProps = SheetFrameProps & {
  request: SheetRequestOf<'balance'>;
  onSave: (balanceMinor: SheetRequestOf<'balance'>['balanceMinor']) => void;
};

/**
 * The wallet page's balance correction: the real balance in an amount field, a live line saying
 * what Moni will add, and the plain rule that saving adds a correction rather than changing history.
 */
export function BalanceSheet({ request, onSave, ...frame }: BalanceSheetProps) {
  const tokens = useThemeTokens();
  const { balanceMinor, currency, source } = request;
  const [draft, setDraft] = useState('');
  const typed = parseAmountDraft(draft, { signed: true });
  const save = () => {
    if (typed !== null) onSave(typed);
  };
  return (
    <Sheet
      {...frame}
      size="fit"
      title="Balance not right?"
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
          Saving adds a balance correction transaction for the difference. Your past transactions
          stay as they are.
        </Text>
        <View className="gap-1.5">
          <Text
            variant="meta"
            className="text-muted"
          >
            {source.kind === 'cash'
              ? `Cash you have, in ${currency}`
              : `Balance your ${source.name} app shows, in ${currency}`}
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
          <Text
            testID={tid('wallet', 'balance-sheet', 'line')}
            variant="meta"
            className="text-ink-2"
          >
            {balanceDiffLine(
              balanceMinor,
              currency,
              typed === null ? null : minorToNumber(typed),
              source,
            )}
          </Text>
        </View>
      </View>
    </Sheet>
  );
}
