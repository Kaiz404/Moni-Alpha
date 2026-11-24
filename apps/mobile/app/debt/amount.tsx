import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AmountPage } from '@/components/amount/amount-page';
import { TextTile } from '@/components/amount/text-tile';
import { DebtWalletField } from '@/components/debts/debt-wallet-field';
import {
  type DebtWalletChoice,
  NO_WALLET,
  useDebtWallets,
} from '@/components/debts/debt-wallets';
import { SIDE_WORDS } from '@/components/debts/debt-words';
import { useDebt } from '@/components/debts/use-debts';
import { Chip } from '@/components/ui/chip';
import { NotFound } from '@/components/ui/empty-tile';
import { Page } from '@/components/ui/page';
import { Segmented } from '@/components/ui/segmented';
import { showToast } from '@/lib/toast/toast-store';
import { approve } from '@/lib/haptics';
import {
  addDebtPrincipal,
  deleteDebtActivity,
  getDebtById,
  repayDebt,
} from '@/lib/supabase/debts';
import { readAmount } from '@/lib/amount/amount-input';
import { tid } from '@/lib/test-ids';
import { minorToDecimal } from '@repo/types';
import { type DebtLine, type FinanceDebtActivity, formatMoney } from '@repo/core';

type Mode = 'repay' | 'more';

export default function DebtAmountScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    mode?: string;
  }>();
  return (
    <DebtMoney
      id={params.id}
      initial={params.mode === 'more' ? 'more' : 'repay'}
    />
  );
}

function DebtMoney({ id, initial }: { id?: string; initial: Mode }) {
  const { line, activities } = useDebt(id);
  if (!line)
    return (
      <Page
        screen="debts"
        kind="pushed"
        title="Debt"
      >
        <NotFound
          icon="handshake-outline"
          title="This debt isn't here any more"
          body="It may have been deleted on another phone."
        />
      </Page>
    );
  return (
    <DebtMoneyForm
      line={line}
      activities={activities}
      initial={initial}
    />
  );
}

function DebtMoneyForm({
  line,
  activities,
  initial,
}: {
  line: DebtLine;
  activities: FinanceDebtActivity[];
  initial: Mode;
}) {
  const { debt, balanceMinor } = line;
  const { counterpartyName: name, direction, currency } = debt;
  const words = SIDE_WORDS[direction];
  const { wallets, balances } = useDebtWallets(currency);
  const usual = activities.find((activity) =>
    wallets.some((wallet) => wallet.id === activity.walletId),
  )?.walletId;
  const [mode, setMode] = useState<Mode>(
    initial === 'repay' && balanceMinor > 0 ? 'repay' : 'more',
  );
  const [typed, setTyped] = useState(
    mode === 'repay' ? minorToDecimal(balanceMinor) : '',
  );
  const [prefilled, setPrefilled] = useState(mode === 'repay');
  const suggest = (minor: number) => {
    setTyped(minor > 0 ? minorToDecimal(minor) : '');
    setPrefilled(minor > 0);
  };
  const [chosen, setChosen] = useState<DebtWalletChoice>(null);
  const noted = line.noted && !usual;
  const choice: DebtWalletChoice =
    (chosen === NO_WALLET || wallets.some((item) => item.id === chosen)
      ? chosen
      : null) ??
    usual ??
    (noted ? null : (wallets[0]?.id ?? null));
  const walletId = choice === NO_WALLET ? null : choice;
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const amountMinor = readAmount(typed).minor;
  const money = (minor: number) => formatMoney(minor, currency);
  const repay = mode === 'repay';
  const over = repay && amountMinor > balanceMinor;
  const after = repay
    ? balanceMinor - amountMinor
    : balanceMinor + amountMinor;
  const sentence =
    amountMinor <= 0
      ? 'How much?'
      : over
        ? `That's more than the ${money(balanceMinor)} left`
        : repay && after === 0
          ? words.settles(name)
          : repay
            ? words.stillOwes(name, money(after))
            : words.owesAfter(name, money(after));

  const wallet = wallets.find((item) => item.id === walletId) ?? null;
  const leaves = repay
    ? !words.principalLeaves
    : words.principalLeaves;
  const walletAfter =
    wallet && amountMinor > 0
      ? (balances[wallet.id] ?? 0) +
        (leaves ? -amountMinor : amountMinor)
      : null;
  const walletLabel = repay
    ? words.repayWallet
    : words.principalWallet;
  const verb = repay ? words.repayVerb : words.moreVerb;

  const chips = repay
    ? [
        { label: `All ${money(balanceMinor)}`, minor: balanceMinor },
        {
          label: `Half ${money(Math.floor(balanceMinor / 2))}`,
          minor: Math.floor(balanceMinor / 2),
        },
      ]
    : [5000, 10000].map((minor) => ({
        label: formatMoney(minor, currency, { whole: true }),
        minor,
      }));

  const save = async () => {
    if (!choice || amountMinor <= 0 || over) return;
    approve();
    setSaving(true);
    try {
      const stored = await getDebtById(debt.id);
      if (!stored) throw new Error('This debt is gone');
      const activity = repay
        ? await repayDebt(stored, amountMinor, walletId, note || null)
        : await addDebtPrincipal(
            stored,
            amountMinor,
            walletId,
            note || null,
          );
      showToast({
        text: `Recorded ${money(amountMinor)}`,
        undo: () => void deleteDebtActivity(stored, activity.id),
      });
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

  const fields = (
    <View className="gap-3">
      <View className="flex-row gap-2">
        <DebtWalletField
          testID={tid('debts', 'amount', 'wallet')}
          label={walletLabel}
          noneLabel={repay ? words.repayNone : words.principalNone}
          wallets={wallets}
          choice={choice}
          onChoose={setChosen}
        />
        <View className="flex-1">
          <TextTile
            testID={tid('debts', 'amount', 'note')}
            label="Note"
            icon="note-text-outline"
            placeholder={debt.note ?? 'What for?'}
            value={note}
            onChangeText={setNote}
            maxLength={1000}
          />
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {chips.map((chip) => (
          <Chip
            key={chip.label}
            testID={tid('debts', 'amount', 'chip', chip.minor)}
            label={chip.label}
            onPress={() => suggest(chip.minor)}
          />
        ))}
      </View>
    </View>
  );

  return (
    <AmountPage
      screen="debts"
      header="pushed"
      direction="plain"
      title={repay ? words.repayTitle(name) : words.moreTitle(name)}
      currency={currency}
      typed={typed}
      prefilled={prefilled}
      onTyped={(next) => {
        setTyped(next);
        setPrefilled(false);
      }}
      sentence={{ text: sentence, tone: over ? 'over' : 'plain' }}
      control={
        balanceMinor > 0 ? (
          <Segmented
            screen="debts"
            name="amount-mode"
            accessibilityLabel="What happened"
            value={mode}
            options={
              direction === 'i_owe'
                ? [
                    { value: 'repay', label: 'Pay back' },
                    { value: 'more', label: words.more },
                  ]
                : [
                    { value: 'more', label: words.more },
                    { value: 'repay', label: 'Paid back' },
                  ]
            }
            onChange={(next) => {
              setMode(next);
              suggest(next === 'repay' ? balanceMinor : 0);
            }}
          />
        ) : null
      }
      hint={
        walletAfter !== null && wallet
          ? `${money(walletAfter)} ${leaves ? 'left in' : 'in'} ${wallet.name} after this`
          : undefined
      }
      action={{
        label:
          amountMinor <= 0 || over
            ? 'Add an amount'
            : choice
              ? `${verb} ${money(amountMinor)}`
              : 'Choose where it went',
        disabled: saving || !choice || amountMinor <= 0 || over,
        onPress: () => void save(),
      }}
    >
      {fields}
    </AmountPage>
  );
}
