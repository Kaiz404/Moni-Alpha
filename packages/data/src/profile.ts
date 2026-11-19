import { consentFromRows, type AiConsent } from '@repo/core';
import { aiConsentRowSchema, userPreferencesSchema, type UserPreferences } from '@repo/types';

import type { MoniSupabase } from './supabase';

export async function signedInUserId(supabase: MoniSupabase): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function fetchProfilePreferences(supabase: MoniSupabase): Promise<UserPreferences> {
  const userId = await signedInUserId(supabase);
  if (!userId) throw new Error('User ID required');
  const { data, error } = await supabase.from('profiles').select('preferences').eq('id', userId).single();
  if (error) throw error;
  return userPreferencesSchema.parse(data?.preferences ?? {});
}

export async function fetchAiConsent(supabase: MoniSupabase): Promise<AiConsent> {
  const { data, error } = await supabase.from('ai_consent_current').select('use, granted, created_at');
  if (error) throw error;
  return consentFromRows(aiConsentRowSchema.array().parse(data ?? []));
}
