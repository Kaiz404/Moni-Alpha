import { redirect } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { userPhotoUrl } from '@repo/core';
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
  const preferences = userPreferencesSchema.safeParse(profile?.preferences ?? {}).data;
  const currency = preferences?.currency ?? 'MYR';
  const zone = preferences?.finance_timezone ?? null;

  return (
    <Suspense>
      <Shell user={{ id: userId, name, email, initial: name.charAt(0).toUpperCase(), photoUrl: userPhotoUrl(data.claims), currency, zone }}>
        <StoreSync />
        {children}
      </Shell>
    </Suspense>
  );
}
