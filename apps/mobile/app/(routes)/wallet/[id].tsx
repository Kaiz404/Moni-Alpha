import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '@/lib/auth/auth-context';
import { getWalletById, updateWallet } from '@/lib/supabase/wallets';
import { createWalletSchema } from '@repo/types';
import {
  WALLET_ACCENT_COLORS,
  WALLET_TYPE_OPTIONS,
  type WalletKind,
} from '@/constants/wallet-form';

const inputClass =
  'rounded-xl bg-white/95 px-3 py-2.5 text-slate-900 dark:bg-slate-800/95 dark:text-white';

export default function EditWalletScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const walletId = useMemo(() => {
    const x = params.id;
    if (Array.isArray(x)) return x[0];
    return x;
  }, [params.id]);

  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletKind>('bank');
  const [currency, setCurrency] = useState('USD');
  const [initialBalance, setInitialBalance] = useState('');
  const [color, setColor] = useState(WALLET_ACCENT_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const [readOnlyBalance, setReadOnlyBalance] = useState('');
  const [readOnlyUpdated, setReadOnlyUpdated] = useState('');

  const chipBase =
    'py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800';
  const chipActive = 'border-[#6367FF] bg-[#6367FF]/12 dark:bg-[#6367FF]/25 dark:border-[#8494FF]';

  useEffect(() => {
    if (!user || !walletId) return;
    let cancelled = false;

    (async () => {
      setLoadingWallet(true);
      setLoadError(null);
      try {
        const w = await getWalletById(walletId);
        if (cancelled) return;
        if (!w) {
          setLoadError('Wallet not found.');
          setLoadingWallet(false);
          return;
        }
        setName(w.name ?? '');
        setType(
          WALLET_TYPE_OPTIONS.find((o) => o.value === w.type)?.value ?? 'bank',
        );
        setCurrency(w.currency ?? 'USD');
        setInitialBalance(w.initialBalance.toFixed(2));
        setColor(w.color || WALLET_ACCENT_COLORS[0]);
        setReadOnlyBalance(
          `${w.currency ?? 'USD'} ${w.currentBalance.toFixed(2)}`,
        );
        setReadOnlyUpdated(
          w.updatedAt
            ? new Date(w.updatedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : '—',
        );
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load wallet');
        }
      } finally {
        if (!cancelled) setLoadingWallet(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, walletId]);

  const handleSubmit = useCallback(async () => {
    if (!user || !walletId) return;

    const cur = currency.trim().toUpperCase().slice(0, 3) || 'USD';
    const parsed = createWalletSchema.safeParse({
      name: name.trim(),
      type,
      currency: cur,
      initialBalance: parseFloat(initialBalance) || 0,
      color,
      icon: WALLET_TYPE_OPTIONS.find((t) => t.value === type)?.icon ?? '💰',
    });
    if (!parsed.success) {
      Alert.alert('Error', parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    setLoading(true);
    try {
      await updateWallet(walletId, parsed.data);
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update wallet');
    } finally {
      setLoading(false);
    }
  }, [user, walletId, name, type, currency, initialBalance, color]);

  if (!walletId) {
    return (
      <View className="flex-1 items-center justify-center bg-[#C9BEFF] dark:bg-gray-900">
        <Text className="text-slate-600 dark:text-slate-400">Missing wallet.</Text>
      </View>
    );
  }

  if (loadingWallet) {
    return (
      <View className="flex-1 items-center justify-center bg-[#C9BEFF] dark:bg-gray-900">
        <ActivityIndicator size="large" color="#6367FF" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="flex-1 bg-[#C9BEFF] dark:bg-gray-900 px-6 justify-center">
        <Text className="text-center text-slate-700 dark:text-slate-300 mb-4">{loadError}</Text>
        <TouchableOpacity
          className="rounded-xl bg-[#6367FF] py-3 items-center"
          onPress={() => router.back()}>
          <Text className="text-white font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#C9BEFF] dark:bg-gray-900">
      <SafeAreaView edges={['top']} className="bg-[#6367FF]">
        <View className="bg-[#6367FF] h-25 border rounded-b-2xl border-transparent shadow-xl/50 shadow-[#6367FF] flex-row items-center justify-start pl-7 pr-5">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            className="h-10 w-10 items-center justify-center rounded-2xl bg-[#8494FF] active:opacity-80">
            <MaterialIcons name="arrow-back" size={22} color="#ffffff" />
          </Pressable>
          <Text className="ml-3 flex-1 text-2xl font-medium text-white dark:text-white" numberOfLines={1}>
            Edit Wallet
          </Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-4 pt-4 pb-2"
            showsVerticalScrollIndicator={false}>
            <View className="mb-4 rounded-xl bg-white/60 px-3 py-2.5 dark:bg-slate-800/60">
              <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Current balance
              </Text>
              <Text className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {readOnlyBalance}
              </Text>
              <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Last updated {readOnlyUpdated}
              </Text>
            </View>

            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Name
            </Text>
            <TextInput
              className={`mb-4 text-base ${inputClass}`}
              placeholder="Wallet name"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />

            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Type
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-1.5">
              {WALLET_TYPE_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  className={`${chipBase} ${type === t.value ? chipActive : ''}`}
                  onPress={() => setType(t.value)}
                  activeOpacity={0.85}>
                  <Text
                    className={`text-xs ${type === t.value ? 'font-semibold text-[#4f54c4] dark:text-indigo-200' : 'text-slate-800 dark:text-slate-100'}`}
                    numberOfLines={1}>
                    {t.icon} {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="mb-4 flex-row gap-3">
              <View className="min-w-[100px] flex-1">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Currency
                </Text>
                <TextInput
                  className={`text-base ${inputClass}`}
                  placeholder="USD"
                  placeholderTextColor="#9CA3AF"
                  value={currency}
                  onChangeText={setCurrency}
                  autoCapitalize="characters"
                  maxLength={3}
                />
              </View>
              <View className="min-w-[120px] flex-1">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Initial balance
                </Text>
                <TextInput
                  className={`text-base ${inputClass}`}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  value={initialBalance}
                  onChangeText={setInitialBalance}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Text className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
              Changing initial balance updates how running balance is calculated from your transactions.
            </Text>

            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Accent color
            </Text>
            <View className="mb-2 flex-row flex-wrap gap-2">
              {WALLET_ACCENT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  activeOpacity={0.85}
                  className={`h-10 w-10 items-center justify-center rounded-full ${color === c ? 'border-2 border-white' : 'border border-slate-300/80 dark:border-slate-600'}`}
                  style={{ backgroundColor: c }}
                  accessibilityLabel={`Color ${c}`}
                />
              ))}
            </View>
          </ScrollView>

          <View
            className="border-t border-slate-400/20 bg-[#C9BEFF] px-4 pt-3 dark:border-slate-600/30 dark:bg-gray-900"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            <TouchableOpacity
              className={`flex-row items-center justify-center gap-2 rounded-xl bg-[#6367FF] py-3.5 dark:bg-blue-600 ${loading ? 'opacity-60' : ''}`}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.88}>
              {loading ? (
                <Text className="text-base font-semibold text-white">Saving…</Text>
              ) : (
                <>
                  <MaterialIcons name="check" size={20} color="#ffffff" />
                  <Text className="text-base font-semibold text-white">Save changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
