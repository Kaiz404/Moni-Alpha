import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import Animated, {
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Surface } from '@/components/ui/surface';
import { TactilePressable } from '@/components/ui/tactile-pressable';
import { formatMinorAmount } from '@/lib/finance/money';
import { hapticBalanceConfirmed } from '@/lib/haptics';
import { confirmWalletBalance } from '@/lib/supabase/wallets';
import { useBalanceConfirmation } from '@/lib/wallets/balance-confirmation';

const rowTransition = LinearTransition.duration(200);

function checkedLabel(days: number | null): string {
  if (days === null) return 'Never checked';
  return `Checked ${days} days ago`;
}

/** Asks the user to confirm stale wallet balances so the chat forecast can show. */
export function ConfirmBalanceCard({
  className,
}: {
  className?: string;
}) {
  const { wallets, dismiss } = useBalanceConfirmation();
  if (!wallets.length) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(180)}
      className={className}
    >
      <Surface
        tone="peach"
        className="overflow-hidden"
      >
        <View className="flex-row items-start justify-between pl-4 pr-1 pt-3">
          <Text
            className="flex-1 pt-2.5 text-base font-display-bold text-foreground"
            accessibilityRole="header"
          >
            Confirm balances to unlock your forecast
          </Text>
          <TactilePressable
            className="min-h-11 justify-center px-3"
            onPress={dismiss}
            accessibilityLabel="Not now, ask again in a week"
          >
            <Text className="text-sm font-display-semibold text-muted">
              Not now
            </Text>
          </TactilePressable>
        </View>
        {wallets.map(
          ({ wallet, balanceMinor, daysSinceConfirmed }) => {
            const balance = formatMinorAmount(
              balanceMinor,
              wallet.currency,
            );
            return (
              <Animated.View
                key={wallet.id}
                exiting={FadeOut.duration(180)}
                layout={rowTransition}
                className="mt-3 border-t border-border px-4 pb-4 pt-3"
              >
                <View
                  className="flex-row items-baseline justify-between"
                  accessible
                  accessibilityLabel={`${wallet.name}, ${balance}, ${checkedLabel(daysSinceConfirmed).toLowerCase()}`}
                >
                  <View className="min-w-0 flex-1 pr-3">
                    <Text
                      className="text-base font-display-semibold text-foreground"
                      numberOfLines={1}
                    >
                      {wallet.name}
                    </Text>
                    <Text className="mt-1 text-xs text-muted">
                      {checkedLabel(daysSinceConfirmed)}
                    </Text>
                  </View>
                  <Text
                    className="text-base font-display-bold text-foreground"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {balance}
                  </Text>
                </View>
                <View className="mt-3 flex-row gap-2">
                  <PrimaryButton
                    className="flex-1"
                    variant="quiet"
                    label="Yes, that’s right"
                    accessibilityLabel={`Yes, ${wallet.name} is ${balance}`}
                    onPress={() => {
                      hapticBalanceConfirmed();
                      confirmWalletBalance(wallet.id);
                    }}
                  />
                  <PrimaryButton
                    variant="secondary"
                    label="Fix it"
                    accessibilityLabel={`Fix the ${wallet.name} balance`}
                    onPress={() =>
                      router.push({
                        pathname: '/wallet/[id]',
                        params: { id: wallet.id },
                      } as any)
                    }
                  />
                </View>
              </Animated.View>
            );
          },
        )}
      </Surface>
    </Animated.View>
  );
}
