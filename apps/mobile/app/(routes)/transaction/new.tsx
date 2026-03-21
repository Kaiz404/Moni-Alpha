import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
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

    let locationPayload: {
      locationLatitude?: number | null;
      locationLongitude?: number | null;
      locationName?: string | null;
    } = {};

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        let locationName: string | null = null;
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          });
          const first = addresses[0];
          if (first) {
            locationName = [first.name, first.street, first.city, first.region]
              .filter(Boolean)
              .join(', ')
              .trim() || null;
          }
        } catch {
        }

        locationPayload = {
          locationLatitude: current.coords.latitude,
          locationLongitude: current.coords.longitude,
          locationName,
        };
      }
    } catch {
    }

    const parsed = createTransactionSchema.safeParse({
      walletId,
      amount: parseFloat(amount) || 0,
      type,
      categoryId: categoryId || null,
      merchant: merchant.trim() || null,
      description: description.trim() || null,
      transactionDate: new Date().toISOString(),
      ...locationPayload,
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
    <View className="flex-1 bg-[#C9BEFF] dark:bg-gray-900">
      <View className="bg-[#6367FF] h-25 border rounded-b-2xl border-transparent shadow-xl/50 shadow-[#6367FF] flex-row justify-start">
        <Link href={'/../' as any} asChild>
          <TouchableOpacity className="bg-[#8494FF] top-9 left-7 px-4 py-1 h-10 w-10 rounded-2xl">
            <Text className="text-white font-semibold">-</Text>
          </TouchableOpacity>
        </Link>
        <Text className="text-2xl font-medium mb-2 text-white dark:text-white top-10 left-12 ">New Transaction</Text>
      </View>
      <ScrollView className="flex-1 p-6 ">
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
        <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Amount</Text>
        <TextInput
          className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Enter Amount"
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
        <View className="flex-row items-center justify-start">
          <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Merchant</Text>
          <Text className="text-[9px] font-medium mb-2 ml-1 text-gray-600 dark:text-white">(if any*)</Text>
        </View>
        <TextInput
          className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Enter Merchant"
          placeholderTextColor="#9CA3AF"
          value={merchant}
          onChangeText={setMerchant}
        />
        <View className="flex-row items-center justify-start">
          <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Description</Text>
          <Text className="text-[9px] font-medium mb-2 ml-1 text-gray-600 dark:text-white">(if any*)</Text>
        </View>
        <TextInput
          className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Enter Description"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <TouchableOpacity
          className={`bg-[#6367FF] dark:bg-blue-500 p-3.5 rounded-lg items-center mt-2 mb-20 ${loading ? 'opacity-60' : ''}`}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text className="text-white text-base font-semibold">{loading ? 'Creating...' : 'Create'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

