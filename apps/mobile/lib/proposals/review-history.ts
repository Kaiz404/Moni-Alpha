import { toLocalDateInput } from '@/lib/dates/local-date-input';
import { preferencesMMKV } from '@/lib/mmkv/preferences';
import { pruneReviewHistory } from '@/lib/supabase/proposed-transactions';

const PRUNED_ON_KEY = 'review-history-pruned-on';

/** The day is stamped only after the prune, so a run cut short reruns on the next launch. */
export function pruneReviewHistoryDaily(now = new Date()): number {
  const today = toLocalDateInput(now);
  if (preferencesMMKV.getString(PRUNED_ON_KEY) === today) return 0;
  const pruned = pruneReviewHistory(now);
  preferencesMMKV.set(PRUNED_ON_KEY, today);
  return pruned;
}
