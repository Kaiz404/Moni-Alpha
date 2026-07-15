import { transactionDelta } from '@/lib/supabase/transaction-balance';

export type HomeWalletTx = {
  id: string;
  walletId: string;
  transferToWalletId?: string | null;
  linkedTransactionId?: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string | null;
  transactionDate: string;
  merchant?: string | null;
  description?: string | null;
};

export type WalletTxBundle = { recent: HomeWalletTx[]; chart: HomeWalletTx[] };

export function resolveActiveWalletIds(
  wallets: { id: string }[],
  selectedIds: Set<string>,
): string[] {
  if (selectedIds.size === 0 || selectedIds.size >= wallets.length) {
    return wallets.map((w) => w.id);
  }
  return [...selectedIds];
}

export function isAllWalletsMode(
  wallets: { id: string }[],
  selectedIds: Set<string>,
): boolean {
  return selectedIds.size === 0 || selectedIds.size >= wallets.length;
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(row.id, row);
  }
  return [...map.values()];
}

export function mergeWalletBundles(
  cache: Record<string, WalletTxBundle>,
  walletIds: string[],
  limits: { recentLimit: number; chartLimit: number },
): { recent: HomeWalletTx[]; chart: HomeWalletTx[] } {
  const allRecent: HomeWalletTx[] = [];
  const allChart: HomeWalletTx[] = [];
  for (const id of walletIds) {
    const bundle = cache[id];
    if (!bundle) continue;
    allRecent.push(...bundle.recent);
    allChart.push(...bundle.chart);
  }

  const sortDesc = (a: HomeWalletTx, b: HomeWalletTx) =>
    new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
  const sortAsc = (a: HomeWalletTx, b: HomeWalletTx) =>
    new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();

  const chart = dedupeById(allChart).sort(sortAsc);
  const recent = dedupeById(allRecent).sort(sortDesc);

  return {
    recent: recent.slice(0, limits.recentLimit),
    chart: chart.slice(-limits.chartLimit),
  };
}

/** Dedupe internal transfers when both endpoints are in the active selection. */
export function collapseInternalTransfers(
  txs: HomeWalletTx[],
  activeWalletIds: string[],
): HomeWalletTx[] {
  if (activeWalletIds.length <= 1) return txs;

  const activeSet = new Set(activeWalletIds);
  const seen = new Set<string>();
  const result: HomeWalletTx[] = [];

  for (const tx of txs) {
    if (tx.type !== 'transfer') {
      result.push(tx);
      continue;
    }

    const from = tx.walletId;
    const to = tx.transferToWalletId;
    const isInternal = Boolean(from && to && activeSet.has(from) && activeSet.has(to));

    if (!isInternal) {
      result.push(tx);
      continue;
    }

    const key = tx.linkedTransactionId ?? tx.id;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tx);
  }

  return result;
}

export function groupExpensesByCategory(
  txs: HomeWalletTx[],
  categoryMap: Record<string, string>,
): { x: string; y: number }[] {
  const totals: Record<string, number> = {};
  txs.forEach((tx) => {
    if (tx.type !== 'expense') return;
    const categoryName = tx.categoryId
      ? (categoryMap[tx.categoryId] ?? 'Uncategorized')
      : 'Uncategorized';
    totals[categoryName] = (totals[categoryName] ?? 0) + tx.amount;
  });
  const entries = Object.entries(totals)
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => b.y - a.y);
  if (entries.length <= 6) return entries;
  const top = entries.slice(0, 5);
  const otherTotal = entries.slice(5).reduce((sum, c) => sum + c.y, 0);
  return [...top, { x: 'Other', y: otherTotal }];
}

export type BalanceLineSeries = {
  currency: string;
  points: { x: Date; y: number }[];
};

export function buildBalanceLinesByCurrency(
  txs: HomeWalletTx[],
  wallets: { id: string; currency?: string | null; initialBalance?: number | null }[],
  activeWalletIds: string[],
): BalanceLineSeries[] {
  const activeSet = new Set(activeWalletIds);
  const activeWallets = wallets.filter((w) => activeSet.has(w.id));

  const byCurrency = new Map<string, typeof activeWallets>();
  for (const w of activeWallets) {
    const cur = (w.currency ?? 'USD').toUpperCase();
    const group = byCurrency.get(cur) ?? [];
    group.push(w);
    byCurrency.set(cur, group);
  }

  const lines: BalanceLineSeries[] = [];

  for (const [currency, groupWallets] of byCurrency) {
    const walletIds = groupWallets.map((w) => w.id);
    const initial = groupWallets.reduce((s, w) => s + Number(w.initialBalance ?? 0), 0);

    const relevantTxs = txs
      .filter((tx) => {
        if (tx.type === 'transfer') {
          return (
            walletIds.includes(tx.walletId) ||
            (tx.transferToWalletId != null && walletIds.includes(tx.transferToWalletId))
          );
        }
        return walletIds.includes(tx.walletId);
      })
      .sort(
        (a, b) =>
          new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime(),
      );

    let running = initial;
    const points: { x: Date; y: number }[] = [];

    if (!relevantTxs.length) {
      points.push({ x: new Date(), y: Number(running.toFixed(2)) });
    } else {
      points.push({
        x: new Date(relevantTxs[0].transactionDate),
        y: Number(running.toFixed(2)),
      });
      for (const tx of relevantTxs) {
        for (const wid of walletIds) {
          running += transactionDelta(
            {
              wallet_id: tx.walletId,
              transfer_to_wallet_id: tx.transferToWalletId,
              amount: tx.amount,
              type: tx.type,
            },
            wid,
          );
        }
        points.push({ x: new Date(tx.transactionDate), y: Number(running.toFixed(2)) });
      }
    }

    lines.push({ currency, points });
  }

  return lines;
}

export function formatCurrencyTotals(totalsByCurrency: Record<string, number>): string {
  const entries = Object.entries(totalsByCurrency).filter(([, v]) => v > 0);
  if (entries.length === 0) return '0';
  return entries.map(([cur, amt]) => `${cur} ${amt.toFixed(0)}`).join(' · ');
}

export function expenseTotalsByCurrency(
  txs: HomeWalletTx[],
  walletCurrencyMap: Record<string, string>,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const tx of txs) {
    if (tx.type !== 'expense') continue;
    const cur = (walletCurrencyMap[tx.walletId] ?? 'USD').toUpperCase();
    totals[cur] = (totals[cur] ?? 0) + tx.amount;
  }
  return totals;
}
