import type { User } from '@supabase/supabase-js';

import { userPhotoUrl } from '@/lib/auth/user-photo';

const user = (meta: Record<string, unknown>) => ({ user_metadata: meta }) as unknown as User;

describe('userPhotoUrl', () => {
  it('reads the photo Google puts in avatar_url, or picture on older sessions', () => {
    expect(userPhotoUrl(user({ avatar_url: 'https://lh3.googleusercontent.com/a/abc' }))).toBe(
      'https://lh3.googleusercontent.com/a/abc',
    );
    expect(userPhotoUrl(user({ picture: 'https://lh3.googleusercontent.com/a/xyz' }))).toBe(
      'https://lh3.googleusercontent.com/a/xyz',
    );
  });

  it('has none for an email sign-in, no user, or a value that is not an https link', () => {
    expect(userPhotoUrl(user({ display_name: 'Kai' }))).toBeNull();
    expect(userPhotoUrl(null)).toBeNull();
    expect(userPhotoUrl(user({ avatar_url: 'http://example.com/a.png' }))).toBeNull();
  });
});
