import { useMemo } from 'react';
import { useSelector } from '@legendapp/state/react';

import { useAuth } from '@/lib/auth/auth-context';
import { categories$, transactions$, wallets$ } from '@/lib/store';
import { getRecordValues } from '@/lib/store/helpers';
import {
  buildCategoryNameMap,
  buildLineData,
  buildPieData,
  buildSummaryWallets,
  buildUsageBarData,
  type ChartPoint,
  type SummaryWallet,
} from '@/lib/summary/aggregates';

type WalletRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  color: string | null;
  icon: string | null;
  currency: string | null;
  initial_balance: string | number | null;
  is_active: boolean | number | null;
  display_order: number | null;
};

type CategoryRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  is_active: boolean | number | null;
};

type TransactionRow = {
  wallet_id?: string | null;
  transfer_to_wallet_id?: string | null;
  amount?: string | number | null;
  type?: string | null;
  category_id?: string | null;
  transaction_date?: string | null;
  created_at?: string | null;
};

export function useSummaryData(): {
  wallets: SummaryWallet[];
  categoryMap: Record<string, string>;
  pieData: ChartPoint[];
  lineData: ChartPoint[];
  usageBarData: ChartPoint[];
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const walletRows = useSelector(() => getRecordValues<WalletRow>(wallets$));
  const transactionRows = useSelector(() => getRecordValues<TransactionRow>(transactions$));
  const categoryRows = useSelector(() => getRecordValues<CategoryRow>(categories$));

  const wallets = useMemo(
    () => buildSummaryWallets(walletRows, transactionRows, userId),
    [walletRows, transactionRows, userId],
  );

  const categoryMap = useMemo(
    () => buildCategoryNameMap(categoryRows, userId),
    [categoryRows, userId],
  );

  const pieData = useMemo(
    () => buildPieData(transactionRows, categoryMap),
    [transactionRows, categoryMap],
  );

  const lineData = useMemo(
    () => buildLineData(transactionRows, wallets),
    [transactionRows, wallets],
  );

  const usageBarData = useMemo(
    () => buildUsageBarData(wallets, transactionRows),
    [wallets, transactionRows],
  );

  return {
    wallets,
    categoryMap,
    pieData,
    lineData,
    usageBarData,
  };
}
