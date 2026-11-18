import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Page } from '@/components/ui/page';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import {
  approveWebSignIn,
  checkWebSignIn,
  type FunctionResult,
} from '@/lib/auth/account-functions';
import { tid } from '@/lib/test-ids';
import { showToast } from '@/lib/toast/toast-store';

type Step =
  | { kind: 'checking' }
  | { kind: 'asking'; browser: string; approving: boolean }
  | { kind: 'failed'; message: string };

function failure(result: Exclude<FunctionResult<unknown>, { kind: 'ok' }>): Step {
  if (result.kind === 'unreachable') {
    return { kind: 'failed', message: "Couldn't reach Moni. Check your connection and scan again." };
  }
  if (result.status === 410) return { kind: 'failed', message: 'This code has expired. Scan the new one.' };
  if (result.status === 409) return { kind: 'failed', message: 'This code was already used. Scan the new one.' };
  return { kind: 'failed', message: result.message };
}

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

/** `moni://sign-in?code=…`, from Scan to sign in or a link: asks before signing a browser in. */
export default function WebSignInScreen() {
  const tokens = useThemeTokens();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [step, setStep] = useState<Step>(
    code ? { kind: 'checking' } : { kind: 'failed', message: "That isn't a Moni sign-in code." },
  );

  useEffect(() => {
    if (!code) return;
    let live = true;
    void checkWebSignIn(code).then((result) => {
      if (!live) return;
      setStep(result.kind === 'ok' ? { kind: 'asking', browser: result.data.browser, approving: false } : failure(result));
    });
    return () => {
      live = false;
    };
  }, [code]);

  const approve = async () => {
    if (!code || step.kind !== 'asking') return;
    setStep({ ...step, approving: true });
    const result = await approveWebSignIn(code);
    if (result.kind !== 'ok') {
      setStep(failure(result));
      return;
    }
    showToast({ text: `Signed in on ${step.browser}` });
    leave();
  };

  return (
    <Page
      screen="profile"
      kind="pushed"
      title="Sign in on the web"
    >
      <View className="flex-1 justify-between px-5 pb-6">
        <View className="items-center gap-4 pt-10">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-aqua">
            <IconSymbol
              name={step.kind === 'failed' ? 'timer-sand' : 'monitor'}
              size={30}
              color={tokens.onCategory}
            />
          </View>
          {step.kind === 'checking' ? (
            <Text
              variant="body"
              className="text-center text-ink-2"
            >
              Checking the code
            </Text>
          ) : step.kind === 'asking' ? (
            <>
              <Text
                variant="sectionTitle"
                className="text-center text-foreground"
                testID={tid('profile', 'web-sign-in', 'question')}
              >
                {`Sign in on ${step.browser}?`}
              </Text>
              <Text
                variant="body"
                className="text-center text-ink-2"
              >
                That browser opens your Moni account. Approve only a code you just scanned from your own screen.
              </Text>
            </>
          ) : (
            <Text
              variant="body"
              className="text-center text-foreground"
              accessibilityLiveRegion="polite"
            >
              {step.message}
            </Text>
          )}
        </View>

        {step.kind === 'failed' ? (
          <Button
            testID={tid('profile', 'web-sign-in', 'scan-again')}
            icon="qrcode-scan"
            label="Scan again"
            onPress={() => router.replace('/sign-in/scan')}
          />
        ) : (
          <View className="flex-row gap-2.5">
            <Button
              testID={tid('profile', 'web-sign-in', 'cancel')}
              variant="secondary"
              label="Cancel"
              onPress={leave}
            />
            <Button
              testID={tid('profile', 'web-sign-in', 'approve')}
              label="Sign in"
              loadingLabel="Signing in"
              loading={step.kind === 'asking' && step.approving}
              disabled={step.kind !== 'asking'}
              onPress={() => void approve()}
              className="flex-1"
            />
          </View>
        )}
      </View>
    </Page>
  );
}
