import { consentFromRows, type AiConsent, type ConsentChange } from '@repo/core';
import {
  AI_NOTICE_VERSION,
  aiConsentRowSchema,
  userPreferencesSchema,
  type AiConsentScope,
  type UserPreferences,
} from '@repo/types';

import type { MoniSupabase } from './supabase';

export async function signedInUserId(supabase: MoniSupabase): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * A brand-new account: set-up never finished, and no wallet or transaction, live or deleted, under it.
 * An account the phone or an import already filled is never sent through set-up, flag or not.
 */
export async function needsSetup(supabase: MoniSupabase, userId: string): Promise<boolean> {
  const [profile, wallets, transactions] = await Promise.all([
    supabase.from('profiles').select('preferences').eq('id', userId).maybeSingle(),
    supabase.from('wallets').select('id').eq('user_id', userId).limit(1),
    supabase.from('transactions').select('id').eq('user_id', userId).limit(1),
  ]);
  if (profile.error || wallets.error || transactions.error) return false;
  const preferences = userPreferencesSchema.safeParse(profile.data?.preferences ?? {}).data;
  return !preferences?.setup_finished_at && !wallets.data?.length && !transactions.data?.length;
}

export async function fetchProfilePreferences(supabase: MoniSupabase): Promise<UserPreferences> {
  const userId = await signedInUserId(supabase);
  if (!userId) throw new Error('User ID required');
  const { data, error } = await supabase.from('profiles').select('preferences').eq('id', userId).single();
  if (error) throw error;
  return userPreferencesSchema.parse(data?.preferences ?? {});
}

/** Merges `patch` into the stored preferences and returns what the server kept. */
export async function updateProfilePreferences(
  supabase: MoniSupabase,
  patch: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const userId = await signedInUserId(supabase);
  if (!userId) throw new Error('User ID required');
  const merged = { ...(await fetchProfilePreferences(supabase)), ...patch };
  const { data, error } = await supabase
    .from('profiles')
    .update({ preferences: merged })
    .eq('id', userId)
    .select('preferences')
    .single();
  if (error) throw error;
  return userPreferencesSchema.parse(data?.preferences ?? merged);
}

/**
 * Points the default wallet at `to` only while it is `from`, so a wallet's delete and its Undo never
 * overwrite a default picked since. Returns the stored preferences, or null when nothing changed.
 */
export async function moveDefaultWallet(
  supabase: MoniSupabase,
  from: string | null,
  to: string | null,
): Promise<UserPreferences | null> {
  const preferences = await fetchProfilePreferences(supabase);
  if ((preferences.default_wallet_id ?? null) !== from) return null;
  return updateProfilePreferences(supabase, { default_wallet_id: to });
}

/** Appends one consent row per changed switch. The server stamps the time. */
export async function recordAiConsent(supabase: MoniSupabase, change: ConsentChange): Promise<void> {
  const userId = await signedInUserId(supabase);
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

export async function fetchAiConsent(supabase: MoniSupabase): Promise<AiConsent> {
  const { data, error } = await supabase.from('ai_consent_current').select('use, granted, created_at');
  if (error) throw error;
  return consentFromRows(aiConsentRowSchema.array().parse(data ?? []));
}
