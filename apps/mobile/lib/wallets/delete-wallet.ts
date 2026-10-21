import { openSheet } from '@/lib/sheet/sheet-store';
import { deleteWallet } from '@/lib/supabase/wallets';

function deleteMessage(transactionCount: number): string {
  const rest = "and your totals change. This can't be undone.";
  if (transactionCount === 0) return "This can't be undone.";
  if (transactionCount === 1) return `Its 1 transaction goes too, ${rest}`;
  return `Its ${transactionCount} transactions go too, ${rest}`;
}

/**
 * Asks first, then soft-deletes the wallet and its transactions. The wallet
 * page closes itself once its wallet is gone, so callers only leave their own page.
 */
export async function confirmDeleteWallet(
  wallet: { id: string; name: string },
  transactionCount: number,
): Promise<boolean> {
  const confirmed = await openSheet({
    kind: 'confirm',
    title: `Delete ${wallet.name}?`,
    message: deleteMessage(transactionCount),
    confirmLabel: 'Delete',
    cancelLabel: 'Keep it',
    destructive: true,
  });
  if (!confirmed) return false;
  await deleteWallet(wallet.id);
  return true;
}
