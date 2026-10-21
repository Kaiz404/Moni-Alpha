import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import {
  dueLabel,
  DueDateSheet,
} from '@/components/debt/due-date-sheet';
import { typedMinor } from '@/components/debts/typed-amount';
import {
  pickDebtWallet,
  useDebtWallets,
} from '@/components/debts/debt-wallets';
import { SIDE_WORDS } from '@/components/debts/debt-words';
import {
  editNewDebtDraft,
  resetNewDebtDraft,
  useNewDebtDraft,
} from '@/components/debts/new-debt-draft';
import { useDebtLines } from '@/components/debts/use-debts';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { PickerField } from '@/components/ui/picker-field';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { formatMoney } from '@/lib/finance/format-money';
import { approve } from '@/lib/haptics';
import {
  addDebtPrincipal,
  createDebt,
  getDebtById,
  updateDebt,
} from '@/lib/supabase/debts';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export default function NewDebtScreen() {
  const tokens = useThemeTokens();
  const currency = useMainCurrency();
  const draft = useNewDebtDraft();
  const lines = useDebtLines();
  const { wallets } = useDebtWallets(currency);
  const [dueOpen, setDueOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const closeDue = useCallback(() => setDueOpen(false), []);

  useEffect(() => {
    resetNewDebtDraft();
  }, []);

  const mine = useMemo(
    () => lines.filter((line) => line.debt.currency === currency),
    [lines, currency],
  );
  const recentPeople = useMemo(() => {
    const names: string[] = [];
    for (const line of [...mine].sort((a, b) =>
      b.lastAt.localeCompare(a.lastAt),
    ))
      if (
        !names.some((name) =>
          sameName(name, line.debt.counterpartyName),
        )
      )
        names.push(line.debt.counterpartyName);
    return names.slice(0, 3);
  }, [mine]);

  const who = draft.name.trim();
  const words = SIDE_WORDS[draft.direction];
  const existing = who
    ? mine.find(
        (line) =>
          line.state === 'open' &&
          line.debt.direction === draft.direction &&
          sameName(line.debt.counterpartyName, who),
      )
    : undefined;
  const walletId =
    draft.walletId &&
    wallets.some((wallet) => wallet.id === draft.walletId)
      ? draft.walletId
      : (wallets[0]?.id ?? null);
  const wallet = wallets.find((item) => item.id === walletId);
  const amountMinor = typedMinor(draft.amount);
  const amount = formatMoney(amountMinor, currency);
  const ready =
    who.length > 0 && amountMinor > 0 && walletId !== null;
  const walletLabel = words.principalWallet;

  const submit = async () => {
    if (!ready || !walletId) return;
    approve();
    setSaving(true);
    try {
      const note = draft.note.trim() || null;
      if (existing) {
        const stored = await getDebtById(existing.debt.id);
        if (!stored) throw new Error('This debt is gone');
        await addDebtPrincipal(stored, amountMinor, walletId, note);
        if (draft.dueDate)
          updateDebt(stored.id, { dueDate: draft.dueDate });
      } else {
        await createDebt({
          counterpartyName: who,
          direction: draft.direction,
          amountMinor,
          walletId,
          dueDate: draft.dueDate,
          note,
        });
      }
      const owed = existing
        ? formatMoney(existing.balanceMinor + amountMinor, currency)
        : amount;
      showToast({ text: words.saved(who, owed) });
      resetNewDebtDraft();
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
      <Page
        screen="debts"
        kind="pushed"
        title="Record a debt"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-[18px] px-5 pb-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-2">
            <Text className="text-[13px] leading-[18px] font-display-semibold text-foreground">
              Who
            </Text>
            <TextInput
              testID={tid('debts', 'new', 'person')}
              accessibilityLabel="Who"
              autoCapitalize="words"
              autoComplete="name"
              className="h-[52px] rounded-field bg-card px-4 font-display-semibold text-base text-foreground"
              placeholder="Name"
              placeholderTextColor={tokens.muted}
              value={draft.name}
              onChangeText={(name) => editNewDebtDraft({ name })}
              maxLength={120}
            />
            {recentPeople.length > 0 ? (
              <View
                accessibilityLabel="Recent people"
                className="flex-row flex-wrap gap-2"
              >
                {recentPeople.map((name) => (
                  <Chip
                    key={name}
                    testID={tid('debts', 'new', 'recent', name)}
                    label={name}
                    selected={sameName(name, who)}
                    onPress={() => editNewDebtDraft({ name })}
                  />
                ))}
              </View>
            ) : null}
            {existing ? (
              <View className="flex-row items-center gap-1.5">
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
          </View>

          <Segmented
            screen="debts"
            name="direction"
            accessibilityLabel="Who owes who"
            value={draft.direction}
            options={[
              {
                value: 'owed_to_me',
                label: SIDE_WORDS.owed_to_me.segment(who),
              },
              {
                value: 'i_owe',
                label: SIDE_WORDS.i_owe.segment(who),
              },
            ]}
            onChange={(direction) => editNewDebtDraft({ direction })}
          />

          <View className="gap-2">
            <Text className="text-[13px] leading-[18px] font-display-semibold text-foreground">
              Amount
            </Text>
            <Press
              testID={tid('debts', 'new', 'amount')}
              accessibilityLabel={`Amount, ${amountMinor > 0 ? amount : 'not entered'}`}
              accessibilityHint="Opens the amount page"
              radius={{ rest: 16, pressed: 16 }}
              className="h-16 flex-row items-center gap-2 bg-card pl-4 pr-3.5"
              onPress={() =>
                router.push({
                  pathname: '/debt/amount',
                  params: { mode: 'new' },
                })
              }
            >
              <Text
                className={`flex-1 font-display-bold ${amountMinor > 0 ? 'text-[32px] leading-[38px] text-foreground' : 'text-[20px] leading-[26px] text-muted'}`}
                numberOfLines={1}
              >
                {amountMinor > 0 ? amount : 'Enter amount'}
              </Text>
              <IconSymbol
                name="chevron-right"
                size={20}
                color={tokens.muted}
              />
            </Press>
          </View>

          <View className="flex-row gap-2">
            <PickerField
              testID={tid('debts', 'new', 'wallet')}
              className="flex-1"
              label={walletLabel}
              value={wallet?.name ?? ''}
              onPress={async () => {
                const picked = await pickDebtWallet(
                  walletLabel,
                  wallets,
                  walletId,
                  currency,
                );
                if (picked) editNewDebtDraft({ walletId: picked });
              }}
            />
            <PickerField
              testID={tid('debts', 'new', 'due-date')}
              className="flex-1"
              label="Due date"
              value={dueLabel(draft.dueDate)}
              onPress={() => setDueOpen(true)}
            />
          </View>

          <View className="gap-2">
            <Text className="text-[13px] leading-[18px] font-display-semibold text-foreground">
              Note
            </Text>
            <TextInput
              testID={tid('debts', 'new', 'note')}
              accessibilityLabel="Note"
              className="h-[52px] rounded-field bg-card px-4 font-display-semibold text-base text-foreground"
              placeholder="What is it for?"
              placeholderTextColor={tokens.muted}
              value={draft.note}
              onChangeText={(note) => editNewDebtDraft({ note })}
              maxLength={1000}
            />
          </View>
        </ScrollView>
        <View className="border-t-[1.5px] border-sand px-5 pb-5 pt-3">
          <Button
            testID={tid('debts', 'new', 'record')}
            pinned
            label={
              wallets.length === 0
                ? `Add a ${currency} wallet first`
                : ready
                  ? words.record(who, amount)
                  : who
                    ? 'Add an amount'
                    : 'Add who and an amount'
            }
            disabled={!ready}
            loading={saving}
            onPress={() => void submit()}
          />
        </View>
      </Page>
      <DueDateSheet
        open={dueOpen}
        selected={draft.dueDate}
        onDismiss={closeDue}
        onPick={(dueDate) => {
          setDueOpen(false);
          editNewDebtDraft({ dueDate });
        }}
      />
    </View>
  );
}
