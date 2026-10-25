import { useSelector, useValue } from '@legendapp/state/react';
import { router } from 'expo-router';

import { ListSection } from '@/components/ui/list-card';
import { TransactionRow } from '@/components/ui/transaction-row';
import { useAuth } from '@/lib/auth/auth-context';
import { merchantName } from '@/lib/finance/merchant-name';
import { categoriesForUser$, transactions$, walletsForUser$ } from '@/lib/finance/selectors';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { tid } from '@/lib/test-ids';
import { transactionRow } from '@/lib/transactions/row';

/** How far back "Added for you" looks for rows Moni added without asking. */
const WINDOW_DAYS = 7;

/**
 * `XA-Review` "Added for you": the rows Moni added without asking (routine alerts and Don't ask
 * about similar), so they stay in sight next to the captures that wait.
 */
export function AddedForYou() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const transactions = useValue(transactions$({ userId }));
  const wallets = useValue(walletsForUser$(userId));
  const categories = useValue(categoriesForUser$(userId)) ?? [];
  const aliases = useSelector(() => (userId ? listMerchantAliases(userId) : []));

  const since = Date.now() - WINDOW_DAYS * 86_400_000;
  const added = transactions
    .filter((t) => t.autoAdded && new Date(t.transactionDate).getTime() >= since)
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  if (!added.length) return null;

  const lookups = {
    categoriesById: Object.fromEntries(categories.map((c) => [c.id, c])),
    walletNames: Object.fromEntries(wallets.map((w) => [w.id, w.name])),
  };
  return (
    <ListSection label="Added for you">
      {added.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          testID={tid('review', 'added', transaction.id)}
          row={transactionRow(
            { ...transaction, merchant: merchantName(transaction.merchant, aliases) },
            lookups,
          )}
          metaLead="date"
          onPress={() =>
            router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })
          }
        />
      ))}
    </ListSection>
  );
}
