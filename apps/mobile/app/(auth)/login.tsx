import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/auth-context';
import { GoogleSignInButton } from '@/components/google-sign-in-button';

const inputClassName =
  'border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { verifyEmail } = useLocalSearchParams<{ verifyEmail?: string }>();
  const showVerifyEmailHint =
    verifyEmail === '1' || verifyEmail === 'true';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Login failed', error.message);
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <View className="flex-1 bg-[#C9BEFF] dark:bg-gray-900">
      <View
        style={{ paddingTop: Math.max(insets.top, 12) }}
        className="bg-[#6367FF] rounded-b-2xl border border-transparent shadow-xl/50 shadow-[#6367FF] px-6 pb-8">
        <Text className="text-3xl font-bold text-white">Moni</Text>
        <Text className="mt-2 text-base leading-6 text-white/90">
          Wallets, spending, and on-device AI—organized in one place. Local-first so your finances stay on your device.
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-6">
          <Text className="text-xl font-semibold text-gray-900 dark:text-white">
            Sign in
          </Text>
          <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Welcome back. Use the email and password for your account.
          </Text>
          {showVerifyEmailHint ? (
            <View className="mt-4 rounded-xl border border-[#8494FF] bg-white/90 px-4 py-3 dark:border-indigo-400/50 dark:bg-indigo-950/40">
              <Text className="text-sm font-semibold text-[#4f54c4] dark:text-indigo-200">
                Confirm your email
              </Text>
              <Text className="mt-1 text-sm leading-5 text-gray-700 dark:text-indigo-100/90">
                We sent you a link. Open it to verify your address, then sign in below.
              </Text>
            </View>
          ) : null}
        </View>

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
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          className={`bg-[#6367FF] dark:bg-blue-500 p-3.5 rounded-lg items-center mt-2 ${loading ? 'opacity-60' : ''}`}
          onPress={handleLogin}
          disabled={loading}>
          <Text className="text-white text-base font-semibold">
            {loading ? 'Signing in...' : 'Sign in'}
          </Text>
        </TouchableOpacity>

        <GoogleSignInButton
          disabled={loading}
          onError={(message) => Alert.alert('Google sign in failed', message, [{ text: 'OK' }], {
          cancelable: true,
        })}
        />

        <Link href={'/(auth)/register' as any} asChild>
          <TouchableOpacity className="mt-8 items-center py-2">
            <Text className="text-sm font-medium text-[#4f54c4] dark:text-[#9EADFF]">
              Don&apos;t have an account? Sign up
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </View>
  );
}
