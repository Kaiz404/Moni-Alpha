import type { Metadata } from 'next';
import { WalletScreen } from '@/components/wallets/wallet-screen';

export const metadata: Metadata = { title: 'Wallet · Moni' };

export default async function WalletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WalletScreen id={id} />;
}
