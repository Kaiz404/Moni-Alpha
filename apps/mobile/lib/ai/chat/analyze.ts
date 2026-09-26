import { getAiClient } from '@/lib/ai/client';
import { buildFinanceFactsByCurrency, parseAskedAmount } from '@/lib/ai/facts';
import {
  buildFinanceAssistantToolSnapshotByCurrency,
  type BudgetRow,
  type ProposalForMetrics,
  type TxForMetrics,
} from '@/lib/ai/snapshot/finance-metrics';
import { financeProjection$ } from '@/lib/finance/projection';
import { getUserId } from '@/lib/supabase/client';
import { listRecurringOverrides } from '@/lib/supabase/recurring-overrides';
import { exportHistoryForApi } from './messages';

export type AnalyzeFinancesResult = { ok: true; reply: string } | { ok: false; reason: string };

export async function analyzeUserFinances(message: string): Promise<AnalyzeFinancesResult> {
  try {
    const userId = await getUserId();
    if (!userId) return { ok: false, reason: 'Not authenticated' };
    const projection = financeProjection$.peek();
    const transactions = Object.values(projection.transactionsById).filter(
      (transaction) => transaction.userId === userId,
    );
    const budgets = Object.values(projection.budgetsById).filter(
      (budget) => budget.userId === userId,
    );

    const categoryMap = Object.fromEntries(
      Object.values(projection.categoriesById)
        .filter((category) => category.userId === null || category.userId === userId)
        .map((category) => [category.id, category.name]),
    );
    const budgetRows: BudgetRow[] = budgets.map((b) => ({
      categoryId: b.categoryId,
      currency: b.currency,
      amountMinor: b.amountMinor,
    }));

    const txs: TxForMetrics[] = transactions.map((t) => ({
      amountMinor: t.amountMinor,
      currency: t.currency,
      analysisExcluded: t.analysisExcluded,
      type: (t.type ?? 'expense') as TxForMetrics['type'],
      categoryId: t.categoryId,
      merchant: t.merchant ?? null,
      transactionDate: t.transactionDate,
    }));

    // A proposal's currency is its wallet's; text and receipt proposals without one carry a placeholder.
    const proposals: ProposalForMetrics[] = Object.values(projection.proposalsById).flatMap((p) =>
      p.userId === userId && p.type
        ? [
            {
              amountMinor: p.amountMinor,
              currency: p.walletId
                ? (projection.walletsById[p.walletId]?.currency ?? null)
                : p.sourceType === 'notification'
                  ? p.currency
                  : null,
              type: p.type,
            },
          ]
        : [],
    );

    const now = new Date();
    const facts = buildFinanceFactsByCurrency(
      {
        wallets: Object.values(projection.walletsById).filter((w) => w.userId === userId),
        transactions,
        overrides: listRecurringOverrides(userId),
        categoryNames: categoryMap,
        askedAmount: parseAskedAmount(message),
      },
      now,
    );
    const snapshot = buildFinanceAssistantToolSnapshotByCurrency(
      txs,
      categoryMap,
      budgetRows,
      proposals,
      now,
      facts,
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
