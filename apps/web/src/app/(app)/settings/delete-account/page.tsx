import type { Metadata } from 'next';
import { DeleteSection } from '@/components/settings/delete-section';

export const metadata: Metadata = {
  title: 'Delete your account · Moni',
};

/** Settings › Profile › Delete your account: the W2-Parts flow beside the section nav, pushed over Profile on the phone. */
export default function DeleteAccountSettingsPage() {
  return <DeleteSection />;
}
