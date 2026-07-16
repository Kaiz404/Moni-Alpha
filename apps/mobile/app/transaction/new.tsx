import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { useAuth } from '@/lib/auth/auth-context';
import { BrandHeader } from '@/components/ui/brand-header';
import { ScreenShell } from '@/components/ui/screen-shell';
import { chipClass, chipTextClass } from '@/components/ui/chip';
import { PrimaryButton } from '@/components/ui/primary-button';
import { NumericKeypad } from '@/components/ui/numeric-keypad';
import { createTransaction, createTransfer } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { getCategories } from '@/lib/supabase/categories';
import { createTransactionSchema } from '@repo/types';
import { getDraftExtras, hasDraftExtras, resetDraftExtras } from '@/lib/transactions/draft-extras';

const QUICK_AMOUNTS = [10, 20, 50, 100, 500];
const MAX_AMOUNT_LENGTH = 12;

export default function NewTransactionScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ walletId?: string | string[] }>();
  const paramWalletId = useMemo(() => {
    const w = params.walletId;
    return Array.isArray(w) ? w[0] : w;
  }, [params.walletId]);

  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [walletId, setWalletId] = useState('');
  const [transferToWalletId, setTransferToWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [extras, setExtras] = useState(getDraftExtras());

  useEffect(() => {
    resetDraftExtras();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setExtras(getDraftExtras());
    }, []),
  );

  useEffect(() => {
    if (!user) return;
    getWallets().then(setWallets);
    if (type !== 'transfer') {
      getCategories(type).then(setCategories);
    }
  }, [user, type]);

  useEffect(() => {
    if (wallets.length === 0) return;
    if (paramWalletId && wallets.some((w) => w.id === paramWalletId)) {
      setWalletId(paramWalletId);
    } else {
      setWalletId((current) => current || wallets[0].id);
    }
    setTransferToWalletId((current) => {
      if (current) return current;
      const other = wallets.find((w) => w.id !== (paramWalletId ?? wallets[0].id));
      return other?.id ?? current;
    });
  }, [wallets, paramWalletId]);

  const destinationWallets = useMemo(() => wallets.filter((w) => w.id !== walletId), [wallets, walletId]);
  const selectedWallet = wallets.find((w) => w.id === walletId);
  const currencySymbol = selectedWallet?.currency ?? 'USD';

  const handleKeyPress = useCallback((key: string) => {
    setAmount((prev) => {
      if (key === '⌫') return prev.slice(0, -1);
      if (key === '.' && prev.includes('.')) return prev;
      if (prev.length >= MAX_AMOUNT_LENGTH) return prev;
      if (key === '.' && prev.length === 0) return '0.';
      return prev + key;
    });
  }, []);

  const handleOpenDetails = useCallback(() => {
    router.push({
      pathname: '/transaction/new-details',
      params: { type },
    } as any);
  }, [type]);

  const handleSubmit = async () => {
    if (!user || !walletId) return;

    const parsedAmount = parseFloat(amount) || 0;
    if (parsedAmount <= 0) {
      Alert.alert('Error', 'Enter a valid positive amount.');
      return;
    }

    setLoading(true);
    try {
      if (type === 'transfer') {
        if (!transferToWalletId) {
          Alert.alert('Error', 'Select a destination wallet.');
          return;
        }
        await createTransfer({
          fromWalletId: walletId,
          toWalletId: transferToWalletId,
          amount: parsedAmount,
          description: extras.description.trim() || null,
        });
      } else {
        const locationPayload = extras.locationSnapshot
          ? {
              locationLatitude: extras.locationSnapshot.latitude,
              locationLongitude: extras.locationSnapshot.longitude,
              locationName: extras.locationSnapshot.name,
            }
          : {};

        const parsed = createTransactionSchema.safeParse({
          walletId,
          amount: parsedAmount,
          type,
          categoryId: categoryId || null,
          merchant: extras.merchant.trim() || null,
          description: extras.description.trim() || null,
          transactionDate: new Date().toISOString(),
          ...locationPayload,
        });
        if (!parsed.success) {
          Alert.alert('Error', parsed.error.errors[0]?.message ?? 'Invalid input');
          return;
        }
        await createTransaction(parsed.data);
      }
      resetDraftExtras();
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create transaction');
    } finally {
      setLoading(false);
    }
  };

  const actionLabel = type === 'income' ? 'Add income' : type === 'transfer' ? 'Add transfer' : 'Add expense';
  const detailsAdded = hasDraftExtras(extras);

  return (
    <ScreenShell variant="canvas">
      <BrandHeader title="New Transaction" />

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-4 pt-4 pb-2"
        showsVerticalScrollIndicator={false}>
        <View className="mb-4 flex-row gap-1.5">
          {(['expense', 'income', 'transfer'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              className={`${chipClass(type === t)} flex-1 items-center py-2.5`}
              onPress={() => setType(t)}
              activeOpacity={0.85}>
              <Text className={`text-sm font-semibold capitalize ${chipTextClass(type === t)}`}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="mb-4 items-center py-2">
          <Text className="text-sm text-muted">{currencySymbol}</Text>
          <Text className="mt-1 text-5xl font-bold text-foreground" numberOfLines={1}>
            {amount || '0'}
          </Text>
        </View>

        <View className="mb-4 flex-row flex-wrap gap-1.5">
          {QUICK_AMOUNTS.map((q) => (
            <TouchableOpacity
              key={q}
              className="rounded-full border border-border bg-card px-3.5 py-1.5"
              onPress={() => setAmount(String(q))}
              activeOpacity={0.85}>
              <Text className="text-xs font-semibold text-foreground">{q}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="mb-5">
          <NumericKeypad onKeyPress={handleKeyPress} />
        </View>

        <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          {type === 'transfer' ? 'From wallet' : 'Wallet'}
        </Text>
        <View className="mb-4 flex-row flex-wrap gap-1.5">
          {wallets.map((w) => (
            <TouchableOpacity
              key={w.id}
              className={chipClass(walletId === w.id)}
              onPress={() => setWalletId(w.id)}
              activeOpacity={0.85}>
              <Text className={`text-sm ${chipTextClass(walletId === w.id)}`} numberOfLines={1}>
                {w.icon} {w.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {type === 'transfer' ? (
          <>
            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">To wallet</Text>
            <View className="mb-4 flex-row flex-wrap gap-1.5">
              {destinationWallets.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  className={chipClass(transferToWalletId === w.id)}
                  onPress={() => setTransferToWalletId(w.id)}
                  activeOpacity={0.85}>
                  <Text className={`text-sm ${chipTextClass(transferToWalletId === w.id)}`} numberOfLines={1}>
                    {w.icon} {w.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Category</Text>
            <View className="mb-4 flex-row flex-wrap gap-1.5">
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  className={chipClass(categoryId === c.id)}
                  onPress={() => setCategoryId(c.id)}
                  activeOpacity={0.85}>
                  <Text className={`text-xs ${chipTextClass(categoryId === c.id)}`} numberOfLines={1}>
                    {c.icon} {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          onPress={handleOpenDetails}
          className="mb-4 flex-row items-center justify-between rounded-xl border border-dashed border-border bg-card px-4 py-3"
          activeOpacity={0.85}>
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="tune" size={18} color="#6b7280" />
            <Text className="text-sm font-medium text-foreground">
              {detailsAdded ? 'More details added' : 'Add more details'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </ScrollView>

      <View
        className="border-t border-border bg-canvas px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <PrimaryButton
          label={actionLabel}
          loading={loading}
          loadingLabel="Adding..."
          icon="check"
          onPress={handleSubmit}
          disabled={loading}
        />
      </View>
    </ScreenShell>
  );
}
