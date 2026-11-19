import { needsSetup } from '@repo/data';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SetupFlow } from '@/components/setup/setup-flow';
import { StoreSync } from '@/components/store/store-sync';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Set up Moni' };

/** First run (W2-Onboarding): only a brand-new account sees it; any other goes straight to Home. */
export default async function WelcomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect('/login?next=%2Fwelcome');
  if (!(await needsSetup(supabase, userId))) redirect('/home');

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  const email = typeof data.claims.email === 'string' ? data.claims.email : '';
  const name = profile?.display_name?.trim() || email.split('@')[0] || 'you';
  return (
    <>
      <StoreSync />
      <SetupFlow name={name} email={email} />
    </>
  );
}
