'use client';

import Link from 'next/link';
import { Glyph } from '@/components/ledger/glyph';
import { FullPage } from '@/components/states/full-page';

/** W2-States 500: neutral, because nothing is lost. Try again re-renders the part that failed. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <FullPage
      mood="neutral"
      title="Something went wrong on our side"
      line="Nothing you added is lost. Try again in a minute; if it keeps happening, Moni status says what's going on."
    >
      <button type="button" className="btn btn-ink press" onClick={reset}>
        <Glyph name="refresh" size={20} />
        Try again
      </button>
      <Link href="/home" className="btn btn-sand press">
        <Glyph name="home-outline" size={20} />
        Back to Home
      </Link>
    </FullPage>
  );
}
