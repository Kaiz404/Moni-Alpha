import type { Metadata } from 'next';
import { ReviewScreen } from '@/components/review/review-screen';

export const metadata: Metadata = { title: 'Review · Moni' };

export default function ReviewPage() {
  return <ReviewScreen />;
}
