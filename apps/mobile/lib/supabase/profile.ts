import { userPreferencesSchema, type UserPreferences } from '@repo/types';
import { supabase, getUserId } from '@/lib/supabase/client';

export async function getProfilePreferences(): Promise<UserPreferences> {
  const userId = await getUserId();
  if (!userId) throw new Error('User ID required');

  const { data, error } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return userPreferencesSchema.parse(data?.preferences ?? {});
}

export async function updateProfilePreferences(
  partial: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const userId = await getUserId();
  if (!userId) throw new Error('User ID required');

  const current = await getProfilePreferences();
  const merged = { ...current, ...partial };

  const { data, error } = await supabase
    .from('profiles')
    .update({ preferences: merged })
    .eq('id', userId)
    .select('preferences')
    .single();

  if (error) throw error;
  return userPreferencesSchema.parse(data?.preferences ?? merged);
}
