/**
 * Routine detection: decides whether an incoming AI extraction repeats something the user has
 * already categorized, using only their own transaction history (already on device).
 *
 * The first transaction of a kind always goes to review. Once the user has categorized one like
 * it, later ones are prefilled; routine notifications are added to the ledger directly.
 * Correcting a category breaks the streak, so the next one goes back to review.
 */

/** Recent matches that must agree on one category before a transaction is added automatically. */
const STREAK = 3;
/** An amount above this multiple of the largest recent match is out of the norm: review it. */
const OUTLIER_FACTOR = 3;
const NEARBY_M = 100;
const NEARBY_AMOUNT_RATIO = 1.3;

export type RoutineHistoryTransaction = {
  type: string | null;
  currency: string;
  amountMinor: number;
  categoryId: string | null;
  merchant: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  analysisExcluded?: boolean;
  debtActivityId?: string | null;
};

export type RoutineCandidate = {
  type: string | null;
  currency: string;
  amountMinor: number | null;
  merchant: string | null;
  /** Only pass a location captured when the payment happened (notifications), never entry-time. */
  location: { latitude: number; longitude: number } | null;
};

export type RoutineMatch = {
  /** Category of the most recent similar transaction, for prefilling. */
  categoryId: string | null;
  merchant: string | null;
  /** True when the transaction is routine enough to add without review. */
  routine: boolean;
};

/** Drops id-like tokens (any digit), then keeps letters: "GRAB* A-12XY" and "Grab A-98QZ" become "grab". */
export function merchantKey(merchant: string | null): string | null {
  const key = (merchant ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => !/\d/.test(token))
    .join(' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return key || null;
}

function distanceM(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function isSimilar(
  tx: RoutineHistoryTransaction,
  candidate: RoutineCandidate,
  candidateKey: string | null,
): boolean {
  if (tx.type !== candidate.type || tx.currency !== candidate.currency) return false;
  if (candidateKey && merchantKey(tx.merchant) === candidateKey) return true;
  if (
    !candidate.location ||
    !candidate.amountMinor ||
    tx.locationLatitude === null ||
    tx.locationLongitude === null
  ) {
    return false;
  }
  const ratio =
    Math.max(tx.amountMinor, candidate.amountMinor) /
    Math.min(tx.amountMinor, candidate.amountMinor);
  return (
    ratio <= NEARBY_AMOUNT_RATIO &&
    distanceM(candidate.location, {
      latitude: tx.locationLatitude,
      longitude: tx.locationLongitude,
    }) <= NEARBY_M
  );
}

/**
 * @param history newest first. Transfers, balance adjustments and debt-linked rows are ignored.
 * @param activeCategoryIds a category the user archived is never applied automatically.
 */
export function matchRoutine(
  candidate: RoutineCandidate,
  history: readonly RoutineHistoryTransaction[],
  activeCategoryIds: ReadonlySet<string>,
): RoutineMatch {
  const none = { categoryId: null, merchant: null, routine: false };
  if (candidate.type !== 'income' && candidate.type !== 'expense') return none;

  const key = merchantKey(candidate.merchant);
  const recent: RoutineHistoryTransaction[] = [];
  for (const tx of history) {
    if (!tx.categoryId || tx.analysisExcluded || tx.debtActivityId) continue;
    if (isSimilar(tx, candidate, key)) recent.push(tx);
    if (recent.length === STREAK) break;
  }
  const latest = recent[0];
  if (!latest?.categoryId || !activeCategoryIds.has(latest.categoryId)) return none;

  const agrees = recent.every((tx) => tx.categoryId === latest.categoryId);
  const largest = Math.max(...recent.map((tx) => tx.amountMinor));
  const inNorm = !!candidate.amountMinor && candidate.amountMinor <= largest * OUTLIER_FACTOR;

  return {
    categoryId: latest.categoryId,
    merchant: latest.merchant,
    routine: agrees && inNorm,
  };
}
