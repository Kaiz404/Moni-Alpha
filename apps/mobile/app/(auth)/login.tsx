import { router } from 'expo-router';
import { useReducer, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { LoginError, LoginNotice } from '@/components/auth/login-notice';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { Press } from '@/components/ui/press';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useAuth } from '@/lib/auth/auth-context';
import {
  checkDetails,
  initialLoginState,
  loginReducer,
  type LoginMode,
} from '@/lib/auth/login-mode';
import { tid } from '@/lib/test-ids';

const MODES = [
  { value: 'signIn', label: 'Sign in' },
  { value: 'createAccount', label: 'Create account' },
] as const satisfies readonly { value: LoginMode; label: string }[];

const WRONG_DETAILS =
  "That email and password don't match. Check both and try again.";

/** V2H-Login: sign in and account creation on one page, switched by the mode toggle. */
export default function LoginScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const tokens = useThemeTokens();
  const [{ mode, status }, dispatch] = useReducer(
    loginReducer,
    initialLoginState,
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const creating = mode === 'createAccount';
  const busy = status.kind === 'busy';
  const wrong = status.kind === 'wrongDetails';

  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    dispatch({ type: 'edited' });
  };

  const submit = async () => {
    const problem = checkDetails(mode, { name, email, password });
    if (problem) {
      dispatch({ type: 'rejected', status: problem });
      return;
    }
    dispatch({ type: 'started', via: 'password' });
    const address = email.trim();
    if (creating) {
      const { error, session } = await signUp(address, password, name.trim());
      if (error) {
        dispatch({ type: 'passwordFailed', message: error.message, email: address });
      } else if (!session) {
        setPassword('');
        dispatch({ type: 'accountNeedsConfirmation', email: address });
      } else {
        dispatch({ type: 'signedIn' });
        router.replace('/(tabs)');
      }
      return;
    }
    const { error } = await signIn(address, password);
    if (error) {
      dispatch({ type: 'passwordFailed', message: error.message, email: address });
      return;
    }
    dispatch({ type: 'signedIn' });
    router.replace('/(tabs)');
  };

  const continueWithGoogle = async () => {
    dispatch({ type: 'started', via: 'google' });
    const { error } = await signInWithGoogle();
    if (error) {
      dispatch({ type: 'googleFailed', message: error.message });
      return;
    }
    dispatch({ type: 'signedIn' });
    router.replace('/(tabs)');
  };

  return (
    <Page
      screen="auth"
      kind="bare"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-0.5">
          <Text
            className="text-[40px] leading-[40px] font-display-bold text-foreground"
            accessibilityRole="header"
          >
            Moni
          </Text>
          <Text
            variant="body"
            className="text-ink-2"
          >
            {"Know what's safe to spend."}
          </Text>
        </View>

        <View className="mt-3">
          <Segmented
            screen="auth"
            name="mode"
            accessibilityLabel="Sign in or create an account"
            options={MODES}
            value={mode}
            disabled={busy}
            onChange={(next) => dispatch({ type: 'setMode', mode: next })}
          />
        </View>

        <Text
          variant="screenTitle"
          className="text-foreground"
        >
          {creating ? 'Start with a clearer view' : 'Welcome back'}
        </Text>

        <LoginNotice status={status} />

        <View className="gap-4">
          {creating ? (
            <AuthField
              testID={tid('auth', 'name')}
              label="Name"
              placeholder="How should Moni greet you?"
              value={name}
              onChangeText={edit(setName)}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              editable={!busy}
            />
          ) : null}
          <AuthField
            ref={emailRef}
            testID={tid('auth', 'email')}
            label="Email"
            icon="email-outline"
            placeholder="you@example.com"
            value={email}
            onChangeText={edit(setEmail)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!busy}
          />
          <AuthField
            ref={passwordRef}
            testID={tid('auth', 'password')}
            label="Password"
            icon="lock-outline"
            placeholder={creating ? 'Choose a password' : 'Your password'}
            hint={creating ? 'At least 8 characters' : undefined}
            invalid={wrong}
            value={password}
            onChangeText={edit(setPassword)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={creating ? 'password-new' : 'password'}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            editable={!busy}
            trailing={
              <Press
                testID={tid('auth', 'password', 'reveal')}
                onPress={() => setShowPassword((shown) => !shown)}
                accessibilityLabel={
                  showPassword ? 'Hide password' : 'Show password'
                }
                className="h-11 w-11 items-center justify-center rounded-full"
              >
                <IconSymbol
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={tokens.ink2}
                />
              </Press>
            }
          />
          {wrong ? <LoginError message={WRONG_DETAILS} /> : null}
          {status.kind === 'failed' ? (
            <LoginError message={status.message} />
          ) : null}
          <Button
            testID={tid('auth', creating ? 'create-account' : 'sign-in')}
            className="mt-2"
            label={creating ? 'Create account' : 'Sign in'}
            loading={busy && status.via === 'password'}
            loadingLabel={creating ? 'Creating account…' : 'Signing in…'}
            disabled={busy && status.via === 'google'}
            onPress={() => void submit()}
          />
        </View>

        <GoogleSignInButton
          busy={busy && status.via === 'google'}
          disabled={busy && status.via === 'password'}
          onPress={() => void continueWithGoogle()}
        />

        <Button
          testID={tid('auth', 'swap-mode')}
          variant="tertiary"
          className="self-center"
          label={
            creating
              ? 'Already have an account? Sign in'
              : 'New to Moni? Create an account'
          }
          onPress={() =>
            !busy &&
            dispatch({
              type: 'setMode',
              mode: creating ? 'signIn' : 'createAccount',
            })
          }
        />
      </ScrollView>
    </Page>
  );
}
