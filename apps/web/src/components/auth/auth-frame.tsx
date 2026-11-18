import Link from 'next/link';
import type { ReactNode } from 'react';
import { Cat, Wordmark } from '@/components/brand';

/** W2-Auth's page: logo, the form column, the footer links, and the Deep mint panel on the right. */
export function AuthFrame({ panel, children }: { panel: ReactNode; children: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-side">
        <Link href="/" className="auth-logo" aria-label="Moni">
          <Cat size={36} ground="deep" tile id="auth-logo" />
          <span className="wordmark">
            <Wordmark size={28} />
          </span>
        </Link>
        <main className="auth-body">{children}</main>
        <footer className="auth-foot">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/help">Help</Link>
        </footer>
      </div>
      {panel}
    </div>
  );
}

export function PanelCat() {
  return <Cat size={200} ground="dark" id="auth-panel-cat" className="auth-panel-cat" />;
}
