import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useValue } from '@legendapp/state/react';

import { BrandHeader } from '@/components/ui/brand-header';
import { FeedbackState } from '@/components/ui/feedback-state';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { Surface } from '@/components/ui/surface';
import { useAuth } from '@/lib/auth/auth-context';
import { formatMinorAmount } from '@/lib/finance/money';
import { debtsWithBalance$ } from '@/lib/finance/selectors';
import { debtDueState } from '@/lib/supabase/debts';

export default function DebtsScreen() {
  const { user } = useAuth();
  const debts = useValue(debtsWithBalance$(user?.id ?? null));
  const [tab, setTab] = useState<'owed_to_me' | 'i_owe'>(
    'owed_to_me',
  );
  const shown = useMemo(
    () => debts.filter(({ debt }) => debt.direction === tab),
    [debts, tab],
  );
  const totals = useMemo(() => {
    const values = new Map<string, number>();
    for (const { debt, balanceMinor } of shown) {
      values.set(
        debt.currency,
        (values.get(debt.currency) ?? 0) + Number(balanceMinor),
      );
    }
    return [...values.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
  }, [shown]);
  const owedToMe = tab === 'owed_to_me';

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="Debts" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row gap-2">
          {(['owed_to_me', 'i_owe'] as const).map((option) => {
            const selected = tab === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`min-h-12 flex-1 justify-center rounded-2xl px-3 ${selected ? (option === 'owed_to_me' ? 'border border-primary bg-primary-muted' : 'border border-warning bg-warning/10') : 'bg-card'}`}
                onPress={() => setTab(option)}
              >
                <Text
                  className={`text-center text-[15px] font-bold ${selected && option === 'owed_to_me' ? 'text-primary' : 'text-foreground'}`}
                >
                  {option === 'owed_to_me' ? 'Owed to me' : 'I owe'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {totals.length > 0 ? (
          <Surface
            tone={owedToMe ? 'tray' : 'muted'}
            className="mt-6 p-5"
          >
            <Text
              className={`text-sm font-semibold ${owedToMe ? 'text-primary' : 'text-warning'}`}
            >
              {owedToMe ? 'You are owed' : 'You need to repay'}
            </Text>
            {totals.map(([currency, amount]) => (
              <Text
                key={currency}
                className="mt-2 text-2xl font-bold text-foreground"
              >
                {formatMinorAmount(amount, currency)}
              </Text>
            ))}
          </Surface>
        ) : null}

        {shown.length === 0 ? (
          <FeedbackState
            className="mt-10"
            icon="account-group-outline"
            title={
              owedToMe ? 'Nothing owed to you' : 'Nothing to repay'
            }
          />
        ) : (
          <View className="mt-7">
            {shown.map(({ debt, balanceMinor }) => {
              const dueState = debtDueState(
                debt,
                balanceMinor,
              ).replace('_', ' ');
              return (
                <Pressable
                  key={debt.id}
                  accessibilityRole="button"
                  className="mb-3"
                  onPress={() =>
                    router.push(`/debt/${debt.id}` as never)
                  }
                >
                  <Surface className="p-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text
                          className="text-[16px] font-bold text-foreground"
                          numberOfLines={1}
                        >
                          {debt.counterpartyName}
                        </Text>
                        <Text
                          className={`mt-1 text-sm font-semibold ${owedToMe ? 'text-primary' : 'text-warning'}`}
                        >
                          {owedToMe ? 'Owed to you' : 'You owe'} ·{' '}
                          {dueState}
                        </Text>
                        {debt.dueDate ? (
                          <Text className="mt-2 text-sm text-muted">
                            Due {debt.dueDate}
                          </Text>
                        ) : null}
                      </View>
                      <Text className="text-right text-base font-bold text-foreground">
                        {formatMinorAmount(
                          balanceMinor,
                          debt.currency,
                        )}
                      </Text>
                    </View>
                  </Surface>
                </Pressable>
              );
            })}
          </View>
        )}
        <PrimaryButton
          className="mt-8"
          icon="plus"
          label="Record debt"
          onPress={() => router.push('/debt/new' as never)}
        />
      </ScrollView>
    </ScreenShell>
  );
}
