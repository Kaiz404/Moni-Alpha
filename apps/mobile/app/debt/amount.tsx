import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { typedMinor } from '@/components/debts/typed-amount';
import { AmountPage } from '@/components/debts/amount-page';
import {
  pickDebtWallet,
  useDebtWallets,
} from '@/components/debts/debt-wallets';
import { SIDE_WORDS } from '@/components/debts/debt-words';
import {
  editNewDebtDraft,
  useNewDebtDraft,
} from '@/components/debts/new-debt-draft';
import { useDebt } from '@/components/debts/use-debts';
import { Chip } from '@/components/ui/chip';
import { NotFound } from '@/components/ui/empty-tile';
import { Page } from '@/components/ui/page';
import { PickerField } from '@/components/ui/picker-field';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { showToast } from '@/lib/toast/toast-store';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useMainCurrency } from '@/lib/finance/main-currency';
import type { DebtLine } from '@/lib/finance/debt-summary';
import { formatMoney } from '@/lib/finance/format-money';
import type { FinanceDebtActivity } from '@/lib/finance/types';
import { approve } from '@/lib/haptics';
import {
  addDebtPrincipal,
  deleteDebtActivity,
  getDebtById,
  repayDebt,
} from '@/lib/supabase/debts';
import { tid } from '@/lib/test-ids';
import { minorToDecimal } from '@repo/types';

type Mode = 'repay' | 'more';

export default function DebtAmountScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    mode?: string;
  }>();
  if (params.mode === 'new') return <NewDebtAmount />;
  return (
    <DebtMoney
      id={params.id}
      initial={params.mode === 'more' ? 'more' : 'repay'}
    />
  );
}

/** Record a debt hands its amount here and takes it back on Done. */
function NewDebtAmount() {
  const draft = useNewDebtDraft();
  const currency = useMainCurrency();
  const [typed, setTyped] = useState(draft.amount);
  const amountMinor = typedMinor(typed);
  const name = draft.name.trim() || 'They';
  const words = SIDE_WORDS[draft.direction];
  return (
    <AmountPage
      title="Amount"
      currency={currency}
      typed={typed}
      onType={setTyped}
      sentence={
        amountMinor > 0
          ? words.owesAfter(name, formatMoney(amountMinor, currency))
          : 'How much?'
      }
      action={{
        label: 'Done',
        disabled: amountMinor <= 0,
        onPress: () => {
          editNewDebtDraft({ amount: typed });
          router.back();
        },
      }}
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
  const tokens = useThemeTokens();
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
  const [walletId, setWalletId] = useState(
    usual ?? wallets[0]?.id ?? null,
  );
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const amountMinor = typedMinor(typed);
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
    if (!walletId || amountMinor <= 0 || over) return;
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

  return (
    <AmountPage
      title={repay ? words.repayTitle(name) : words.moreTitle(name)}
      currency={currency}
      typed={typed}
      prefilled={prefilled}
      onType={(next) => {
        setTyped(next);
        setPrefilled(false);
      }}
      sentence={sentence}
      over={over}
      top={
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
      fields={
        <View className="gap-3">
          <View className="flex-row gap-2">
            <PickerField
              testID={tid('debts', 'amount', 'wallet')}
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
                if (picked) setWalletId(picked);
              }}
            />
            <View className="h-16 flex-1 justify-center rounded-field bg-sand px-3.5">
              <Text className="text-[13px] leading-[18px] text-muted">
                Note
              </Text>
              <TextInput
                testID={tid('debts', 'amount', 'note')}
                accessibilityLabel="Note"
                className="h-[22px] p-0 font-display-semibold text-base text-foreground"
                placeholder={debt.note ?? 'What for?'}
                placeholderTextColor={tokens.muted}
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
      }
      hint={
        walletAfter !== null && wallet
          ? `${money(walletAfter)} ${leaves ? 'left in' : 'in'} ${wallet.name} after this`
          : wallets.length === 0
            ? `Add a ${currency} wallet first.`
            : undefined
      }
      action={{
        label:
          amountMinor > 0 && !over
            ? `${verb} ${money(amountMinor)}`
            : 'Add an amount',
        disabled: saving || !walletId || amountMinor <= 0 || over,
        onPress: () => void save(),
      }}
    />
  );
}
