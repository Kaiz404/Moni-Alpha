import type { Metadata } from 'next';
import Link from 'next/link';
import { Glyph } from '@/components/ledger/glyph';
import { FullPage } from '@/components/states/full-page';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: "This page isn't here · Moni" };

/** W2-States 404: thinking, because Moni is looking for the page. Signed out, the way home is the landing page. */
export default async function NotFound() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims.sub);
  return (
    <FullPage mood="thinking" title="This page isn't here" line="The link may be old, or the page moved. Your money and your data are where you left them.">
      <Link href={signedIn ? '/home' : '/'} className="btn btn-ink press">
        <Glyph name="home-outline" size={20} />
        Back to Home
      </Link>
      {signedIn && (
        <Link href="/home?palette=open" className="btn btn-out press">
          <Glyph name="magnify" size={20} />
          Search Moni
          <span className="kbd" data-only="sidebar rail rail-one-column">
            Ctrl K
          </span>
        </Link>
      )}
    </FullPage>
  );
}
