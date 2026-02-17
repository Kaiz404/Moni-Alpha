import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
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

const COLORS = ['#0066FF', '#FF6B6B', '#06D6A0', '#FFD166', '#EF476F', '#118AB2'];

export default function NewWalletScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof WALLET_TYPES)[0]['value']>('bank');
  const [currency, setCurrency] = useState('USD');
  const [initialBalance, setInitialBalance] = useState('0');
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
    <View className="flex-1 p-6 bg-white dark:bg-gray-900">
      <Text className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">New Wallet</Text>
      <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Name"
        placeholderTextColor="#9CA3AF"
        value={name}
        onChangeText={setName}
      />
      <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Type</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {WALLET_TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            className={`p-3 rounded-lg ${type === t.value ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'}`}
            onPress={() => setType(t.value)}
          >
            <Text className="text-gray-900 dark:text-white">{t.icon}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Currency"
        placeholderTextColor="#9CA3AF"
        value={currency}
        onChangeText={setCurrency}
      />
      <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Initial balance"
        placeholderTextColor="#9CA3AF"
        value={initialBalance}
        onChangeText={setInitialBalance}
        keyboardType="decimal-pad"
      />
      <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">Color</Text>
      <View className="flex-row gap-3 mb-6">
        {COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            className={`w-9 h-9 rounded-full ${color === c ? 'border-2 border-gray-800 dark:border-gray-200' : ''}`}
            style={{ backgroundColor: c }}
            onPress={() => setColor(c)}
          />
        ))}
      </View>
      <TouchableOpacity
        className={`bg-blue-600 dark:bg-blue-500 p-3.5 rounded-lg items-center ${loading ? 'opacity-60' : ''}`}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">{loading ? 'Creating...' : 'Create Wallet'}</Text>
      </TouchableOpacity>
    </View>
  );
}

