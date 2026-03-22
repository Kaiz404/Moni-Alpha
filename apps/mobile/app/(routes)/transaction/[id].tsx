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
import { getTransactionById, updateTransaction } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { getCategories } from '@/lib/supabase/categories';

const inputClass =
  'rounded-xl bg-white/95 px-3 py-2.5 text-slate-900 dark:bg-slate-800/95 dark:text-white';

export default function EditTransactionScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const txId = useMemo(() => {
    const x = params.id;
    if (Array.isArray(x)) return x[0];
    return x;
  }, [params.id]);

  const [loadingTx, setLoadingTx] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [walletId, setWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const [readOnlyDate, setReadOnlyDate] = useState('');
  const [readOnlyLocation, setReadOnlyLocation] = useState<string | null>(null);
  const [isTransfer, setIsTransfer] = useState(false);

  const chipBase =
    'py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800';
  const chipActive = 'border-[#6367FF] bg-[#6367FF]/12 dark:bg-[#6367FF]/25 dark:border-[#8494FF]';

  useEffect(() => {
    if (!user || !txId) return;
    let cancelled = false;

    (async () => {
      setLoadingTx(true);
      setLoadError(null);
      try {
        const [tx, walletList] = await Promise.all([getTransactionById(txId), getWallets()]);
        if (cancelled) return;
        if (!tx) {
          setLoadError('Transaction not found.');
          setLoadingTx(false);
          return;
        }
        setWallets(walletList);

        const transfer = tx.type === 'transfer';
        setIsTransfer(transfer);

        setReadOnlyDate(
          tx.transactionDate
            ? new Date(tx.transactionDate).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : '—',
        );
        setReadOnlyLocation(tx.locationName ?? null);

        setWalletId(tx.walletId);
        setAmount(tx.amount.toFixed(2));
        if (tx.type === 'income' || tx.type === 'expense') {
          setType(tx.type);
        } else {
          setType('expense');
        }
        setCategoryId(tx.categoryId ?? '');
        setMerchant(tx.merchant ?? '');
        setDescription(tx.description ?? tx.notes ?? '');
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load transaction');
        }
      } finally {
        if (!cancelled) setLoadingTx(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, txId]);

  useEffect(() => {
    if (!user || isTransfer) return;
    getCategories(type).then(setCategories);
  }, [user, type, isTransfer]);

  const handleSubmit = useCallback(async () => {
    if (!user || !txId || isTransfer) return;

    const parsedAmount = parseFloat(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Enter a valid positive amount.');
      return;
    }

    setLoading(true);
    try {
      await updateTransaction(txId, {
        walletId,
        amount: parsedAmount,
        type,
        categoryId: categoryId || null,
        merchant: merchant.trim() || null,
        description: description.trim() || null,
      });
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update transaction');
    } finally {
      setLoading(false);
    }
  }, [user, txId, isTransfer, walletId, amount, type, categoryId, merchant, description]);

  if (!txId) {
    return (
      <View className="flex-1 items-center justify-center bg-[#C9BEFF] dark:bg-gray-900">
        <Text className="text-slate-600 dark:text-slate-400">Missing transaction.</Text>
      </View>
    );
  }

  if (loadingTx) {
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
            Edit Transaction
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
                Date &amp; time
              </Text>
              <Text className="text-sm text-slate-800 dark:text-slate-100">{readOnlyDate}</Text>
              {readOnlyLocation ? (
                <Text className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Location: {readOnlyLocation}
                </Text>
              ) : null}
            </View>

            {isTransfer ? (
              <View className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-3 dark:border-amber-700/50 dark:bg-amber-950/40">
                <Text className="text-sm text-amber-900 dark:text-amber-100">
                  Transfers can’t be edited here. Delete and recreate if you need to change them.
                </Text>
              </View>
            ) : null}

            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Wallet
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-1.5">
              {wallets.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  className={`${chipBase} ${walletId === w.id ? chipActive : ''} ${isTransfer ? 'opacity-50' : ''}`}
                  onPress={() => !isTransfer && setWalletId(w.id)}
                  activeOpacity={0.85}
                  disabled={isTransfer}>
                  <Text
                    className={`text-sm ${walletId === w.id ? 'font-semibold text-[#4f54c4] dark:text-indigo-200' : 'text-slate-800 dark:text-slate-100'}`}
                    numberOfLines={1}>
                    {w.icon} {w.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="mb-4 flex-row gap-3">
              <View className="flex-1 min-w-[140px]">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Type
                </Text>
                <View className="flex-row gap-1.5">
                  <TouchableOpacity
                    className={`flex-1 ${chipBase} items-center py-2 ${type === 'income' ? chipActive : ''} ${isTransfer ? 'opacity-50' : ''}`}
                    onPress={() => !isTransfer && setType('income')}
                    activeOpacity={0.85}
                    disabled={isTransfer}>
                    <Text
                      className={`text-sm font-medium ${type === 'income' ? 'text-[#4f54c4] dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200'}`}>
                      Income
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 ${chipBase} items-center py-2 ${type === 'expense' ? chipActive : ''} ${isTransfer ? 'opacity-50' : ''}`}
                    onPress={() => !isTransfer && setType('expense')}
                    activeOpacity={0.85}
                    disabled={isTransfer}>
                    <Text
                      className={`text-sm font-medium ${type === 'expense' ? 'text-[#4f54c4] dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200'}`}>
                      Expense
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View className="flex-1 min-w-[120px]">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Amount
                </Text>
                <TextInput
                  className={`text-base ${inputClass} ${isTransfer ? 'opacity-50' : ''}`}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  editable={!isTransfer}
                />
              </View>
            </View>

            <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Category
            </Text>
            <View className="mb-4 flex-row flex-wrap gap-1.5">
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  className={`${chipBase} ${categoryId === c.id ? chipActive : ''} ${isTransfer ? 'opacity-50' : ''}`}
                  onPress={() => !isTransfer && setCategoryId(c.id)}
                  activeOpacity={0.85}
                  disabled={isTransfer}>
                  <Text
                    className={`text-xs ${categoryId === c.id ? 'font-semibold text-[#4f54c4] dark:text-indigo-200' : 'text-slate-800 dark:text-slate-100'}`}
                    numberOfLines={1}>
                  {c.icon} {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="mb-1.5 flex-row items-baseline gap-1">
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Merchant
              </Text>
              <Text className="text-[10px] text-slate-400 dark:text-slate-500">optional</Text>
            </View>
            <TextInput
              className={`mb-3 text-sm ${inputClass} ${isTransfer ? 'opacity-50' : ''}`}
              placeholder="Store or payee"
              placeholderTextColor="#9CA3AF"
              value={merchant}
              onChangeText={setMerchant}
              editable={!isTransfer}
            />

            <View className="mb-1.5 flex-row items-baseline gap-1">
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Description
              </Text>
              <Text className="text-[10px] text-slate-400 dark:text-slate-500">optional</Text>
            </View>
            <TextInput
              className={`mb-1 min-h-[72px] text-sm ${inputClass} ${isTransfer ? 'opacity-50' : ''}`}
              placeholder="Notes"
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              editable={!isTransfer}
            />
          </ScrollView>

          {!isTransfer ? (
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
          ) : (
            <View
              className="border-t border-slate-400/20 bg-[#C9BEFF] px-4 pt-3 dark:border-slate-600/30 dark:bg-gray-900"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
              <TouchableOpacity
                className="flex-row items-center justify-center gap-2 rounded-xl bg-slate-600 py-3.5 dark:bg-slate-700"
                onPress={() => router.back()}
                activeOpacity={0.88}>
                <Text className="text-base font-semibold text-white">Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
