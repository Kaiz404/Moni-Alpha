import { useValue } from '@legendapp/state/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DueDaySheet } from '@/components/budget/due-day-sheet';
import { AmountPage } from '@/components/amount/amount-page';
import { TextTile } from '@/components/amount/text-tile';
import { PickerField } from '@/components/ui/picker-field';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth/auth-context';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { transactionById$ } from '@/lib/finance/selectors';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { readAmount } from '@/lib/amount/amount-input';
import { addBill } from '@/lib/supabase/recurring-overrides';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';
import {
  billDueFrom,
  billSeriesKey,
  currencySymbol,
  dateLabel,
  formatMoney,
  merchantName,
  parseDayKey,
  seriesKey,
  type FinanceTransaction,
} from '@repo/core';
import { minorToDecimal, type CurrencyCode } from '@repo/types';
import { deviceCalendar } from '@/lib/dates/device-calendar';

type Often = 'monthly' | 'once';

const OFTEN = [
  { value: 'monthly', label: 'Every month' },
  { value: 'once', label: 'Just once' },
] as const;

const CHIPS = ['10', '50', '100'];

type Prefill = {
  name: string;
  typed: string;
  currency: CurrencyCode;
  due: string;
  from: { seriesKey: string; walletId: string; categoryId: string | null };
};

/** A transaction's Make it a bill (#136): its merchant, amount, wallet and category, due on its day. */
function prefillFrom(tx: FinanceTransaction, name: string): Prefill | null {
  const key = seriesKey(tx);
  if (!key || tx.type !== 'expense') return null;
  return {
    name: name.slice(0, 30),
    typed: minorToDecimal(tx.amountMinor),
    currency: tx.currency,
    due: billDueFrom(deviceCalendar.dayKey(tx.transactionDate), deviceCalendar.dayKey(new Date())),
    from: { seriesKey: key, walletId: tx.walletId, categoryId: tx.categoryId },
  };
}

/**
 * "Add a bill" on the amount page (`V2P-AmountPage`, New bill): new money gets the keypad. With
 * `from`, a transaction's id, the form opens filled from that payment.
 */
export default function NewBillScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { user } = useAuth();
  const tx = useValue(transactionById$(from ?? ''));
  const aliases = useValue(() => (user?.id ? listMerchantAliases(user.id) : []));
  const prefill = tx ? prefillFrom(tx, merchantName(tx.merchant, aliases) ?? tx.merchant ?? '') : null;
  return (
    <BillForm
      key={prefill ? tx?.id : 'new'}
      prefill={prefill}
    />
  );
}

function BillForm({ prefill }: { prefill: Prefill | null }) {
  const mainCurrency = useMainCurrency();
  const currency = prefill?.currency ?? mainCurrency;
  const [often, setOften] = useState<Often>('monthly');
  const [typed, setTyped] = useState(prefill?.typed ?? '');
  const [chipped, setChipped] = useState(!!prefill);
  const [name, setName] = useState(prefill?.name ?? '');
  const [due, setDue] = useState<string | null>(prefill?.due ?? null);
  const [saving, setSaving] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);

  const amountMinor = readAmount(typed).minor;
  const named = billSeriesKey(name, currency) !== null;
  const ready = amountMinor > 0 && named && due !== null && !saving;
  const label =
    amountMinor <= 0
      ? 'Add an amount'
      : !named
        ? 'Name the bill'
        : !due
          ? 'Pick a due date'
          : `Add bill ${formatMoney(amountMinor, currency)}`;

  const submit = async () => {
    if (!ready || !due) return;
    setSaving(true);
    try {
      await addBill({
        name,
        amountMinor,
        currency,
        dueDate: due,
        once: often === 'once',
        from: prefill?.from,
      });
      showToast({ text: `${name.trim()} added to bills` });
      router.back();
    } catch (error) {
      showToast({
        text:
          error instanceof Error
            ? error.message
            : "Couldn't add the bill.",
        tone: 'removed',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1">
      <AmountPage
        screen="budget"
        header="pushed"
        direction="plain"
        title="New bill"
        currency={currency}
        typed={typed}
        prefilled={chipped}
        onTyped={(next) => {
          setChipped(false);
          setTyped(next);
        }}
        sentence={{
          text:
            amountMinor > 0
              ? `${formatMoney(amountMinor, currency)} ${often === 'monthly' ? 'every month' : 'one time'}, on the due date`
              : 'How much is it each time?',
          tone: 'plain',
        }}
        control={
          <Segmented
            screen="budget"
            name="bill-often"
            options={OFTEN}
            value={often}
            onChange={setOften}
            accessibilityLabel="How often"
          />
        }
        action={{ label, disabled: !ready, onPress: submit }}
      >
        <View className="gap-3">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <TextTile
                testID={tid('budget', 'bill-new', 'name')}
                label="Bill name"
                icon="repeat"
                value={name}
                onChangeText={(text) => setName(text.slice(0, 30))}
                placeholder="e.g. Unifi fibre"
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
            <PickerField
              testID={tid('budget', 'bill-new', 'due')}
              label="Due"
              value={
                due
                  ? dateLabel(
                      parseDayKey(due) ??
                        deviceCalendar.dayKey(new Date()),
                      deviceCalendar.dayKey(new Date()),
                    )
                  : ''
              }
              className="flex-1"
              icon="calendar"
              onPress={() => setDueOpen(true)}
            />
          </View>
          <View className="flex-row gap-2">
            {CHIPS.map((chip) => (
              <Press
                key={chip}
                testID={tid('budget', 'bill-new', 'chip', chip)}
                accessibilityLabel={`${currencySymbol(currency)}${chip}`}
                radius={{ rest: 18, pressed: 14 }}
                pressedClassName="bg-hairline"
                className="h-9 justify-center bg-sand px-3.5"
                onPress={() => {
                  setTyped(`${chip}.00`);
                  setChipped(true);
                }}
              >
                <Text className="text-[14px] font-display-semibold text-foreground">
                  {`${currencySymbol(currency)}${chip}`}
                </Text>
              </Press>
            ))}
          </View>
        </View>
      </AmountPage>
      <DueDaySheet
        open={dueOpen}
        selected={due}
        monthly={often === 'monthly'}
        onPick={(picked) => {
          setDue(picked);
          setDueOpen(false);
        }}
        onDismiss={() => setDueOpen(false)}
      />
    </View>
  );
}
