import type { ReactNode } from 'react';
import { View } from 'react-native';

import { TintBubble } from '@/components/ui/transaction-row';
import { getWalletCardStyle } from '@/constants/wallet-card-styles';
import { resolveWalletIcon } from '@/constants/wallet-form';
import type { FinanceWallet } from '@/lib/finance/types';

/** The 32 tint circle that leads a capture field: the category, the wallet, the date. */
export function FieldBubble({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  return (
    <View
      className="h-8 w-8 items-center justify-center rounded-full"
      style={{ backgroundColor: color }}
    >
      {children}
    </View>
  );
}

export function WalletBubble({ wallet }: { wallet: FinanceWallet }) {
  return (
    <TintBubble
      size={32}
      icon={resolveWalletIcon(wallet.icon, wallet.type)}
      color={wallet.color ?? getWalletCardStyle(wallet.cardStyleId).swatchHex}
    />
  );
}
