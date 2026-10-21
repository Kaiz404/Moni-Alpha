import { useState } from 'react';
import {
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { FormField } from '@/components/ui/form-field';
import { GradientCard } from '@/components/ui/gradient-card';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { tid } from '@/lib/test-ids';
import { Page } from '@/components/ui/page';

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
    <Page
      screen="auth"
      kind="bare"
    >
      <ScrollView
        className="flex-1 px-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        <View className="mb-10">
          <Text className="text-[28px] font-display-bold leading-[34px] text-foreground">
            Welcome back
          </Text>
          {showVerifyEmailHint ? (
            <View className="mt-5 rounded-2xl bg-primary-muted px-4 py-3.5">
              <Text className="text-[15px] font-display-bold text-primary">
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

        <Button
          testID={tid('auth', 'sign-in')}
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
            <Text className="text-[15px] font-display-semibold text-primary">
              New to Moni? Create an account
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </Page>
  );
}
