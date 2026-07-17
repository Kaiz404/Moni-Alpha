import { getAiClient } from '@/lib/ai/client';
import { getCategoryBudgets } from '@/lib/supabase/category-budgets';
import { getCategoryNameRows } from '@/lib/supabase/categories';
import { getTransactions } from '@/lib/supabase/transactions';
import { getWallets } from '@/lib/supabase/wallets';
import {
  buildFinanceAssistantToolSnapshot,
  type BudgetRow,
  type TxForMetrics,
} from '@/lib/ai/snapshot/finance-metrics';
import { exportHistoryForApi } from './messages';

export type AnalyzeFinancesResult =
  | { ok: true; reply: string }
  | { ok: false; reason: string };

export async function analyzeUserFinances(
  message: string,
): Promise<AnalyzeFinancesResult> {
  try {
    const [txData, walletData, categoryRows, budgets] = await Promise.all([
      getTransactions(undefined, 8000),
      getWallets(),
      getCategoryNameRows(),
      getCategoryBudgets(),
    ]);

    const categoryMap = Object.fromEntries(
      categoryRows.map((row) => [row.id, row.name ?? 'Uncategorized']),
    );
    const currencyHint = walletData[0]?.currency?.trim() || 'USD';
    const budgetRows: BudgetRow[] = budgets.map((b) => ({
      categoryId: b.categoryId,
      currency: b.currency,
      amount: b.amount,
    }));

    const txs: TxForMetrics[] = txData.map((t) => ({
      amount: t.amount,
      currency: t.currency,
      analysisExcluded: t.analysisExcluded,
      type: (t.type ?? 'expense') as TxForMetrics['type'],
      categoryId: t.categoryId,
      merchant: t.merchant ?? null,
      transactionDate: t.transactionDate,
    }));

    const snapshot = buildFinanceAssistantToolSnapshot(
      txs,
      categoryMap,
      budgetRows,
      currencyHint,
    );

    const result = await getAiClient().analyzeFinances({
      message,
      snapshot,
      history: exportHistoryForApi(),
    });

    if (result.status === 'ok') {
      return { ok: true, reply: result.reply };
    }
    return { ok: false, reason: result.reason };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'Analysis failed',
    };
  }
}
