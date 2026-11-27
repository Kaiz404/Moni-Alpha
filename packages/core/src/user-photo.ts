/** The part of a Supabase user, or of its access token's claims, that carries the sign-in provider's profile. */
export type UserWithMetadata = { user_metadata?: Record<string, unknown> | null };

/** The account's photo from its sign-in provider, such as Google. Null for email sign-ins. */
export function userPhotoUrl(user: UserWithMetadata | null | undefined): string | null {
  const meta = user?.user_metadata ?? {};
  const url = [meta.avatar_url, meta.picture].find(
    (value): value is string => typeof value === 'string' && value.startsWith('https://'),
  );
  return url ?? null;
}
