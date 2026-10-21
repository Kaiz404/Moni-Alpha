import { useValue } from '@legendapp/state/react';

import {
  merchantNameList,
  type MerchantEntry,
  type MerchantPayment,
} from '@/components/merchants/merchant-list';
import { useAuth } from '@/lib/auth/auth-context';
import { categories$, transactions$, wallets$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { resolveTransactionIcon, type TransactionIconName } from '@/lib/transactions/icon';

export type MerchantRow = MerchantEntry & { icon: TransactionIconName; color: string | null };

type TransactionRow = {
  user_id?: string | null;
  wallet_id?: string | null;
  category_id?: string | null;
  merchant?: string | null;
  transaction_date?: string | null;
  created_at?: string | null;
  metadata?: string | Record<string, unknown> | null;
};

function capturedFromAlert(metadata: TransactionRow['metadata']): boolean {
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    return (parsed as { source?: unknown } | null)?.source === 'notification';
  } catch {
    return false;
  }
}

/**
 * Merchant names, live from the store: codes to name and the names given. Profile shows
 * `toName.length` ("1 bank code to name") and `named.length` ("4 named").
 */
export function useMerchantNames(): { toName: MerchantRow[]; named: MerchantRow[] } {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useValue(() => {
    if (!userId) return { toName: [], named: [] };
    const payments: MerchantPayment[] = [];
    for (const row of getRecordValues<TransactionRow>(transactions$)) {
      if (row.user_id !== userId || !row.merchant) continue;
      payments.push({
        merchant: row.merchant,
        walletId: row.wallet_id ?? '',
        categoryId: row.category_id ?? null,
        transactionDate: row.transaction_date ?? row.created_at ?? '',
        fromAlert: capturedFromAlert(row.metadata),
      });
    }
    const walletNames: Record<string, string> = {};
    for (const wallet of getRecordValues<{ id: string; name?: string | null }>(wallets$)) {
      walletNames[wallet.id] = wallet.name ?? '';
    }
    const categories = categories$.get() as
      | Record<string, { icon?: string | null; color?: string | null } | undefined>
      | undefined;
    const withLook = (entry: MerchantEntry): MerchantRow => {
      const category = entry.categoryId ? categories?.[entry.categoryId] : undefined;
      return {
        ...entry,
        icon: category?.icon
          ? resolveTransactionIcon(category.icon, 'expense')
          : 'storefront-outline',
        color: category?.color ?? null,
      };
    };
    const list = merchantNameList(payments, listMerchantAliases(userId), walletNames);
    return { toName: list.toName.map(withLook), named: list.named.map(withLook) };
  });
}
