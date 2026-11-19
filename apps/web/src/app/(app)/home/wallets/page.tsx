import type { Metadata } from 'next';
import { WalletsScreen } from '@/components/wallets/wallets-screen';

export const metadata: Metadata = { title: 'Wallets | Moni' };

export default function WalletsPage() {
  return <WalletsScreen />;
}
