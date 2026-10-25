import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { preferencesMMKV } from '@/lib/mmkv/preferences';
import { pruneReviewHistory } from '@/lib/supabase/proposed-transactions';

const PRUNED_ON_KEY = 'review-history-pruned-on';

/**
 * Soft-deletes captures reviewed more than 90 days ago, at most once per local day. The prune
 * converges, so a run cut short is finished by the next day's run.
 */
export function pruneReviewHistoryDaily(now = new Date()): number {
  const today = toLocalDateInput(now);
  if (preferencesMMKV.getString(PRUNED_ON_KEY) === today) return 0;
  const pruned = pruneReviewHistory(now);
  preferencesMMKV.set(PRUNED_ON_KEY, today);
  return pruned;
}
