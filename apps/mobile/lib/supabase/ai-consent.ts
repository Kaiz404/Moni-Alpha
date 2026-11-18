import { AI_NOTICE_VERSION, aiConsentRowSchema, type AiConsentScope } from '@repo/types';

import { consentFromRows, type AiConsent, type ConsentChange } from '@/lib/ai/consent/model';
import { getUserId, supabase } from '@/lib/supabase/client';

export async function fetchAiConsent(): Promise<AiConsent> {
  const { data, error } = await supabase
    .from('ai_consent_current')
    .select('use, granted, created_at');
  if (error) throw error;
  return consentFromRows(aiConsentRowSchema.array().parse(data ?? []));
}

/** Appends one consent row per changed switch. The server stamps the time. */
export async function recordAiConsent(change: ConsentChange): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error('Sign in again, then try once more.');
  const rows = (Object.entries(change) as [AiConsentScope, boolean][]).map(([use, granted]) => ({
    user_id: userId,
    use,
    granted,
    notice_version: AI_NOTICE_VERSION,
  }));
  if (!rows.length) return;
  const { error } = await supabase.from('ai_consents').insert(rows);
  if (error) throw error;
}
