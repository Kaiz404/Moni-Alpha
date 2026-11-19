'use client';

import { applyWrites } from '@repo/data';
import { undoWrites, type BudgetRow, type PlanContext, type Planned, type RowWrites, type SyncedTable } from '@repo/core';
import { showToast } from '@/components/shell/shell-store';
import { moniStore } from '@/lib/moni-store';

/** Who writes and when, for a plan made now. */
export function planContext(userId: string): PlanContext & { reviewHistory: boolean } {
  const store = moniStore();
  return {
    userId,
    now: new Date().toISOString(),
    newId: () => crypto.randomUUID(),
    isMigrated: (migration) => store.isMigrated(migration),
    reviewHistory: store.isMigrated('review_history'),
  };
}

function snapshot(writes: RowWrites) {
  const store = moniStore();
  const rows = new Map<string, Record<string, unknown> | undefined>();
  for (const { table, id } of [...writes.patch, ...writes.softDelete]) {
    const row = (store.tables[table].peek() as Record<string, Record<string, unknown>> | undefined)?.[id];
    rows.set(`${table}/${id}`, row ? { ...row } : undefined);
  }
  return (table: SyncedTable, id: string) => rows.get(`${table}/${id}`);
}

/**
 * Carries a plan out on the store and says so in a toast whose Undo (or Ctrl Z) writes the rows back,
 * or runs `undo` when putting them back is itself a plan. A plan that needs input or is refused writes
 * nothing; its message shows as an error toast, and the answer is null. A plan's own result may be null
 * too, so a saved plan's result comes wrapped.
 */
export function commit<Result>(
  plan: Planned<Result>,
  done: string | ((result: Result) => string),
  undo?: (result: Result) => void,
): { result: Result } | null {
  if (plan.kind === 'needsInput') {
    showToast({ text: plan.field === 'wallet' ? 'Pick a wallet first.' : 'Pick the wallet it went to.', tone: 'error' });
    return null;
  }
  if (plan.kind === 'error') {
    showToast({ text: plan.message, tone: 'error' });
    return null;
  }
  const before = snapshot(plan.writes);
  try {
    applyWrites(moniStore(), plan.writes);
  } catch {
    showToast({ text: "Couldn't save. Try again.", tone: 'error' });
    return null;
  }
  showToast({
    text: typeof done === 'string' ? done : done(plan.result),
    tone: 'done',
    undo: undo
      ? () => undo(plan.result)
      : () => applyWrites(moniStore(), undoWrites(plan.writes, before, new Date().toISOString())),
  });
  return { result: plan.result };
}

/** Writes an Undo that is itself a plan, with no toast of its own; throws why it could not. */
export function applyPlan(plan: Planned<unknown>): void {
  if (plan.kind === 'error') throw new Error(plan.message);
  if (plan.kind === 'needsInput') throw new Error('Pick a wallet first.');
  applyWrites(moniStore(), plan.writes);
}

/** The budget rows as the store holds them this instant, for an Undo that runs after other writes. */
export function budgetRowsNow(): BudgetRow[] {
  return Object.values((moniStore().categoryBudgets$.peek() ?? {}) as Record<string, BudgetRow | undefined>).filter(
    (row): row is BudgetRow => Boolean(row),
  );
}
