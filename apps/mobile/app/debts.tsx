import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useValue } from '@legendapp/state/react';
import { BrandHeader } from '@/components/ui/brand-header';
import { FinanceState } from '@/components/finance/finance-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMinorAmount } from '@/lib/finance/money';
import { debtsWithBalance$ } from '@/lib/finance/selectors';
import { debtDueState } from '@/lib/supabase/debts';

export default function DebtsScreen() {
  const { user } = useAuth();
  const debts = useValue(debtsWithBalance$(user?.id ?? null));
  const [tab, setTab] = useState<'owed_to_me' | 'i_owe'>('owed_to_me');
  const shown = useMemo(() => debts.filter(({ debt }) => debt.direction === tab), [debts, tab]);
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const { debt, balanceMinor } of shown) map.set(debt.currency, (map.get(debt.currency) ?? 0) + Number(balanceMinor));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [shown]);

  return (
    <ScreenShell>
      <BrandHeader title="Debts" />
      <ScrollView className="flex-1 bg-background" contentContainerClassName="p-4">
        <View className="mb-4 flex-row gap-2">
          {(['owed_to_me', 'i_owe'] as const).map((value) => (
            <Pressable key={value} className={`flex-1 rounded-xl px-3 py-2.5 ${tab === value ? 'bg-primary' : 'border border-border bg-card'}`} onPress={() => setTab(value)}>
              <Text className={`text-center font-semibold ${tab === value ? 'text-white' : 'text-foreground'}`}>{value === 'owed_to_me' ? 'Owed to me' : 'I owe'}</Text>
            </Pressable>
          ))}
        </View>
        {totals.map(([currency, amountMinor]) => <Text key={currency} className="mb-2 text-lg font-bold text-foreground">{formatMinorAmount(amountMinor, currency)} outstanding</Text>)}
        {shown.length === 0 ? (
          <View className="mt-12"><FinanceState title="No debts here" detail="Track money you lend or borrow without affecting spending categories." /></View>
        ) : shown.map(({ debt, balanceMinor }) => (
          <Pressable key={debt.id} className="mb-2 rounded-2xl border border-border bg-card p-4" onPress={() => router.push(`/debt/${debt.id}` as any)}>
            <View className="flex-row justify-between"><Text className="text-base font-bold text-foreground">{debt.counterpartyName}</Text><Text className="font-bold text-foreground">{formatMinorAmount(balanceMinor, debt.currency)}</Text></View>
            <Text className="mt-1 text-sm text-muted">{debtDueState(debt, balanceMinor).replace('_', ' ')}</Text>
            {debt.dueDate ? <Text className="mt-1 text-xs text-muted">Due {debt.dueDate}</Text> : null}
          </Pressable>
        ))}
        <View className="mt-4"><PrimaryButton label="Record debt" icon="add" onPress={() => router.push('/debt/new' as any)} /></View>
      </ScrollView>
    </ScreenShell>
  );
}
