import { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { FormField } from '@/components/ui/form-field';
import { IconAction } from '@/components/ui/icon-action';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ScreenShell } from '@/components/ui/screen-shell';
import { useAuth } from '@/lib/auth/auth-context';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();
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
    <ScreenShell variant="canvas">
      <View
        className="px-5"
        style={{ paddingTop: Math.max(insets.top, 20) }}
      >
        <IconAction
          accessibilityLabel="Return to sign in"
          icon="arrow-left"
          onPress={() => router.back()}
        />
      </View>

      <ScrollView
        className="flex-1 px-6 pt-7"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        <View className="mb-10">
          <Text className="text-[28px] font-bold leading-[34px] text-foreground">
            Start with a clearer view
          </Text>
          <Text className="mt-2 max-w-md text-[16px] leading-[22px] text-muted">
            Create a Moni account to keep your personal finance setup
            in sync while retaining a local-first experience.
          </Text>
        </View>

        <FormField
          label="Name"
          placeholder="How should Moni greet you?"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
        />
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
          hint="At least 8 characters"
          placeholder="Choose a password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
        />

        <PrimaryButton
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
            <Text className="text-[15px] font-semibold text-primary">
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </ScreenShell>
  );
}
