import type { CategoryBudget } from "@repo/types";

export type BudgetTransaction = {
  amount: number;
  currency: string;
  type: string | null;
  categoryId: string | null;
  transactionDate: string;
  analysisExcluded?: boolean;
};
export type BudgetCategory = {
  id: string;
  name: string;
  color?: string | null;
};
export type BudgetProgress = {
  categoryId: string;
  categoryName: string;
  currency: string;
  budgetAmount: number | null;
  spent: number;
  remaining: number | null;
  percentage: number | null;
  status: "unbudgeted" | "on_track" | "near_limit" | "over";
};

function parts(date: Date, timezone: string) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(values.map((part) => [part.type, part.value]));
}
export function monthKeyInTimezone(
  value: string | Date,
  timezone: string,
): string {
  const p = parts(new Date(value), timezone);
  return `${p.year}-${p.month}`;
}

export function buildBudgetProgress(
  categories: BudgetCategory[],
  budgets: CategoryBudget[],
  transactions: BudgetTransaction[],
  timezone: string,
  now: Date = new Date(),
): BudgetProgress[] {
  const month = monthKeyInTimezone(now, timezone);
  const spend = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "expense" || tx.analysisExcluded || !tx.categoryId)
      continue;
    if (monthKeyInTimezone(tx.transactionDate, timezone) !== month) continue;
    const key = `${tx.categoryId}:${tx.currency.toUpperCase()}`;
    spend.set(key, (spend.get(key) ?? 0) + tx.amount);
  }
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const budgetByKey = new Map(
    budgets.map((budget) => [
      `${budget.categoryId}:${budget.currency.toUpperCase()}`,
      budget,
    ]),
  );
  const keys = new Set([...spend.keys(), ...budgetByKey.keys()]);
  return [...keys]
    .map((key) => {
      const [categoryId, currency] = key.split(":");
      const budget = budgetByKey.get(key);
      const used = Math.round((spend.get(key) ?? 0) * 100) / 100;
      const cap = budget?.amount ?? null;
      const remaining =
        cap == null ? null : Math.round((cap - used) * 100) / 100;
      const percentage =
        cap == null ? null : Math.round((used / cap) * 1000) / 10;
      const status: BudgetProgress["status"] =
        cap == null
          ? "unbudgeted"
          : used > cap
            ? "over"
            : used >= cap * 0.75
              ? "near_limit"
              : "on_track";
      return {
        categoryId,
        categoryName: categoryById.get(categoryId)?.name ?? "Uncategorized",
        currency,
        budgetAmount: cap,
        spent: used,
        remaining,
        percentage,
        status,
      };
    })
    .sort(
      (a, b) =>
        (b.percentage ?? -1) - (a.percentage ?? -1) || b.spent - a.spent,
    );
}
