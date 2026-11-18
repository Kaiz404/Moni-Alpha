import Link from 'next/link';
import type { ReactNode } from 'react';
import { Cat, Wordmark } from '@/components/brand';
import './account.css';

/** The public site's page, as W2-Parts draws it: the logo, Privacy, Terms and Help, then one column. */
export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <header className="site-head">
        <Link href="/" className="site-logo" aria-label="Moni">
          <Cat size={36} ground="deep" tile id="site-logo" />
          <span className="wordmark">
            <Wordmark size={28} />
          </span>
        </Link>
        <nav className="site-links" aria-label="Moni">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/help">Help</Link>
        </nav>
      </header>
      <main className="site-body">{children}</main>
    </div>
  );
}
