import type { Metadata } from 'next';
import { MerchantsSection } from '@/components/settings/merchants-section';

export const metadata: Metadata = { title: 'Merchant names | Moni' };

export default function MerchantNamesPage() {
  return <MerchantsSection />;
}
