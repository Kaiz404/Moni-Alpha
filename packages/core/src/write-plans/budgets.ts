import { minorToDecimal, type CurrencyCode, type MinorAmount } from '@repo/types';

import { combine, planned, refused, type PlanContext, type Planned, type StoredRow } from './types';

/** A category's budget as stored, soft-deleted rows included: the table is unique on user, category and currency across them. */
export type BudgetRow = StoredRow<'category_budgets'>;

/** One category's monthly budget in one currency; null clears it. */
export type BudgetInput = {
  categoryId: string;
  currency: CurrencyCode;
  amountMinor: MinorAmount | null;
};

function sameKey(row: BudgetRow, userId: string, input: BudgetInput): boolean {
  return (
    row.user_id === userId &&
    row.category_id === input.categoryId &&
    String(row.currency ?? '').toUpperCase() === input.currency
  );
}

/**
 * Sets, changes or clears one category's budget. A cleared budget is soft-deleted; setting it again
 * revives that row, since the table's key also holds deleted rows.
 */
export function planCategoryBudget(
  rows: readonly BudgetRow[],
  input: BudgetInput,
  ctx: Pick<PlanContext, 'userId' | 'now' | 'newId'>,
): Planned<null> {
  const { amountMinor } = input;
  if (amountMinor !== null && (!Number.isSafeInteger(amountMinor) || amountMinor < 0)) {
    return refused('A budget is a positive amount');
  }
  const existing = rows.find((row) => sameKey(row, ctx.userId, input));
  const live = existing && !existing.deleted ? existing : undefined;
  if (amountMinor === null || amountMinor === 0) {
    return live
      ? planned({ softDelete: [{ table: 'category_budgets', id: live.id, at: ctx.now }] }, null)
      : planned({}, null);
  }
  const amount = minorToDecimal(amountMinor);
  if (live) {
    return planned(
      { patch: [{ table: 'category_budgets', id: live.id, patch: { amount, updated_at: ctx.now } }] },
      null,
    );
  }
  const row: BudgetRow = existing
    ? { ...existing, amount, deleted: false, updated_at: ctx.now }
    : {
        id: ctx.newId(),
        user_id: ctx.userId,
        category_id: input.categoryId,
        currency: input.currency,
        amount,
        period: 'monthly',
        deleted: false,
      };
  return planned({ insert: [{ table: 'category_budgets', row }] }, null);
}

/** Several categories' budgets in one batch, or the first that could not be written. */
export function planCategoryBudgets(
  rows: readonly BudgetRow[],
  inputs: readonly BudgetInput[],
  ctx: Pick<PlanContext, 'userId' | 'now' | 'newId'>,
): Planned<null> {
  const plan = combine(inputs.map((input) => planCategoryBudget(rows, input, ctx)));
  return plan.kind === 'writes' ? { ...plan, result: null } : plan;
}

/**
 * Budgets from a month's spending: each category that spent sets its budget to that, rounded up to
 * a whole unit so the same month again stays inside it. Categories that spent nothing keep theirs.
 */
export function budgetsFromSpending(
  spentByCategory: ReadonlyMap<string, MinorAmount>,
  currency: CurrencyCode,
): BudgetInput[] {
  return [...spentByCategory]
    .filter(([, spent]) => spent > 0)
    .map(([categoryId, spent]) => ({
      categoryId,
      currency,
      amountMinor: (Math.ceil(spent / 100) * 100) as MinorAmount,
    }));
}
