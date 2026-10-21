import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AmountKeypad } from '@/components/debts/amount-keypad';
import { typedDisplay } from '@/components/debts/typed-amount';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { tid } from '@/lib/test-ids';

/**
 * The amount page for new money on a debt (REDESIGN "Editing"): the number
 * gets the screen and the Paper keypad, with one primary action. Debt-local
 * until it merges with the capture Type it page.
 */
export function AmountPage({
  title,
  currency,
  typed,
  prefilled = false,
  onType,
  sentence,
  over = false,
  top,
  fields,
  hint,
  action,
}: {
  title: string;
  currency: string;
  typed: string;
  /** A suggested amount: the first key replaces it instead of adding to it. */
  prefilled?: boolean;
  onType: (next: string) => void;
  sentence: string;
  /** The amount is more than the debt allows; the sentence turns Over text. */
  over?: boolean;
  top?: ReactNode;
  fields?: ReactNode;
  hint?: string;
  action: { label: string; disabled: boolean; onPress: () => void };
}) {
  return (
    <Page
      screen="debts"
      kind="pushed"
      title={title}
    >
      <View className="flex-1 px-5 pb-5">
        {top}
        <View className="items-center gap-1 pb-5 pt-6">
          <Text
            variant="hero"
            accessibilityLiveRegion="polite"
            className={typed ? 'text-foreground' : 'text-muted'}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {typedDisplay(typed, currency)}
          </Text>
          <Text
            className={`text-center text-[15px] leading-[21px] ${over ? 'font-display-semibold text-over' : 'text-ink-2'}`}
          >
            {sentence}
          </Text>
        </View>
        {fields}
        {hint ? (
          <Text
            variant="meta"
            className="px-1.5 pt-3 text-ink-2"
            numberOfLines={1}
          >
            {hint}
          </Text>
        ) : null}
        <View className="flex-1" />
        <AmountKeypad
          value={prefilled ? '' : typed}
          onChange={onType}
        />
        <Button
          testID={tid('debts', 'amount', 'save')}
          className="mt-4"
          pinned
          icon="check"
          label={action.label}
          disabled={action.disabled}
          onPress={action.onPress}
        />
      </View>
    </Page>
  );
}
