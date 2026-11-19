import { fetchProfilePreferences, updateProfilePreferences } from '@repo/data';
import type { UserPreferences } from '@repo/types';
import { supabase } from '@/lib/supabase/client';

export function getProfilePreferences(): Promise<UserPreferences> {
  return fetchProfilePreferences(supabase);
}

export async function ensureFinanceTimezone(): Promise<string> {
  const current = await getProfilePreferences();
  if (current.finance_timezone) return current.finance_timezone;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  await updateProfilePreferences(supabase, { finance_timezone: timezone });
  return timezone;
}
