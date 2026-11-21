import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/icon-symbol';
import type { BubbleTint } from '@/components/ui/nav-row';
import { Press, type PressProps } from '@/components/ui/press';
import { Text } from '@/components/ui/text';
import { resolveWalletIcon } from '@/constants/wallet-form';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import type { TestId } from '@/lib/test-ids';
import { type FinanceWallet, walletTint } from '@repo/core';

/** A wallet's colour as a fill: its 42 list bubble and its Home card. */
export const WALLET_TINT_CLASS: Record<BubbleTint, string> = {
  sand: 'bg-sand',
  mint: 'bg-mint',
  lemon: 'bg-lemon',
  lilac: 'bg-lilac',
  peach: 'bg-peach',
  coral: 'bg-coral',
  sky: 'bg-sky',
  aqua: 'bg-aqua',
};

export const WALLET_CARD_WIDTH = 148;
export const WALLET_CARD_HEIGHT = 96;

/**
 * XW-WalletCardStyle-Final: soft blobs in the wallet's colour (white at 42% top right, black at 12% bottom
 * right), a type badge, the name and the balance in its own currency. The card keeps one size.
 */
export function WalletCard({
  testID,
  wallet,
  name,
  balance,
  onPress,
  ...accessibility
}: {
  testID: TestId;
  wallet: FinanceWallet;
  /** The short name rows use: "Maybank" for "Maybank Savings". */
  name: string;
  balance: string;
  onPress: () => void;
} & Pick<PressProps, 'accessibilityActions' | 'onAccessibilityAction'>) {
  const tokens = useThemeTokens();
  const tint = walletTint(wallet.cardStyleId, wallet.type);
  return (
    <Press
      testID={testID}
      accessibilityLabel={`${wallet.name}, ${balance}`}
      onPress={onPress}
      {...accessibility}
      pressedClassName="bg-transparent"
      className={`h-[96px] w-[148px] overflow-hidden rounded-[22px] ${WALLET_TINT_CLASS[tint]}`}
    >
      <Svg
        width={WALLET_CARD_WIDTH}
        height={WALLET_CARD_HEIGHT}
        viewBox={`0 0 ${WALLET_CARD_WIDTH} ${WALLET_CARD_HEIGHT}`}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <Path
          d="M92,-18 C122,-26 162,-6 158,30 C155,58 128,62 112,50 C96,38 70,40 66,18 C63,2 74,-12 92,-18 Z"
          fill="#ffffff"
          fillOpacity={0.42}
        />
        <Path
          d="M108,70 C126,58 160,64 162,88 C164,112 132,118 112,110 C94,103 92,80 108,70 Z"
          fill="#000000"
          fillOpacity={0.12}
        />
      </Svg>
      <View className="absolute left-3 right-3 top-3 flex-row items-center gap-2">
        <View className="h-[26px] w-[26px] items-center justify-center rounded-[8px] bg-primary-foreground">
          <IconSymbol
            name={resolveWalletIcon(null, wallet.type)}
            size={16}
            color={tokens.primary}
          />
        </View>
        <Text
          numberOfLines={1}
          className="min-w-0 flex-1 text-[14px] leading-[18px] font-display-semibold text-on-category"
        >
          {name}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        className="absolute bottom-3 left-3.5 right-3 text-[18px] leading-[22px] font-display-bold text-on-category"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {balance}
      </Text>
    </Press>
  );
}
