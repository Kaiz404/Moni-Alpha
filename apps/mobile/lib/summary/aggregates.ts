import { isActive } from '@/lib/store/helpers';
import {
  parseTxAmount,
  transactionDelta,
  type TransactionBalanceRow,
} from '@/lib/supabase/transaction-balance';

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

type TransactionRow = TransactionBalanceRow & {
  category_id?: string | null;
  transaction_date?: string | null;
  created_at?: string | null;
  location_latitude?: string | number | null;
  location_longitude?: string | number | null;
  location_name?: string | null;
  description?: string | null;
};

export type SummaryWallet = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  currency: string | null;
  initialBalance: number;
  currentBalance: number;
};

function toDateKey(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10);
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString().slice(0, 10);
}

/** One pass over transactions — O(txs), not O(wallets × txs). */
export function computeAllWalletBalances(
  walletIds: Set<string>,
  walletInitials: Record<string, number>,
  transactions: TransactionRow[],
): Record<string, number> {
  const balances: Record<string, number> = { ...walletInitials };

  for (const tx of transactions) {
    const walletId = tx.wallet_id;
    if (walletId && walletIds.has(walletId)) {
      balances[walletId] = (balances[walletId] ?? 0) + transactionDelta(tx, walletId);
    }
    const transferTo = tx.transfer_to_wallet_id;
    if (transferTo && walletIds.has(transferTo)) {
      balances[transferTo] = (balances[transferTo] ?? 0) + transactionDelta(tx, transferTo);
    }
  }

  return balances;
}

export function buildSummaryWallets(
  walletRows: WalletRow[],
  transactionRows: TransactionRow[],
  userId: string | null,
): SummaryWallet[] {
  const activeWallets = walletRows
    .filter((w) => w.user_id === userId && isActive(w.is_active))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const walletIds = new Set(activeWallets.map((w) => w.id));
  const initials: Record<string, number> = {};
  for (const w of activeWallets) {
    initials[w.id] = parseTxAmount(w.initial_balance);
  }

  const balances = computeAllWalletBalances(walletIds, initials, transactionRows);

  return activeWallets.map((w) => ({
    id: w.id,
    name: w.name ?? '',
    color: w.color,
    icon: w.icon,
    currency: w.currency,
    initialBalance: initials[w.id] ?? 0,
    currentBalance: balances[w.id] ?? initials[w.id] ?? 0,
  }));
}

export function buildCategoryNameMap(
  categoryRows: Array<{ id: string; user_id: string | null; name: string | null; is_active: boolean | number | null }>,
  userId: string | null,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of categoryRows) {
    if (!isActive(row.is_active)) continue;
    if (row.user_id !== null && row.user_id !== userId) continue;
    map[row.id] = row.name ?? 'Uncategorized';
  }
  return map;
}

export type ChartPoint = { x: string | Date; y: number };

export function buildPieData(
  transactionRows: TransactionRow[],
  categoryMap: Record<string, string>,
): ChartPoint[] {
  const totals: Record<string, number> = {};

  for (const tx of transactionRows) {
    if (tx.type !== 'expense') continue;
    const amount = parseTxAmount(tx.amount);
    const categoryName = tx.category_id
      ? categoryMap[tx.category_id] ?? 'Uncategorized'
      : 'Uncategorized';
    totals[categoryName] = (totals[categoryName] ?? 0) + amount;
  }

  const entries = Object.entries(totals)
    .map(([x, y]) => ({ x, y }))
    .sort((a, b) => b.y - a.y);

  if (entries.length <= 6) return entries;

  const top = entries.slice(0, 5);
  const otherTotal = entries.slice(5).reduce((sum, current) => sum + current.y, 0);
  return [...top, { x: 'Other', y: otherTotal }];
}

export function buildLineData(
  transactionRows: TransactionRow[],
  wallets: SummaryWallet[],
): ChartPoint[] {
  const initialTotal = wallets.reduce((sum, wallet) => sum + wallet.initialBalance, 0);
  const deltaByDay: Record<string, number> = {};

  for (const tx of transactionRows) {
    const dateKey = toDateKey(tx.transaction_date ?? tx.created_at);
    if (!dateKey) continue;

    const amount = parseTxAmount(tx.amount);
    if (tx.type === 'income') {
      deltaByDay[dateKey] = (deltaByDay[dateKey] ?? 0) + amount;
    } else if (tx.type === 'expense') {
      deltaByDay[dateKey] = (deltaByDay[dateKey] ?? 0) - amount;
    }
  }

  const keys = Object.keys(deltaByDay).sort();
  if (!keys.length) {
    return [{ x: new Date(), y: initialTotal }];
  }

  let running = initialTotal;
  return keys.map((key) => {
    running += deltaByDay[key];
    return { x: new Date(key), y: Number(running.toFixed(2)) };
  });
}

export function buildUsageBarData(wallets: SummaryWallet[], transactionRows: TransactionRow[]): ChartPoint[] {
  const usage: Record<string, number> = Object.fromEntries(wallets.map((wallet) => [wallet.id, 0]));

  for (const tx of transactionRows) {
    if (tx.wallet_id) {
      usage[tx.wallet_id] = (usage[tx.wallet_id] ?? 0) + 1;
    }
    if (tx.transfer_to_wallet_id) {
      usage[tx.transfer_to_wallet_id] = (usage[tx.transfer_to_wallet_id] ?? 0) + 1;
    }
  }

  return wallets
    .map((wallet) => ({
      x: wallet.name.length > 10 ? `${wallet.name.slice(0, 10)}…` : wallet.name,
      y: usage[wallet.id] ?? 0,
    }))
    .sort((a, b) => b.y - a.y);
}

export type TransactionPinPoint = {
  latitude: number;
  longitude: number;
  transactionCount: number;
  locationName: string;
  description: string;
  amount: number;
};

export function buildPinPoints(transactionRows: TransactionRow[]): TransactionPinPoint[] {
  const locationCounts: Record<
    string,
    {
      lat: number;
      lng: number;
      count: number;
      locationName: string;
      description: string;
      amount: number;
    }
  > = {};

  for (const tx of transactionRows) {
    const lat = tx.location_latitude != null ? parseFloat(String(tx.location_latitude)) : NaN;
    const lng = tx.location_longitude != null ? parseFloat(String(tx.location_longitude)) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (!locationCounts[key]) {
      locationCounts[key] = {
        lat,
        lng,
        count: 0,
        locationName: tx.location_name?.trim() || 'Saved Transaction Location',
        description: tx.description?.trim() || 'No description',
        amount: parseTxAmount(tx.amount),
      };
    }
    locationCounts[key].count += 1;
  }

  return Object.values(locationCounts).map((location) => ({
    latitude: location.lat,
    longitude: location.lng,
    transactionCount: location.count,
    locationName: location.locationName,
    description: location.description,
    amount: location.amount,
  }));
}

export function buildMapRegion(pinPoints: TransactionPinPoint[]) {
  if (pinPoints.length === 0) {
    return {
      latitude: 0,
      longitude: 0,
      latitudeDelta: 180,
      longitudeDelta: 360,
    };
  }

  const latitudes = pinPoints.map((point) => point.latitude);
  const longitudes = pinPoints.map((point) => point.longitude);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const latitudeDelta = Math.max(maxLat - minLat, 0.1) * 1.2;
  const longitudeDelta = Math.max(maxLng - minLng, 0.1) * 1.2;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}
