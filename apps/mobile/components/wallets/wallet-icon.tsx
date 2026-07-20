import type { ColorValue } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { resolveWalletIcon } from '@/constants/wallet-form';

type WalletIconProps = {
  icon?: string | null;
  type?: string | null;
  size?: number;
  color: ColorValue;
};

export function WalletIcon({
  icon,
  type,
  size = 16,
  color,
}: WalletIconProps) {
  return (
    <IconSymbol
      color={color}
      name={resolveWalletIcon(icon, type)}
      size={size}
    />
  );
}
