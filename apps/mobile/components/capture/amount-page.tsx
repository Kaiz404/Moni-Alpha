import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Keypad } from '@/components/capture/keypad';
import { Button } from '@/components/ui/button';
import type { IconSymbolName } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import {
  pressAmountKey,
  readAmount,
} from '@/lib/capture/amount-input';
import type { AmountSentence } from '@/lib/capture/amount-sentence';
import { currencySymbol } from '@/lib/finance/format-money';
import { tid, type Screen } from '@/lib/test-ids';

export type AmountDirection = 'expense' | 'income' | 'neutral';

const SIGN: Record<AmountDirection, string> = {
  expense: '−',
  income: '+',
  neutral: '',
};

const TONE: Record<AmountDirection, string> = {
  expense: 'text-foreground',
  income: 'text-deep-mint',
  neutral: 'text-muted',
};

type AmountPageProps = {
  screen: Screen;
  /** Captures close with ×; amounts reached from a detail page go back with ‹. */
  header: 'task' | 'pushed';
  title: string;
  /** Digits and at most one point, as `pressAmountKey` builds them. */
  typed: string;
  onTyped: (typed: string) => void;
  currency: string;
  direction: AmountDirection;
  sentence: AmountSentence | null;
  /** The control above the amount, such as the type segmented control. */
  control?: ReactNode;
  /** Picker fields and the note, between the amount and the keypad. */
  children: ReactNode;
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
 * fields sit under it, and the Paper keypad and one primary button stay at the
 * bottom. Type it uses it; bills and debts reuse it.
 */
export function AmountPage({
  screen,
  header,
  title,
  typed,
  onTyped,
  currency,
  direction,
  sentence,
  control,
  children,
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
            className={TONE[direction]}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={`Amount ${shown}`}
          >
            {shown}
          </Text>
          <Text
            testID={tid(screen, 'sentence')}
            variant="body"
            className={`mt-1 text-center ${sentence?.tone === 'over' ? 'text-over' : 'text-ink-2'}`}
            numberOfLines={2}
          >
            {sentence?.text ?? ' '}
          </Text>
        </View>
        {children}
      </ScrollView>
      <View className="gap-3 px-5 pb-3">
        <Keypad
          screen={screen}
          onKey={(key) => onTyped(pressAmountKey(typed, key))}
        />
        <Button
          testID={tid(screen, 'submit')}
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
