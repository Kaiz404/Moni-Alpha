import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { LoginStatus } from '@/lib/auth/login-mode';

/** The inline error line under the fields: wrong details, or a form problem in words. */
export function LoginError({ message }: { message: string }) {
  const tokens = useThemeTokens();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="flex-row gap-2"
    >
      <IconSymbol
        name="alert-circle-outline"
        size={16}
        color={tokens.over}
        style={{ lineHeight: 18 }}
      />
      <Text
        variant="meta"
        className="min-w-0 flex-1 text-over"
      >
        {message}
      </Text>
    </View>
  );
}

/** The V2H-Login state frames that sit above the form. */
export function LoginNotice({ status }: { status: LoginStatus }) {
  const tokens = useThemeTokens();
  switch (status.kind) {
    case 'confirmEmail':
      return (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="flex-row items-start gap-3.5 rounded-card bg-lilac p-[18px]"
        >
          <View className="h-[42px] w-[42px] items-center justify-center rounded-full bg-card">
            <IconSymbol
              name="email-check-outline"
              size={20}
              color={tokens.foreground}
            />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text
              variant="cardTitle"
              className="text-on-pastel"
            >
              Confirm your email
            </Text>
            <Text
              variant="body"
              className="text-on-pastel"
            >
              {`Open the link we sent to ${status.email}, then come back here to sign in.`}
            </Text>
          </View>
        </View>
      );
    case 'googleDidNotFinish':
      return (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="flex-row items-start gap-3 rounded-tile bg-attention-fill px-4 py-3.5"
        >
          <IconSymbol
            name="alert-outline"
            size={20}
            color={tokens.states.attention}
          />
          <Text
            variant="body"
            className="min-w-0 flex-1 text-foreground"
          >
            {"Google sign-in didn't finish. Try again, or use your email and a password."}
          </Text>
        </View>
      );
    case 'offline':
      return (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="flex-row items-start gap-3 rounded-tile border-[1.5px] border-hairline px-4 py-3.5"
        >
          <IconSymbol
            name="wifi-off"
            size={20}
            color={tokens.ink2}
          />
          <Text
            variant="body"
            className="min-w-0 flex-1 text-ink-2"
          >
            {"You're offline. Signing in needs a connection, so try again once you're back online."}
          </Text>
        </View>
      );
    default:
      return null;
  }
}
