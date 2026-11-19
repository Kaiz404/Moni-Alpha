import type { Metadata } from 'next';
import { DeleteAccountForm } from '@/components/account/delete-account-form';

export const metadata: Metadata = {
  title: 'Delete your account · Moni',
};

/** Settings › Profile › Delete your account: the W2-Parts flow beside the section nav, pushed over Profile on the phone. */
export default function DeleteAccountSettingsPage() {
  return (
    <section className="set-card" aria-labelledby="delete-title">
      <h2 id="delete-title" className="set-title">
        Delete your account
      </h2>
      <DeleteAccountForm cancelHref="/settings/profile" />
    </section>
  );
}
