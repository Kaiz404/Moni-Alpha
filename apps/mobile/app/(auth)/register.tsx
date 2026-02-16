import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';

export default function RegisterScreen() {
  const { signUp } = useAuth();
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
    const { error } = await signUp(email.trim(), password, displayName.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Registration failed', error.message);
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <View className="flex-1 justify-center p-6 bg-white dark:bg-gray-900">
      <Text className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">Create account</Text>
      <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Display name"
        placeholderTextColor="#9CA3AF"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
      />
      <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Email"
        placeholderTextColor="#9CA3AF"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-4 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        placeholder="Password (min 8 characters)"
        placeholderTextColor="#9CA3AF"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password-new"
      />
      <TouchableOpacity
        className={`bg-blue-600 dark:bg-blue-500 p-3.5 rounded-lg items-center mt-2 ${loading ? 'opacity-60' : ''}`}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">{loading ? 'Creating account...' : 'Sign up'}</Text>
      </TouchableOpacity>
        <Link href={'/(auth)/login' as any} asChild>
        <TouchableOpacity className="mt-6 items-center">
          <Text className="text-sm text-blue-600 dark:text-blue-400">Already have an account? Sign in</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

