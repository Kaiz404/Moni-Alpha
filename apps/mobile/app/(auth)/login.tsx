import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/auth-context';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { GradientCard } from '@/components/ui/gradient-card';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';

const inputClassName =
  'rounded-2xl border border-border bg-card p-3.5 text-base text-foreground';
const brandMark = getWalletCardStyle('emerald-grain');

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
    <ScreenShell variant="default">
      <View style={{ paddingTop: Math.max(insets.top, 24) }} className="px-6 pb-2">
        <GradientCard cardStyle={brandMark} className="h-14 w-14 items-center justify-center rounded-2xl">
          <Text className="text-2xl font-bold text-white">M</Text>
        </GradientCard>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mb-8">
          <Text className="text-3xl font-bold text-foreground">Welcome back</Text>
          <Text className="mt-2 text-base leading-6 text-muted">
            Sign in to pick up where you left off — your wallets stay local-first and private.
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
          className={`mt-2 items-center rounded-2xl bg-primary p-3.5 ${loading ? 'opacity-60' : ''}`}
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
