'use client';

import { DeleteAccountForm } from '@/components/account/delete-account-form';
import { useShellApi } from '@/components/shell/shell-context';

export function DeleteSection() {
  const { user } = useShellApi();
  return (
    <section className="set-card" aria-labelledby="delete-title">
      <h2 id="delete-title" className="set-title">
        Delete your account
      </h2>
      <DeleteAccountForm cancelHref="/settings/profile" userId={user.id} zone={user.zone} />
    </section>
  );
}
