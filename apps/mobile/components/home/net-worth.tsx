import { View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Press } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { formatMoney } from '@/lib/finance/format-money';
import { tid } from '@/lib/test-ids';

/** Net worth: main-currency wallets only. Opens Wallets; on first run it explains itself instead. */
export function NetWorth({
  amountMinor,
  currency,
  firstRun,
  onPress,
}: {
  amountMinor: number;
  currency: string;
  firstRun: boolean;
  onPress: () => void;
}) {
  const tokens = useThemeTokens();
  const amount = formatMoney(amountMinor, currency);
  if (firstRun)
    return (
      <View className="py-0.5">
        <Text
          variant="caps"
          className="text-muted"
        >
          Net worth
        </Text>
        <Text
          testID={tid('home', 'net-worth', 'amount')}
          variant="amountHero"
          className="text-muted"
        >
          {amount}
        </Text>
        <Text
          variant="body"
          className="text-ink-2"
        >
          Add a wallet and Moni adds up what you have.
        </Text>
      </View>
    );
  return (
    <Press
      testID={tid('home', 'net-worth')}
      accessibilityLabel={`Net worth ${amount}, open wallets`}
      onPress={onPress}
      pressedClassName="bg-transparent"
      className="self-start py-0.5"
    >
      <View className="flex-row items-center gap-0.5">
        <Text
          variant="caps"
          className="text-muted"
        >
          Net worth
        </Text>
        <IconSymbol
          name="chevron-right"
          size={16}
          color={tokens.muted}
        />
      </View>
      <Text
        testID={tid('home', 'net-worth', 'amount')}
        variant="amountHero"
        className="text-foreground"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {amount}
      </Text>
    </Press>
  );
}
