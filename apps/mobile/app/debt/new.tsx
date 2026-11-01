import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Keyboard, View } from 'react-native';

import { AmountPage } from '@/components/amount/amount-page';
import { TextTile } from '@/components/amount/text-tile';
import { FieldBubble, WalletBubble } from '@/components/capture/field-bubble';
import {
  dueLabel,
  DueDateSheet,
} from '@/components/debt/due-date-sheet';
import {
  pickDebtWallet,
  useDebtWallets,
} from '@/components/debts/debt-wallets';
import { SIDE_WORDS } from '@/components/debts/debt-words';
import { pastPeople, sameName } from '@/components/debts/past-people';
import { useDebtLines } from '@/components/debts/use-debts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PickerField } from '@/components/ui/picker-field';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { readAmount } from '@/lib/amount/amount-input';
import type { DebtSide } from '@/lib/finance/debt-summary';
import { formatMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { approve } from '@/lib/haptics';
import { openSheet } from '@/lib/sheet/sheet-store';
import {
  addDebtPrincipal,
  createDebt,
  getDebtById,
  updateDebt,
} from '@/lib/supabase/debts';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import { compactWalletNames } from '@/lib/wallets/compact-name';

const DIRECTIONS = ['owed_to_me', 'i_owe'] as const;

export default function NewDebtScreen() {
  const tokens = useThemeTokens();
  const currency = useMainCurrency();
  const lines = useDebtLines();
  const { wallets } = useDebtWallets(currency);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<DebtSide>('owed_to_me');
  const [typed, setTyped] = useState('');
  const [chosenWalletId, setChosenWalletId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [dueOpen, setDueOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const closeDue = useCallback(() => setDueOpen(false), []);

  const mine = useMemo(
    () => lines.filter((line) => line.debt.currency === currency),
    [lines, currency],
  );

  const who = name.trim();
  const words = SIDE_WORDS[direction];
  const existing = who
    ? mine.find(
        (line) =>
          line.state === 'open' &&
          line.debt.direction === direction &&
          sameName(line.debt.counterpartyName, who),
      )
    : undefined;
  const wallet =
    wallets.find((item) => item.id === chosenWalletId) ?? wallets[0] ?? null;
  const walletId = wallet?.id ?? null;
  const amountMinor = readAmount(typed).minor;
  const amount = formatMoney(amountMinor, currency);
  const ready = who.length > 0 && amountMinor > 0 && walletId !== null;
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
    if (!ready || !walletId) return;
    approve();
    setSaving(true);
    try {
      const saidNote = note.trim() || null;
      if (existing) {
        const stored = await getDebtById(existing.debt.id);
        if (!stored) throw new Error('This debt is gone');
        await addDebtPrincipal(stored, amountMinor, walletId, saidNote);
        if (dueDate) updateDebt(stored.id, { dueDate });
      } else {
        await createDebt({
          counterpartyName: who,
          direction,
          amountMinor,
          walletId,
          dueDate,
          note: saidNote,
        });
      }
      const owed = existing
        ? formatMoney(existing.balanceMinor + amountMinor, currency)
        : amount;
      showToast({ text: words.saved(who, owed) });
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
            ? words.record(who, amount)
            : wallets.length === 0
              ? `Add a ${currency} wallet first`
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
        {existing ? (
          <View className="flex-row items-center gap-1.5 px-1.5">
            <IconSymbol
              name="information-outline"
              size={16}
              color={tokens.states.pending}
            />
            <Text
              variant="meta"
              className="flex-1 text-state-pending"
            >
              {words.existing(
                existing.debt.counterpartyName,
                formatMoney(existing.balanceMinor, currency),
              )}
            </Text>
          </View>
        ) : null}
        <View className="flex-row gap-2">
          <PickerField
            testID={tid('debts', 'new', 'wallet')}
            size="capture"
            className="flex-1"
            label={walletLabel}
            value={wallet ? compactWalletNames(wallets)[wallet.id] : ''}
            spokenValue={wallet?.name}
            leading={wallet ? <WalletBubble wallet={wallet} /> : undefined}
            onPress={async () => {
              const picked = await pickDebtWallet(
                walletLabel,
                wallets,
                walletId,
                currency,
              );
              if (picked) setChosenWalletId(picked);
            }}
          />
          <PickerField
            testID={tid('debts', 'new', 'due-date')}
            size="capture"
            className="flex-1"
            label="Due date"
            value={dueLabel(dueDate)}
            leading={
              <FieldBubble color={tokens.card}>
                <IconSymbol
                  name="calendar-clock"
                  size={17}
                  color={tokens.foreground}
                />
              </FieldBubble>
            }
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
