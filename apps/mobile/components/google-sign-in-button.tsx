import { useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { isGoogleSignInConfigured } from '@/lib/auth/google-signin';

type GoogleSignInButtonProps = {
  disabled?: boolean;
  onError?: (message: string) => void;
};

export function GoogleSignInButton({ disabled, onError }: GoogleSignInButtonProps) {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  if (Platform.OS === 'web' || !isGoogleSignInConfigured()) {
    return null;
  }

  const handlePress = async () => {
    setLoading(true);
    const { error, cancelled } = await signInWithGoogle();
    setLoading(false);

    if (error) {
      if (!cancelled) {
        onError?.(error.message);
      }
      return;
    }

    router.replace('/(tabs)' as any);
  };

  return (
    <View className="mt-4">
      <View className="my-4 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-gray-300 dark:bg-gray-600" />
        <Text className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          or
        </Text>
        <View className="h-px flex-1 bg-gray-300 dark:bg-gray-600" />
      </View>

      <TouchableOpacity
        className={`flex-row items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white p-3.5 dark:border-gray-600 dark:bg-gray-800 ${loading || disabled ? 'opacity-60' : ''}`}
        onPress={handlePress}
        disabled={loading || disabled}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google">
        <Text className="text-lg leading-none text-gray-700 dark:text-gray-200">G</Text>
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {loading ? 'Connecting...' : 'Continue with Google'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
