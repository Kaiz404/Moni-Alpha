import type { Metadata } from 'next';
import { Page, PageEmpty } from '@/components/shell/page';

export const metadata: Metadata = { title: 'Review · Moni' };

export default function ReviewPage() {
  return (
    <Page title="Review" phone="pushed">
      <PageEmpty
        mood="neutral"
        title="Nothing to review"
        line="New captures from notifications, receipts and chat wait here until you say yes."
      />
    </Page>
  );
}
