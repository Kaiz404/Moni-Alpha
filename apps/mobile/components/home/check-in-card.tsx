import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import { approve } from '@/lib/haptics';
import { confirmWalletBalance } from '@/lib/supabase/wallets';
import { tid } from '@/lib/test-ids';
import { useBalanceConfirmation } from '@/lib/wallets/balance-confirmation';

/** After an answer the card shows one line with Undo, then steps aside. */
type Answered =
  | { kind: 'right'; walletId: string; text: string; previousAt: string | null }
  | { kind: 'later'; text: string };

const ANSWERED_MS = 6000;

/** V2H-Home check-in: asks about one main-currency wallet whose balance has gone unchecked. */
export function CheckInCard({ currency }: { currency: string }) {
  const tokens = useThemeTokens();
  const { wallets, dismiss, restore } = useBalanceConfirmation();
  const [answered, setAnswered] = useState<Answered | null>(null);

  useEffect(() => {
    if (!answered) return;
    const timer = setTimeout(() => setAnswered(null), ANSWERED_MS);
    return () => clearTimeout(timer);
  }, [answered]);

  if (answered) {
    return (
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(180)}
        className="flex-row items-center gap-3 rounded-tile border-[1.5px] border-hairline py-2.5 pl-[18px] pr-2.5"
      >
        <Text
          testID={tid('home', 'check-in', 'done')}
          variant="meta"
          className="flex-1 text-ink-2"
        >
          {answered.text}
        </Text>
        <Press
          testID={tid('home', 'check-in', 'undo')}
          onPress={() => {
            if (answered.kind === 'right')
              confirmWalletBalance(answered.walletId, answered.previousAt);
            else restore();
            setAnswered(null);
          }}
          radius={{ rest: 22, pressed: 16 }}
          pressedClassName="bg-hairline"
          className="h-11 justify-center bg-sand px-4"
        >
          <Text className="text-[15px] font-display-semibold text-foreground">Undo</Text>
        </Press>
      </Animated.View>
    );
  }

  const due = wallets.find(({ wallet }) => wallet.currency === currency);
  if (!due) return null;
  const { wallet, balanceMinor, daysSinceConfirmed } = due;
  const balance = formatMoney(balanceMinor, wallet.currency);

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      className="gap-3 rounded-card bg-lemon p-[18px]"
    >
      <View className="gap-0.5">
        <Text
          variant="caps"
          className="text-on-pastel opacity-70"
        >
          {daysSinceConfirmed === null
            ? 'Check-in'
            : `Check-in · last done ${daysSinceConfirmed} days ago`}
        </Text>
        <Text
          variant="cardTitle"
          className="text-on-pastel"
          accessibilityRole="header"
        >
          {`Is ${wallet.name} still ${balance}?`}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Press
          testID={tid('home', 'check-in', 'right')}
          accessibilityLabel={`That's right, ${wallet.name} is ${balance}`}
          onPress={() => {
            approve();
            confirmWalletBalance(wallet.id);
            setAnswered({
              kind: 'right',
              walletId: wallet.id,
              previousAt: wallet.balanceConfirmedAt,
              text: `${wallet.name} is ${balance}. Thanks for checking.`,
            });
          }}
          radius={{ rest: 22, pressed: 16 }}
          pressedClassName="bg-mint-pressed"
          className="h-11 flex-row items-center gap-1.5 bg-mint px-3.5"
        >
          <IconSymbol
            name="check"
            size={18}
            color={tokens.onPastel}
          />
          <Text className="text-[15px] font-display-semibold text-on-pastel">{"That's right"}</Text>
        </Press>
        <Press
          testID={tid('home', 'check-in', 'fix')}
          accessibilityLabel={`Fix the ${wallet.name} balance`}
          onPress={() =>
            router.push({
              pathname: '/wallet/[id]',
              params: { id: wallet.id, edit: 'balance' },
            })
          }
          radius={{ rest: 22, pressed: 16 }}
          pressedClassName="bg-hairline"
          className="h-11 justify-center bg-sand px-3.5"
        >
          <Text className="text-[15px] font-display-semibold text-foreground">Fix it</Text>
        </Press>
        <Press
          testID={tid('home', 'check-in', 'not-now')}
          accessibilityLabel={`Not now, ask about ${wallet.name} next week`}
          onPress={() => {
            dismiss();
            setAnswered({
              kind: 'later',
              text: `Moni will ask about ${wallet.name} again next week.`,
            });
          }}
          pressedClassName="bg-transparent"
          className="ml-auto h-11 justify-center px-1"
        >
          <Text className="text-[15px] font-display-semibold text-on-pastel underline">
            Not now
          </Text>
        </Press>
      </View>
    </Animated.View>
  );
}
