import { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { FormField } from '@/components/ui/form-field';
import { GradientCard } from '@/components/ui/gradient-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useAuth } from '@/lib/auth/auth-context';

const brandMark = getWalletCardStyle('emerald-grain');

export default function LoginScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { verifyEmail } = useLocalSearchParams<{
    verifyEmail?: string;
  }>();
  const showVerifyEmailHint =
    verifyEmail === '1' || verifyEmail === 'true';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        'Add your details',
        'Enter your email and password.',
      );
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Could not sign in', error.message);
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <ScreenShell variant="canvas">
      <View
        className="px-6"
        style={{ paddingTop: Math.max(insets.top, 28) }}
      >
        <GradientCard
          cardStyle={brandMark}
          className="h-14 w-14 items-center justify-center rounded-2xl"
        >
          <Text className="text-2xl font-bold text-primary-foreground">
            M
          </Text>
        </GradientCard>
      </View>

      <ScrollView
        className="flex-1 px-6 pt-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        <View className="mb-10">
          <Text className="text-[28px] font-bold leading-[34px] text-foreground">
            Welcome back
          </Text>
          <Text className="mt-2 max-w-md text-[16px] leading-[22px] text-muted">
            Your wallets and recent activity are ready when you are.
          </Text>
          {showVerifyEmailHint ? (
            <View className="mt-5 rounded-2xl bg-primary-muted px-4 py-3.5">
              <Text className="text-[15px] font-bold text-primary">
                Confirm your email
              </Text>
              <Text className="mt-1 text-[13px] leading-[18px] text-foreground">
                Open the link we sent, then return here to sign in.
              </Text>
            </View>
          ) : null}
        </View>

        <FormField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <FormField
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <PrimaryButton
          label="Sign in"
          loading={loading}
          loadingLabel="Signing in..."
          onPress={handleLogin}
        />

        <GoogleSignInButton
          disabled={loading}
          onError={(message) =>
            Alert.alert(
              'Google sign in failed',
              message,
              [{ text: 'OK' }],
              {
                cancelable: true,
              },
            )
          }
        />

        <Link
          href={'/(auth)/register' as any}
          asChild
        >
          <TouchableOpacity
            className="mt-8 items-center py-3"
            accessibilityRole="button"
          >
            <Text className="text-[15px] font-semibold text-primary">
              New to Moni? Create an account
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </ScreenShell>
  );
}
