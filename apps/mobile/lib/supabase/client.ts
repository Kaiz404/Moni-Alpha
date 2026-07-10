import { createClient } from '@supabase/supabase-js';
import { authMMKV } from '@/lib/mmkv/auth';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authMMKV,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function getUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}
