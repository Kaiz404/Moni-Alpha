import type { FinanceAssistantToolSnapshot, RecurringOverride } from '@repo/types';

import type { Calendar } from '../calendar';
import type { FinanceProjection } from '../read-model/types';
import { buildFinanceFactsByCurrency, parseAskedAmount } from './facts';
import {
  buildFinanceAssistantToolSnapshotByCurrency,
  type BudgetForMetrics,
  type ProposalForMetrics,
} from './finance-metrics';

/** What Moni chat reads to answer one question. */
export type ChatSnapshotInput = {
  projection: Pick<
    FinanceProjection,
    'transactionsById' | 'budgetsById' | 'categoriesById' | 'proposalsById' | 'walletsById'
  >;
  userId: string;
  overrides: readonly RecurringOverride[];
  /** The question; an amount it asks to afford is tried in the forecast. */
  message: string;
  now: Date;
  calendar: Calendar;
};

/** The snapshot `POST /v1/chat/analyze` takes with a question: one block per currency. */
export function buildChatSnapshot({
  projection,
  userId,
  overrides,
  message,
  now,
  calendar,
}: ChatSnapshotInput): FinanceAssistantToolSnapshot {
  const transactions = Object.values(projection.transactionsById).filter(
    (transaction) => transaction.userId === userId,
  );
  const categoryNames = Object.fromEntries(
    Object.values(projection.categoriesById)
      .filter((category) => category.userId === null || category.userId === userId)
      .map((category) => [category.id, category.name]),
  );
  const budgets: BudgetForMetrics[] = Object.values(projection.budgetsById)
    .filter((budget) => budget.userId === userId)
    .map((budget) => ({
      categoryId: budget.categoryId,
      currency: budget.currency,
      amountMinor: budget.amountMinor,
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

  const facts = buildFinanceFactsByCurrency(
    {
      wallets: Object.values(projection.walletsById).filter((w) => w.userId === userId),
      transactions,
      overrides,
      categoryNames,
      askedAmount: parseAskedAmount(message),
    },
    now,
    calendar,
  );
  return buildFinanceAssistantToolSnapshotByCurrency({
    transactions,
    categoryNames,
    budgets,
    proposals,
    facts,
    now,
    calendar,
  });
}
