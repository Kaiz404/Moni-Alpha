import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Keypad } from '@/components/amount/keypad';
import { Button } from '@/components/ui/button';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import {
  pressAmountKey,
  readAmount,
  type AmountSentence,
} from '@/lib/amount/amount-input';
import { currencySymbol } from '@/lib/finance/format-money';
import { tid, type Screen } from '@/lib/test-ids';

/** The amount's sign and colour: expense `−` in ink, income `+` in deep mint, a transfer in Meta, a debt plain. */
export type AmountDirection = 'expense' | 'income' | 'transfer' | 'plain';

const SIGN: Record<AmountDirection, string> = {
  expense: '−',
  income: '+',
  transfer: '',
  plain: '',
};

const TONE: Record<AmountDirection, string> = {
  expense: 'text-foreground',
  income: 'text-deep-mint',
  transfer: 'text-muted',
  plain: 'text-foreground',
};

type AmountPageProps = {
  screen: Screen;
  /** Captures close with ×; amounts reached from a detail page go back with ‹. */
  header: 'task' | 'pushed';
  title: string;
  /** Digits and at most one point, as `pressAmountKey` builds them. */
  typed: string;
  onTyped: (typed: string) => void;
  /** A suggested amount: the first key replaces it instead of adding to it. */
  prefilled?: boolean;
  currency: string;
  direction: AmountDirection;
  sentence: AmountSentence | null;
  /** The control above the amount, such as a segmented control. */
  control?: ReactNode;
  /** Picker fields and the note, between the amount and the keypad. */
  children?: ReactNode;
  /** One Meta line under the fields. */
  hint?: string;
  action: {
    label: string;
    icon?: IconSymbolName;
    onPress: () => void;
    loading?: boolean;
    loadingLabel?: string;
    disabled?: boolean;
  };
};

/**
 * The one page for new money (V2P-AmountPage): the amount fills the top, the
 * fields sit under it, and the Paper keypad and one 56 primary button stay at
 * the bottom. Type it, a debt, a repayment and lending more use it.
 */
export function AmountPage({
  screen,
  header,
  title,
  typed,
  onTyped,
  prefilled = false,
  currency,
  direction,
  sentence,
  control,
  children,
  hint,
  action,
}: AmountPageProps) {
  const { display } = readAmount(typed);
  const shown = `${SIGN[direction]}${currencySymbol(currency)}${display}`;
  return (
    <Page
      screen={screen}
      kind={header}
      title={title}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-2 px-5 pb-3"
        keyboardShouldPersistTaps="handled"
      >
        {control}
        <View className="items-center pt-2">
          <Text
            testID={tid(screen, 'amount')}
            variant={typed.includes('.') ? 'amountHero' : 'hero'}
            className={typed ? TONE[direction] : 'text-muted'}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Amount ${shown}`}
          >
            {shown}
          </Text>
          <Text
            testID={tid(screen, 'sentence')}
            variant="body"
            className={`mt-1 text-center ${sentence?.tone === 'over' ? 'font-display-semibold text-over' : 'text-ink-2'}`}
            numberOfLines={2}
          >
            {sentence?.text ?? ' '}
          </Text>
        </View>
        {children}
        {hint ? (
          <Text
            variant="meta"
            className="px-1.5 pt-1 text-ink-2"
            numberOfLines={1}
          >
            {hint}
          </Text>
        ) : null}
      </ScrollView>
      <View className="gap-3 px-5 pb-3">
        <Keypad
          screen={screen}
          onKey={(key) =>
            onTyped(pressAmountKey(prefilled ? '' : typed, key))
          }
        />
        <Button
          testID={tid(screen, 'submit')}
          pinned
          label={action.label}
          icon={action.icon ?? 'check'}
          onPress={action.onPress}
          loading={action.loading}
          loadingLabel={action.loadingLabel}
          disabled={action.disabled}
        />
      </View>
    </Page>
  );
}
