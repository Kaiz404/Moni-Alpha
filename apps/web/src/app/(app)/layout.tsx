import { redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { userPreferencesSchema } from '@repo/types';
import { Shell } from '@/components/shell/shell';
import { StoreSync } from '@/components/store/store-sync';
import { createClient } from '@/lib/supabase/server';
import '../shell.css';

/** The signed-in app. The shell renders on the server; ledger data loads in the browser (PLAN.md decision 5). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, preferences')
    .eq('id', userId)
    .maybeSingle();
  const email = typeof data.claims.email === 'string' ? data.claims.email : '';
  const name = profile?.display_name?.trim() || email.split('@')[0] || 'You';
  const currency = userPreferencesSchema.safeParse(profile?.preferences ?? {}).data?.currency ?? 'MYR';

  return (
    <Suspense>
      <Shell user={{ name, initial: name.charAt(0).toUpperCase(), currency }}>
        <StoreSync />
        {children}
      </Shell>
    </Suspense>
  );
}
