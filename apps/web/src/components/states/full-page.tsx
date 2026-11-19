import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Mood } from '@repo/brand';
import { Cat, Wordmark } from '@/components/brand';
import { Glyph } from '@/components/ledger/glyph';
import { SITE_FACTS, factText } from '@/lib/site-facts';
import './states.css';

/**
 * W2-States' full pages (404, 500, maintenance): no amounts, a 120 cat in one mood, a title, one plain
 * line and a way home, with Privacy policy, Terms and Moni status.
 */
export function FullPage({ mood, title, line, children }: { mood: Mood; title: string; line: ReactNode; children: ReactNode }) {
  return (
    <div className="full-page">
      <header className="full-page-top">
        <Link href="/" className="full-page-logo" aria-label="Moni">
          <Cat size={36} ground="deep" tile id="full-page-logo" />
          <Wordmark size={28} />
        </Link>
        <StatusLink />
      </header>
      <main className="full-page-main">
        <span className="full-page-cat">
          <Cat mood={mood} size={120} id={`full-page-${mood}`} />
        </span>
        <h1 className="full-page-title">{title}</h1>
        <p className="full-page-line">{line}</p>
        <div className="full-page-actions">{children}</div>
      </main>
      <footer className="full-page-foot">
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/terms">Terms</Link>
      </footer>
    </div>
  );
}

/** Moni status, once the owner names the status page; until then the link is left out rather than dead. */
export function StatusLink({ label = 'Moni status', className = 'link full-page-status' }: { label?: string; className?: string }) {
  if (!SITE_FACTS.statusPage.confirmed) return null;
  return (
    <a href={factText('statusPage')} className={className} target="_blank" rel="noreferrer">
      <Glyph name="open-in-new" size={16} />
      {label}
    </a>
  );
}
