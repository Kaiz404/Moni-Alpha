import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/auth-context';

const inputClassName =
  'border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password || !displayName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    const { error, session } = await signUp(email.trim(), password, displayName.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Registration failed', error.message);
    } else if (!session) {
      router.replace('/(auth)/login?verifyEmail=1' as any);
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <View className="flex-1 bg-[#C9BEFF] dark:bg-gray-900">
      <View
        style={{ paddingTop: Math.max(insets.top, 12) }}
        className="bg-[#6367FF] rounded-b-2xl border border-transparent shadow-xl/50 shadow-[#6367FF]">
        <View className="flex-row items-start gap-3 px-4 pb-6">
          <Link href={'/(auth)/login' as any} asChild>
            <TouchableOpacity className="mt-1 h-10 w-10 items-center justify-center rounded-2xl bg-[#8494FF]">
              <Text className="text-lg font-semibold text-white">‹</Text>
            </TouchableOpacity>
          </Link>
          <View className="flex-1 pr-2">
            <Text className="text-2xl font-bold text-white">Join Moni</Text>
            <Text className="mt-2 text-base leading-6 text-white/90">
              Create a profile to sync wallets and transactions securely. Same local-first privacy as the rest of the app.
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="mb-6 text-xl font-semibold text-gray-900 dark:text-white">
          Create account
        </Text>

        <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">
          Display name
        </Text>
        <TextInput
          className={`${inputClassName} mb-4`}
          placeholder="How we should greet you"
          placeholderTextColor="#9CA3AF"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />

        <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">
          Email
        </Text>
        <TextInput
          className={`${inputClassName} mb-4`}
          placeholder="you@example.com"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Text className="text-sm font-medium mb-2 text-gray-900 dark:text-white">
          Password
        </Text>
        <TextInput
          className={`${inputClassName} mb-4`}
          placeholder="At least 8 characters"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
        />

        <TouchableOpacity
          className={`bg-[#6367FF] dark:bg-blue-500 p-3.5 rounded-lg items-center mt-2 ${loading ? 'opacity-60' : ''}`}
          onPress={handleRegister}
          disabled={loading}>
          <Text className="text-white text-base font-semibold">
            {loading ? 'Creating account...' : 'Sign up'}
          </Text>
        </TouchableOpacity>

        <Link href={'/(auth)/login' as any} asChild>
          <TouchableOpacity className="mt-8 items-center py-2">
            <Text className="text-sm font-medium text-[#4f54c4] dark:text-[#9EADFF]">
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </View>
  );
}
