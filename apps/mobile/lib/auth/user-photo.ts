import type { User } from '@supabase/supabase-js';

/** The account's photo from its sign-in provider, such as Google. Null for email sign-ins. */
export function userPhotoUrl(user: User | null): string | null {
  const meta = user?.user_metadata ?? {};
  const url = [meta.avatar_url, meta.picture].find(
    (value): value is string => typeof value === 'string' && value.startsWith('https://'),
  );
  return url ?? null;
}
