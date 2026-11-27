'use client';

import { applyPlan, budgetRowsNow, commit, planContext } from '@/lib/ledger/commit';
import type { Ledger } from '@/lib/ledger/use-ledger';
import { moniStore } from '@/lib/moni-store';
import { showToast } from '@/components/shell/shell-store';
import { formatMoney, planCategoryBudgets, suggestTargetName, type SuggestTarget } from '@repo/core';
import { updateProfilePreferences } from '@repo/data';
import { decimalToMinor, userPreferencesSchema, type MinorAmount } from '@repo/types';

/**
 * Shows the monthly total at once, then writes `preferences.monthly_budget` in whole units, as the
 * phone's Edit budgets does; a refused write puts the old one back. Null goes back to the budgets' sum.
 */
export async function saveMonthlyTotal(totalMinor: MinorAmount | null): Promise<boolean> {
  const store = moniStore();
  const previous = store.profilePreferences$.peek();
  const monthly_budget = totalMinor === null ? null : Number(totalMinor) / 100;
  store.profilePreferences$.set({ ...userPreferencesSchema.parse(previous ?? {}), monthly_budget });
  try {
    store.profilePreferences$.set(await updateProfilePreferences(store.supabase, { monthly_budget }));
    return true;
  } catch {
    store.profilePreferences$.set(previous);
    showToast({ text: "Couldn't save the monthly total. Try again.", tone: 'error' });
    return false;
  }
}

/** Set budget on Moni's suggestion in chat: one category's budget, or the monthly total, with Undo. */
export async function saveSuggestedBudget(target: SuggestTarget, amountMinor: MinorAmount, ledger: Ledger): Promise<boolean> {
  const text = `${suggestTargetName(target)} set to ${formatMoney(amountMinor, ledger.currency, { whole: true })}`;
  if (target.kind === 'total') {
    const before = moniStore().profilePreferences$.peek()?.monthly_budget;
    const kept = await saveMonthlyTotal(amountMinor);
    if (kept)
      showToast({ text, tone: 'done', undo: () => void saveMonthlyTotal(before == null ? null : decimalToMinor(before)) });
    return kept;
  }
  const live = ledger.budgetRows.find(
    (row) =>
      row.user_id === ledger.userId &&
      row.category_id === target.id &&
      String(row.currency ?? '').toUpperCase() === ledger.currency &&
      !row.deleted,
  );
  const input = { categoryId: target.id, currency: ledger.currency };
  const saved = commit(planCategoryBudgets(ledger.budgetRows, [{ ...input, amountMinor }], planContext(ledger.userId)), text, () =>
    applyPlan(
      planCategoryBudgets(budgetRowsNow(), [{ ...input, amountMinor: live ? decimalToMinor(live.amount) : null }], planContext(ledger.userId)),
    ),
  );
  return saved !== null;
}
