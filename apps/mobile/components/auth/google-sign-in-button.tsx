import { Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { isGoogleSignInConfigured } from '@/lib/auth/google-signin';
import { tid } from '@/lib/test-ids';

type GoogleSignInButtonProps = {
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
};

/** The "or" rule and the Sand **Continue with Google** capsule; hidden where Google sign-in is not set up. */
export function GoogleSignInButton({
  onPress,
  busy,
  disabled,
}: GoogleSignInButtonProps) {
  if (Platform.OS === 'web' || !isGoogleSignInConfigured()) return null;
  return (
    <>
      <View
        className="flex-row items-center gap-3"
        importantForAccessibility="no-hide-descendants"
      >
        <View className="h-[1.5px] flex-1 bg-hairline" />
        <Text
          variant="meta"
          className="text-muted"
        >
          or
        </Text>
        <View className="h-[1.5px] flex-1 bg-hairline" />
      </View>
      <Button
        testID={tid('auth', 'continue-with-google')}
        variant="secondary"
        icon="google"
        label="Continue with Google"
        loading={busy}
        loadingLabel="Opening Google…"
        disabled={disabled}
        onPress={onPress}
      />
    </>
  );
}
