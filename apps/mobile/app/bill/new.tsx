import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { AmountPage } from '@/components/debts/amount-page';
import { typedMinor } from '@/components/debts/typed-amount';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PickerField } from '@/components/ui/picker-field';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatDate } from '@/lib/dates/day-label';
import { parseLocalDateInput, toLocalDateInput } from '@/lib/dates/local-date-input';
import { currencySymbol, formatMoney } from '@/lib/finance/format-money';
import { useMainCurrency } from '@/lib/finance/main-currency';
import { openSheet } from '@/lib/sheet/sheet-store';
import { addBill, billSeriesKey } from '@/lib/supabase/recurring-overrides';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

type Often = 'monthly' | 'once';

const OFTEN = [
  { value: 'monthly', label: 'Every month' },
  { value: 'once', label: 'Just once' },
] as const;

const CHIPS = ['10', '50', '100'];

/** "Add a bill" on the amount page (`V2P-AmountPage`, New bill): new money gets the keypad. */
export default function NewBillScreen() {
  const tokens = useThemeTokens();
  const currency = useMainCurrency();
  const [often, setOften] = useState<Often>('monthly');
  const [typed, setTyped] = useState('');
  const [chipped, setChipped] = useState(false);
  const [name, setName] = useState('');
  const [due, setDue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amountMinor = typedMinor(typed);
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

  const pickDue = async () => {
    const picked = await openSheet({ kind: 'date', selected: due ?? toLocalDateInput(new Date()) });
    if (picked) setDue(picked);
  };
  const submit = async () => {
    if (!ready || !due) return;
    setSaving(true);
    try {
      await addBill({ name, amountMinor, currency, dueDate: due, once: often === 'once' });
      showToast({ text: `${name.trim()} added to bills` });
      router.back();
    } catch (error) {
      showToast({
        text: error instanceof Error ? error.message : "Couldn't add the bill.",
        tone: 'removed',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AmountPage
      title="New bill"
      currency={currency}
      typed={typed}
      prefilled={chipped}
      onType={(next) => {
        setChipped(false);
        setTyped(next);
      }}
      sentence={
        amountMinor > 0
          ? `${formatMoney(amountMinor, currency)} ${often === 'monthly' ? 'every month' : 'one time'}, on the due date`
          : 'How much is it each time?'
      }
      top={
        <Segmented
          screen="budget"
          name="bill-often"
          options={OFTEN}
          value={often}
          onChange={setOften}
          accessibilityLabel="How often"
        />
      }
      fields={
        <View className="gap-3">
          <View className="flex-row gap-2">
            <View className="h-16 flex-1 justify-center rounded-field bg-sand px-3.5">
              <Text className="text-[13px] leading-[18px] text-muted">Bill name</Text>
              <TextInput
                testID={tid('budget', 'bill-new', 'name')}
                accessibilityLabel="Bill name"
                value={name}
                onChangeText={(text) => setName(text.slice(0, 30))}
                placeholder="e.g. Unifi fibre"
                placeholderTextColor={tokens.muted}
                autoCapitalize="words"
                returnKeyType="done"
                className="p-0 font-display-semibold text-[16px] leading-[22px] text-foreground"
              />
            </View>
            <PickerField
              testID={tid('budget', 'bill-new', 'due')}
              label="Due"
              value={due ? formatDate(parseLocalDateInput(due) ?? new Date()) : ''}
              className="flex-1"
              leading={
                <IconSymbol
                  name="calendar-blank"
                  size={18}
                  color={due ? tokens.foreground : tokens.muted}
                />
              }
              onPress={pickDue}
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
      }
      action={{ label, disabled: !ready, onPress: submit }}
    />
  );
}
