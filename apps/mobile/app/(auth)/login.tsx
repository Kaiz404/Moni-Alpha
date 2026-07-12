import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/auth-context';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { ScreenShell } from '@/components/ui/screen-shell';

const inputClassName =
  'rounded-lg border border-border bg-card p-3 text-base text-foreground';

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
    <ScreenShell variant="canvas">
      <View
        style={{ paddingTop: Math.max(insets.top, 12) }}
        className="rounded-b-2xl border border-transparent bg-primary px-6 pb-8 shadow-xl/50 shadow-primary">
        <Text className="text-3xl font-bold text-primary-foreground">Moni</Text>
        <Text className="mt-2 text-base leading-6 text-primary-foreground/90">
          Wallets, spending, and on-device AI—organized in one place. Local-first so your finances stay on your device.
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-6">
          <Text className="text-xl font-semibold text-foreground">
            Sign in
          </Text>
          <Text className="mt-1 text-sm text-muted">
            Welcome back. Use the email and password for your account.
          </Text>
          {showVerifyEmailHint ? (
            <View className="mt-4 rounded-xl border border-primary/40 bg-primary-muted px-4 py-3">
              <Text className="text-sm font-semibold text-primary">
                Confirm your email
              </Text>
              <Text className="mt-1 text-sm leading-5 text-foreground">
                We sent you a link. Open it to verify your address, then sign in below.
              </Text>
            </View>
          ) : null}
        </View>

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
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          className={`mt-2 items-center rounded-lg bg-primary p-3.5 ${loading ? 'opacity-60' : ''}`}
          onPress={handleLogin}
          disabled={loading}>
          <Text className="text-base font-semibold text-primary-foreground">
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
            <Text className="text-sm font-medium text-primary">
              Don&apos;t have an account? Sign up
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </ScreenShell>
  );
}
