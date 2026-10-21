import type { ViewProps } from 'react-native';

import type { WalletCardStyle } from '@/constants/wallet-card-styles';
import { View } from 'react-native';

type SolidWalletCardProps = ViewProps & {
  cardStyle: WalletCardStyle;
  /** Tailwind radius/height/etc utilities for the outer card. */
  className?: string;
};

/** Solid, squircle-edged surface for wallet balances and wallet-style previews. */
export function SolidWalletCard({
  cardStyle,
  className,
  children,
  style,
  ...props
}: SolidWalletCardProps) {
  return (
    <View
      className={`overflow-hidden rounded-[28px] ${className ?? ''}`}
      style={[{ backgroundColor: cardStyle.backgroundColor }, style]}
      {...props}
    >
      {children}
    </View>
  );
}
