import { needsSetup } from '@repo/data';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { HomeScreen } from '@/components/home/home-screen';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Home | Moni' };

/** Home is where sign-in lands, so a brand-new account goes through set-up first (W2-Onboarding). */
export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.sub && (await needsSetup(supabase, data.claims.sub))) redirect('/welcome');
  return <HomeScreen />;
}
