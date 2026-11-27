import type { MinorAmount } from '@repo/types';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { InPlaceField, InPlaceGroup } from '@/components/ui/in-place-field';
import { Text } from '@/components/ui/text';
import { replaceMessage, type ChatMessage } from '@/lib/ai/chat/messages';
import { threadDay } from '@/lib/ai/chat/sessions';
import { pickedSuggestion$ } from '@/lib/budget/suggestion';
import { PLAN_LIMIT_MINOR } from '@/lib/finance/money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { setMonthlyBudget, upsertCategoryBudget } from '@/lib/supabase/category-budgets';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { currencySymbol, formatMoney, suggestTargetName } from '@repo/core';

import { ActionButton, DoneRow } from './draft-card';

type BudgetDraftMessage = Extract<ChatMessage, { kind: 'assistant_budget_draft' }>;

/** Moni's suggested budget (#139): the amount edits in place, Set budget saves it or hands it to Edit budgets. */
export function BudgetDraftCard({ message }: { message: BudgetDraftMessage }) {
  const currency = useMainCurrency();
  const [busy, setBusy] = useState(false);
  const name = suggestTargetName(message.target);
  const amount = formatMoney(message.amountMinor, currency, { whole: true });
  const update = (patch: Partial<BudgetDraftMessage>) =>
    replaceMessage(threadDay(message.createdAt), message.id, { ...message, ...patch });

  if (message.done)
    return (
      <DoneRow
        outcome={{ kind: 'approved', title: `${name} set to ${amount}`, meta: '' }}
        undoable={false}
        id={message.id}
      />
    );

  const setBudget = async () => {
    if (busy) return;
    const { target } = message;
    const amountMinor = message.amountMinor as MinorAmount;
    if (message.into === 'edit') {
      update({ done: true });
      pickedSuggestion$.set({ target, amountMinor });
      router.back();
      return;
    }
    setBusy(true);
    try {
      if (target.kind === 'total') await setMonthlyBudget(Number(amountMinor) / 100);
      else await upsertCategoryBudget(target.id, currency, amountMinor);
    } catch {
      setBusy(false);
      showToast({ text: "Couldn't save that. Try again.", tone: 'removed' });
      return;
    }
    update({ done: true });
  };

  return (
    <View
      accessibilityLabel={`Moni suggests ${amount} a month for ${name}`}
      className="gap-2.5 rounded-card bg-card px-[18px] pb-[18px] pt-4"
    >
      <Text
        variant="meta"
        className="text-muted"
      >
        {`Moni's suggestion for ${name}`}
      </Text>
      <InPlaceGroup>
        <InPlaceField
          testID={tid('chat', 'budget', 'amount')}
          label="Suggested budget"
          kind="amount"
          prefix={currencySymbol(currency)}
          whole
          max={PLAN_LIMIT_MINOR}
          value={message.amountMinor as MinorAmount}
          onSave={(amountMinor) => {
            update({ amountMinor });
          }}
        >
          <Text
            variant="amountHero"
            className="text-foreground"
            style={{ fontSize: 44, lineHeight: 50, fontVariant: ['tabular-nums'] }}
          >
            {`${amount} a month`}
          </Text>
        </InPlaceField>
      </InPlaceGroup>
      {message.average ? (
        <Text
          testID={tid('chat', 'budget', 'average')}
          variant="meta"
          className="text-muted"
        >
          {message.average}
        </Text>
      ) : null}
      <Text
        variant="body"
        className="text-ink-2"
      >
        {message.note}
      </Text>
      <View className="flex-row">
        <ActionButton
          testID={tid('chat', 'budget', 'set')}
          label={message.into === 'edit' ? 'Use this amount' : 'Set budget'}
          icon="check"
          fill="bg-block-mint"
          accessibilityLabel={`Set ${name} to ${amount} a month`}
          onPress={() => void setBudget()}
        />
      </View>
    </View>
  );
}
