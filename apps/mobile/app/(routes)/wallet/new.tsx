import { useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { createWallet } from '@/lib/supabase/wallets';
import { createWalletSchema } from '@repo/types';

const WALLET_TYPES = [
  { value: 'bank' as const, label: 'Bank', icon: '🏦' },
  { value: 'cash' as const, label: 'Cash', icon: '💵' },
  { value: 'credit' as const, label: 'Credit', icon: '💳' },
  { value: 'debit' as const, label: 'Debit', icon: '💳' },
  { value: 'ewallet' as const, label: 'E-Wallet', icon: '📱' },
  { value: 'investment' as const, label: 'Investment', icon: '📈' },
  { value: 'other' as const, label: 'Other', icon: '📦' },
];

const COLORS = ['#EF476F', '#FF6B6B', '#FFD166', '#06D6A0', '#118AB2', '#0066FF'];

export default function NewWalletScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof WALLET_TYPES)[0]['value']>('bank');
  const [currency, setCurrency] = useState('USD');
  const [initialBalance, setInitialBalance] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    const parsed = createWalletSchema.safeParse({
      name: name.trim(),
      type,
      currency,
      initialBalance: parseFloat(initialBalance) || 0,
      color,
      icon: WALLET_TYPES.find((t) => t.value === type)?.icon ?? '💰',
    });
    if (!parsed.success) {
      Alert.alert('Error', parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }
    setLoading(true);
    try {
      await createWallet(parsed.data);
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create wallet');
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
        <Text className="text-2xl font-medium mb-2 text-white dark:text-white top-10 left-12 ">New Wallet</Text>
      </View>
      <ScrollView className="p-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Name</Text>
        <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Enter Wallet Name"
        placeholderTextColor="#9CA3AF"
        value={name}
        onChangeText={setName}
      />
      <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Type</Text>
      <View className="mb-4">
        {WALLET_TYPES.map((t) => {
          const selected = t.value === type;
          return (
            <View className='border border-gray-300 dark:border-gray-600 rounded-lg mb-1 ml-3 mr-3' key={t.value}>
              <TouchableOpacity
                key={t.value}
                onPress={() => setType(t.value)}
                className={`flex-row items-center justify-between border rounded-lg px-3 py-1 ${selected ? 'border-[#8494FF] border-x-2 border-y-2 bg-white/50 dark:border-blue-300 dark:bg-blue-900/30' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'}`}
              >
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg">{t.icon}</Text>
                  <Text className="text-sm text-gray-900 dark:text-white">{t.label}</Text>
                </View>
                <View className={`w-4 h-4 rounded-full ${selected ? 'bg-[#8494FF]' : 'bg-transparent border border-[#8494FF] dark:border-gray-500'}`} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Currency</Text>
      <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Currency"
        placeholderTextColor="#9CA3AF"
        value={currency}
        onChangeText={setCurrency}
      />
      <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Initial Balance</Text>
      <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Enter Initial Balance"
        placeholderTextColor="#9CA3AF"
        value={initialBalance}
        onChangeText={setInitialBalance}
        keyboardType="decimal-pad"
      />
      <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Color</Text>
      <View className="flex-row gap-3 mb-6 justify-between">
        {COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            className={`w-9 h-9 rounded-full ${color === c ? 'border border-x-3 border-y-3 border-white dark:border-gray-200' : ''}`}
            style={{ backgroundColor: c }}
            onPress={() => setColor(c)}
          />
        ))}
      </View>
      <TouchableOpacity
        className={`bg-[#6367FF] dark:bg-blue-500 p-3.5 rounded-lg mb-20 items-center ${loading ? 'opacity-60' : ''}`}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">{loading ? 'Creating...' : 'Create Wallet'}</Text>
      </TouchableOpacity>
    </ScrollView>
  </View>
  );
}

