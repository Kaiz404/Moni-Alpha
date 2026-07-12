import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/auth-context';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { ScreenShell } from '@/components/ui/screen-shell';

const inputClassName =
  'rounded-lg border border-border bg-card p-3 text-base text-foreground';

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
    <ScreenShell variant="canvas">
      <View
        style={{ paddingTop: Math.max(insets.top, 12) }}
        className="rounded-b-2xl border border-transparent bg-primary shadow-xl/50 shadow-primary">
        <View className="flex-row items-start gap-3 px-4 pb-6">
          <Link href={'/(auth)/login' as any} asChild>
            <TouchableOpacity className="mt-1 h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft">
              <Text className="text-lg font-semibold text-primary-foreground">‹</Text>
            </TouchableOpacity>
          </Link>
          <View className="flex-1 pr-2">
            <Text className="text-2xl font-bold text-primary-foreground">Join Moni</Text>
            <Text className="mt-2 text-base leading-6 text-primary-foreground/90">
              Create a profile to sync wallets and transactions securely. Same local-first privacy as the rest of the app.
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="mb-6 text-xl font-semibold text-foreground">
          Create account
        </Text>

        <Text className="mb-2 text-sm font-medium text-foreground">
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

        <Text className="mb-2 text-sm font-medium text-foreground">
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

        <Text className="mb-2 text-sm font-medium text-foreground">
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
          className={`mt-2 items-center rounded-lg bg-primary p-3.5 ${loading ? 'opacity-60' : ''}`}
          onPress={handleRegister}
          disabled={loading}>
          <Text className="text-base font-semibold text-primary-foreground">
            {loading ? 'Creating account...' : 'Sign up'}
          </Text>
        </TouchableOpacity>

        <GoogleSignInButton
          disabled={loading}
          onError={(message) => Alert.alert('Google sign in failed', message, [{ text: 'OK' }], {
          cancelable: true,
        })}
        />

        <Link href={'/(auth)/login' as any} asChild>
          <TouchableOpacity className="mt-8 items-center py-2">
            <Text className="text-sm font-medium text-primary">
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </ScreenShell>
  );
}
