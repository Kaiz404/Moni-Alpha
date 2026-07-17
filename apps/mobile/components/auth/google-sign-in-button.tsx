import { useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { isGoogleSignInConfigured } from '@/lib/auth/google-signin';

type GoogleSignInButtonProps = {
  disabled?: boolean;
  onError?: (message: string) => void;
};

export function GoogleSignInButton({
  disabled,
  onError,
}: GoogleSignInButtonProps) {
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
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs font-medium uppercase tracking-wide text-muted">
          or
        </Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <TouchableOpacity
        className={`flex-row items-center justify-center gap-2 rounded-lg border border-border bg-card p-3.5 ${loading || disabled ? 'opacity-60' : ''}`}
        onPress={handlePress}
        disabled={loading || disabled}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        <Text className="text-lg leading-none text-primary">G</Text>
        <Text className="text-base font-semibold text-foreground">
          {loading ? 'Connecting...' : 'Continue with Google'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
