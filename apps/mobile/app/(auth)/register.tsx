import { useState } from 'react';
import {
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { Link, router } from 'expo-router';

import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { FormField } from '@/components/ui/form-field';
import { useAuth } from '@/lib/auth/auth-context';
import { tid } from '@/lib/test-ids';
import { Button } from '@/components/ui/button';
import { Page } from '@/components/ui/page';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password || !displayName.trim()) {
      Alert.alert(
        'Add your details',
        'Complete all three fields to continue.',
      );
      return;
    }
    if (password.length < 8) {
      Alert.alert(
        'Use a longer password',
        'Your password needs at least 8 characters.',
      );
      return;
    }
    setLoading(true);
    const { error, session } = await signUp(
      email.trim(),
      password,
      displayName.trim(),
    );
    setLoading(false);
    if (error) {
      Alert.alert('Could not create your account', error.message);
    } else if (!session) {
      router.replace('/(auth)/login?verifyEmail=1' as any);
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <Page
      screen="auth"
      kind="pushed"
      title="Create account"
    >
      <ScrollView
        className="flex-1 px-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        <View className="mb-10">
          <Text className="text-[28px] font-display-bold leading-[34px] text-foreground">
            Start with a clearer view
          </Text>
        </View>

        <FormField
          testID={tid('auth', 'name')}
          label="Name"
          placeholder="How should Moni greet you?"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
        />
        <FormField
          testID={tid('auth', 'email')}
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <FormField
          testID={tid('auth', 'password')}
          label="Password"
          hint="At least 8 characters"
          placeholder="Choose a password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
        />

        <Button
          testID={tid('auth', 'create-account')}
          label="Create account"
          loading={loading}
          loadingLabel="Creating accountâ€¦"
          onPress={handleRegister}
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
          href={'/(auth)/login' as any}
          asChild
        >
          <TouchableOpacity
            className="mt-8 items-center py-3"
            accessibilityRole="button"
          >
            <Text className="text-[15px] font-display-semibold text-primary">
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </Page>
  );
}
