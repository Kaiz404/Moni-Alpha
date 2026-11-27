import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Keyboard, View } from 'react-native';

import { AmountPage } from '@/components/amount/amount-page';
import { TextTile } from '@/components/amount/text-tile';
import {
  dueLabel,
  DueDateSheet,
} from '@/components/debt/due-date-sheet';
import { DebtWalletField } from '@/components/debts/debt-wallet-field';
import {
  type DebtWalletChoice,
  NO_WALLET,
  useDebtWallets,
} from '@/components/debts/debt-wallets';
import { SIDE_WORDS } from '@/components/debts/debt-words';
import { pastPeople } from '@/components/debts/past-people';
import { useDebtLines } from '@/components/debts/use-debts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PickerField } from '@/components/ui/picker-field';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { readAmount } from '@/lib/amount/amount-input';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { approve } from '@/lib/haptics';
import { openSheet } from '@/lib/sheet/sheet-store';
import { createDebt } from '@/lib/supabase/debts';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { type DebtSide, formatMoney } from '@repo/core';

const DIRECTIONS = ['owed_to_me', 'i_owe'] as const;

export default function NewDebtScreen() {
  const tokens = useThemeTokens();
  const currency = useMainCurrency();
  const lines = useDebtLines();
  const { wallets } = useDebtWallets(currency);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<DebtSide>('owed_to_me');
  const [typed, setTyped] = useState('');
  const [chosen, setChosen] = useState<DebtWalletChoice>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [dueOpen, setDueOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const closeDue = useCallback(() => setDueOpen(false), []);

  const who = name.trim();
  const words = SIDE_WORDS[direction];
  const choice =
    (chosen === NO_WALLET || wallets.some((item) => item.id === chosen)
      ? chosen
      : null) ?? NO_WALLET;
  const walletId = choice === NO_WALLET ? null : choice;
  const amountMinor = readAmount(typed).minor;
  const amount = formatMoney(amountMinor, currency);
  const ready = who.length > 0 && amountMinor > 0;
  const walletLabel = words.principalWallet;
  const people = pastPeople(lines, direction);

  const pickPerson = async () => {
    Keyboard.dismiss();
    const picked = await openSheet({
      kind: 'person',
      title: words.pastPeople,
      people,
      selected: who,
    });
    if (picked) setName(picked);
  };

  const submit = async () => {
    if (!ready) return;
    approve();
    setSaving(true);
    try {
      await createDebt({
        counterpartyName: who,
        direction,
        amountMinor,
        walletId,
        currency,
        dueDate,
        note: note.trim() || null,
      });
      showToast({ text: words.saved(who, amount) });
      router.back();
    } catch (error) {
      setSaving(false);
      showToast({
        text:
          error instanceof Error
            ? error.message
            : "Couldn't save that",
        tone: 'removed',
      });
    }
  };

  return (
    <View className="flex-1">
      <AmountPage
        screen="debts"
        header="pushed"
        direction="plain"
        title="Record a debt"
        currency={currency}
        typed={typed}
        onTyped={setTyped}
        control={
          <Segmented
            screen="debts"
            name="direction"
            accessibilityLabel="Who owes who"
            options={DIRECTIONS.map((side) => ({
              value: side,
              label: SIDE_WORDS[side].segment,
            }))}
            value={direction}
            onChange={setDirection}
          />
        }
        action={{
          label: ready
            ? 'Record'
            : who
                ? 'Add an amount'
                : 'Add who and an amount',
          disabled: !ready,
          loading: saving,
          onPress: () => void submit(),
        }}
      >
        <TextTile
          testID={tid('debts', 'new', 'person')}
          label="Who"
          icon="account-outline"
          autoCapitalize="words"
          autoComplete="name"
          placeholder="Name"
          value={name}
          onChangeText={setName}
          maxLength={120}
          trailing={
            people.length > 0 ? (
              <Press
                testID={tid('debts', 'new', 'people')}
                accessibilityLabel={`Choose from ${words.pastPeople.toLowerCase()}`}
                onPress={() => void pickPerson()}
                pressedClassName="bg-hairline"
                className="-mr-1 h-11 w-11 items-center justify-center rounded-full bg-card"
              >
                <IconSymbol
                  name="account-multiple-outline"
                  size={20}
                  color={tokens.foreground}
                />
              </Press>
            ) : null
          }
        />
        <View className="flex-row gap-2">
          <DebtWalletField
            testID={tid('debts', 'new', 'wallet')}
            label={walletLabel}
            noneLabel={words.principalNone}
            wallets={wallets}
            choice={choice}
            onChoose={setChosen}
          />
          <PickerField
            testID={tid('debts', 'new', 'due-date')}
            className="flex-1"
            label="Due date"
            value={dueLabel(dueDate)}
            icon="calendar-clock"
            onPress={() => setDueOpen(true)}
          />
        </View>
        <TextTile
          testID={tid('debts', 'new', 'note')}
          label="Note"
          icon="pencil-outline"
          placeholder="What is it for?"
          value={note}
          onChangeText={setNote}
          maxLength={1000}
        />
      </AmountPage>
      <DueDateSheet
        open={dueOpen}
        selected={dueDate}
        onDismiss={closeDue}
        onPick={(picked) => {
          setDueOpen(false);
          setDueDate(picked);
        }}
      />
    </View>
  );
}
