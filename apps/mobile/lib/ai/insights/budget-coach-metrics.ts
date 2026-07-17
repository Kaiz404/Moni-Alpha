/**
 * Deterministic metrics for budget coach: calendar-month spend per budgeted category (all wallets),
 * merchant keyword split (dining out vs groceries vs other).
 */
import type { TxForMetrics } from './insight-metrics';

export type BudgetRow = { categoryId: string; currency: string; amount: number };

/** Merchant text → rough spend style (keyword heuristics, not LLM). */
function classifyMerchantLine(merchant: string | null | undefined): 'dining_out' | 'grocery' | 'other' {
  const m = (merchant ?? '').toLowerCase();
  if (!m.trim()) return 'other';

  const dining =
    /restaurant|cafe|coffee|mcd|kfc|starbucks|grab\s*food|foodpanda|deliver|takeaway|uber\s*eats|pizza|sushi|ramen|hawker|mamak|restoran|dining|eatery|bakery|bistro|bar\s*&\s*grill|toast\s*box|subway|texas\s*chicken/i;
  const grocery =
    /grocery|supermarket|tesco|giant|cold\s*storage|jaya\s*grocer|99\s*speed|fairprice|ntuc|village\s*grocer|mart\b|market\b|wholefoods|costco|carrefour|aeon|lotus/i;

  if (grocery.test(m)) return 'grocery';
  if (dining.test(m)) return 'dining_out';
  return 'other';
}

function inCalendarMonth(isoDate: string, y: number, monthIndex0: number): boolean {
  const d = new Date(isoDate);
  return d.getFullYear() === y && d.getMonth() === monthIndex0;
}

export type BudgetCategoryMetric = {
  categoryId: string;
  categoryName: string;
  currency: string;
  budgetAmount: number;
  spentTotal: number;
  pctOfBudget: number | null;
  remaining: number;
  txCount: number;
  spendDiningOutLike: number;
  spendGroceryLike: number;
  spendOther: number;
  /** Share of category spend that looks like dining out (0–100), null if no spend */
  diningOutSharePct: number | null;
  topMerchants: { name: string; amount: number }[];
};

export type BudgetCoachToolSnapshot = {
  schema: 'budget_coach_tool_v1';
  monthKey: string;
  currencyHint: string;
  generatedAt: string;
  categories: BudgetCategoryMetric[];
};

export function buildBudgetCoachSnapshot(
  transactions: TxForMetrics[],
  categoryMap: Record<string, string>,
  budgets: BudgetRow[],
  currencyHint: string,
  now: Date = new Date(),
): BudgetCoachToolSnapshot {
  const sortedBudgets = [...budgets].sort((a, b) => `${a.currency}:${a.categoryId}`.localeCompare(`${b.currency}:${b.categoryId}`));

  const y = now.getFullYear();
  const m = now.getMonth();
  const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;

  const byCat: Record<
    string,
    {
      total: number;
      dining: number;
      grocery: number;
      other: number;
      count: number;
      merchants: Record<string, number>;
    }
  > = {};

  for (const b of sortedBudgets) {
    byCat[`${b.categoryId}:${b.currency.toUpperCase()}`] = {
      total: 0,
      dining: 0,
      grocery: 0,
      other: 0,
      count: 0,
      merchants: {},
    };
  }

  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.analysisExcluded) continue;
    const cid = tx.categoryId ?? '';
    const key = `${cid}:${(tx.currency ?? currencyHint).toUpperCase()}`;
    if (!cid || !byCat[key]) continue;
    if (!inCalendarMonth(tx.transactionDate, y, m)) continue;

    const amt = Math.round(tx.amount * 100) / 100;
    const bucket = classifyMerchantLine(tx.merchant);
    const o = byCat[key];
    o.total += amt;
    o.count += 1;
    if (bucket === 'dining_out') o.dining += amt;
    else if (bucket === 'grocery') o.grocery += amt;
    else o.other += amt;

    const label = (tx.merchant?.trim() || 'Unknown').slice(0, 80);
    o.merchants[label] = (o.merchants[label] ?? 0) + amt;
  }

  const categories: BudgetCategoryMetric[] = sortedBudgets.map((b) => {
    const name = categoryMap[b.categoryId] ?? 'Category';
    const o = byCat[`${b.categoryId}:${b.currency.toUpperCase()}`];
    const spent = Math.round(o.total * 100) / 100;
    const budgetAmount = Math.round(b.amount * 100) / 100;
    const pct = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 1000) / 10 : null;
    const diningShare =
      spent > 0 ? Math.round((o.dining / spent) * 1000) / 10 : null;

    const topMerchants = Object.entries(o.merchants)
      .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);

    return {
      categoryId: b.categoryId,
      categoryName: name,
      currency: b.currency.toUpperCase(),
      budgetAmount,
      spentTotal: spent,
      pctOfBudget: pct,
      remaining: Math.round((budgetAmount - spent) * 100) / 100,
      txCount: o.count,
      spendDiningOutLike: Math.round(o.dining * 100) / 100,
      spendGroceryLike: Math.round(o.grocery * 100) / 100,
      spendOther: Math.round(o.other * 100) / 100,
      diningOutSharePct: diningShare,
      topMerchants,
    };
  });

  return {
    schema: 'budget_coach_tool_v1',
    monthKey,
    currencyHint: currencyHint || 'USD',
    generatedAt: now.toISOString(),
    categories,
  };
}

export function stableBudgetCoachSnapshotString(s: BudgetCoachToolSnapshot): string {
  return JSON.stringify(s);
}
