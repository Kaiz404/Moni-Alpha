import { useValue } from '@legendapp/state/react';
import type { AutoAddRule } from '@repo/types';

import { guessMerchantName } from '@/components/merchants/merchant-list';
import { merchantKey } from '@/lib/ai/routine';
import { useAuth } from '@/lib/auth/auth-context';
import { categories$, transactions$, wallets$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import { listAutoAddRules } from '@/lib/supabase/auto-add-rules';
import { listMerchantAliases } from '@/lib/supabase/merchant-aliases';
import { resolveTransactionIcon, type TransactionIconName } from '@/lib/transactions/icon';

/** An auto-add rule as ADDED WITHOUT ASKING lists it. */
export type AutoAddRuleRow = {
  rule: AutoAddRule;
  name: string;
  meta: string;
  icon: TransactionIconName;
  color: string | null;
};

type TransactionRow = {
  user_id?: string | null;
  wallet_id?: string | null;
  merchant?: string | null;
  transaction_date?: string | null;
  metadata?: string | Record<string, unknown> | null;
};

function autoAdded(metadata: TransactionRow['metadata']): boolean {
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    return (parsed as { ai_suggested?: unknown } | null)?.ai_suggested === true;
  } catch {
    return false;
  }
}

export function useAutoAddRules(now: Date = new Date()): AutoAddRuleRow[] {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return useValue(() => {
    if (!userId) return [];
    const aliases = new Map(
      listMerchantAliases(userId).map((alias) => [alias.rawKey, alias.displayName]),
    );
    const categories = (categories$.get() ?? {}) as Record<
      string,
      { name?: string | null; icon?: string | null; color?: string | null } | undefined
    >;
    const walletNames = new Map(
      getRecordValues<{ id: string; name?: string | null }>(wallets$).map((wallet) => [
        wallet.id,
        wallet.name ?? '',
      ]),
    );
    const addedThisMonth = new Map<string, number>();
    for (const row of getRecordValues<TransactionRow>(transactions$)) {
      if (row.user_id !== userId || !row.transaction_date?.startsWith(month)) continue;
      if (!autoAdded(row.metadata)) continue;
      const key = `${row.wallet_id}|${merchantKey(row.merchant ?? null)}`;
      addedThisMonth.set(key, (addedThisMonth.get(key) ?? 0) + 1);
    }

    return listAutoAddRules(userId)
      .map((rule): AutoAddRuleRow => {
        const category = categories[rule.categoryId];
        const added = addedThisMonth.get(`${rule.walletId}|${rule.merchantKey}`) ?? 0;
        return {
          rule,
          name:
            aliases.get(rule.merchantKey) ??
            guessMerchantName(rule.merchantKey) ??
            rule.merchantKey.toUpperCase(),
          meta:
            added > 0
              ? `${added} added this month`
              : [category?.name, walletNames.get(rule.walletId)].filter(Boolean).join(' · '),
          icon: category?.icon
            ? resolveTransactionIcon(category.icon, 'expense')
            : 'storefront-outline',
          color: category?.color ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}
