import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { createTransaction } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import { getCategories } from '@/lib/supabase/categories';
import { createTransactionSchema } from '@repo/types';

export default function NewTransactionScreen() {
  const { user } = useAuth();
  const { walletId: paramWalletId } = useLocalSearchParams<{ walletId?: string }>();
  const [wallets, setWallets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [walletId, setWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    getWallets().then(setWallets);
    getCategories(type).then(setCategories);
  }, [user, type]);

  useEffect(() => {
    if (wallets.length > 0) {
      if (paramWalletId && wallets.some((w) => w.id === paramWalletId)) {
        setWalletId(paramWalletId);
      } else if (!walletId) {
        setWalletId(wallets[0].id);
      }
    }
  }, [wallets, paramWalletId]);

  const handleSubmit = async () => {
    if (!user || !walletId) return;
    const parsed = createTransactionSchema.safeParse({
      walletId,
      amount: parseFloat(amount) || 0,
      type,
      categoryId: categoryId || null,
      merchant: merchant.trim() || null,
      description: description.trim() || null,
      transactionDate: new Date().toISOString(),
    });
    if (!parsed.success) {
      Alert.alert('Error', parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }
    setLoading(true);
    try {
      await createTransaction(parsed.data);
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 p-6 bg-white dark:bg-gray-900">
      <Text className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">New Transaction</Text>
      <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Wallet</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {wallets.map((w) => (
          <TouchableOpacity
            key={w.id}
            className={`p-2.5 rounded-lg ${walletId === w.id ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'}`}
            onPress={() => setWalletId(w.id)}
          >
            <Text className="text-gray-900 dark:text-white">{w.icon} {w.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Type</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        <TouchableOpacity
          className={`p-2.5 rounded-lg ${type === 'income' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'}`}
          onPress={() => setType('income')}
        >
          <Text className="text-gray-900 dark:text-white">Income</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`p-2.5 rounded-lg ${type === 'expense' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'}`}
          onPress={() => setType('expense')}
        >
          <Text className="text-gray-900 dark:text-white">Expense</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Amount"
        placeholderTextColor="#9CA3AF"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Category</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            className={`p-2.5 rounded-lg ${categoryId === c.id ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'}`}
            onPress={() => setCategoryId(c.id)}
          >
            <Text className="text-gray-900 dark:text-white">{c.icon} {c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Merchant"
        placeholderTextColor="#9CA3AF"
        value={merchant}
        onChangeText={setMerchant}
      />
      <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Description"
        placeholderTextColor="#9CA3AF"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <TouchableOpacity
        className={`bg-blue-600 dark:bg-blue-500 p-3.5 rounded-lg items-center mt-2 ${loading ? 'opacity-60' : ''}`}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">{loading ? 'Creating...' : 'Create'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

