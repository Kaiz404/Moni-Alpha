import type { Metadata } from 'next';
import { DeleteAccountForm } from '@/components/account/delete-account-form';
import { Page } from '@/components/shell/page';

export const metadata: Metadata = {
  title: 'Delete your account · Moni',
};

/** Settings › Delete your account: the W2-Parts flow inside the shell, pushed over Settings on the phone. */
export default function DeleteAccountSettingsPage() {
  return (
    <Page title="Delete your account" sub="Settings" phone="pushed" back="/settings">
      <DeleteAccountForm cancelHref="/settings" />
    </Page>
  );
}
