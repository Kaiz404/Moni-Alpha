import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { isGoogleSignInConfigured } from '@/lib/auth/google-signin';
import { Press } from '@/components/ui/press';
import { tid } from '@/lib/test-ids';

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
        <Text className="text-xs font-display-semibold uppercase tracking-wide text-muted">
          or
        </Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <Press
        testID={tid('auth', 'continue-with-google')}
        className={`min-h-13 flex-row items-center justify-center gap-3 rounded-2xl bg-card px-4 py-3 ${loading || disabled ? 'opacity-60' : ''}`}
        onPress={handlePress}
        disabled={loading || disabled}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        <Text className="text-lg leading-none text-primary">G</Text>
        <Text className="text-base font-display-semibold text-foreground">
          {loading ? 'Connecting...' : 'Continue with Google'}
        </Text>
      </Press>
    </View>
  );
}
