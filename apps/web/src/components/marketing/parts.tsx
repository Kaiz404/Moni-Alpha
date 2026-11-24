import { mdiArrowRight } from '@mdi/js';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SITE_FACTS, factText } from '@/lib/site-facts';

/** An MDI icon by its path from `@mdi/js`, so the landing page needs no entry in the app's icon registry. */
export function MdiIcon({ path, size = 22, className }: { path: string; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={className} style={{ flex: 'none' }}>
      <path d={path} fill="currentColor" />
    </svg>
  );
}

/** Where "Use it on the web" goes: create account, since a signed-in visitor sees "Open Moni" instead. */
export const WEB_APP_HREF = '/login?mode=create';

/**
 * The pill standing in for the official Google Play badge. Until the listing's link is confirmed it links
 * nowhere and carries the placeholder as its title, outlined in the placeholder's lemon.
 */
export function StorePill({ tone = 'ink', full = false, height = 56 }: { tone?: 'ink' | 'paper'; full?: boolean; height?: number }) {
  const listed = SITE_FACTS.googlePlayUrl.confirmed;
  const className = ['lp-store', 'pr', tone === 'paper' && 'lp-store-paper', full && 'lp-full'].filter(Boolean).join(' ');
  const content = (
    <>
      <span className="lp-store-small">Get it on</span>
      <span className="lp-store-big">Google Play</span>
    </>
  );
  return listed ? (
    <a className={className} style={{ height }} href={factText('googlePlayUrl')}>
      {content}
    </a>
  ) : (
    <span className={className.replace(' pr', '')} style={{ height }} aria-label="Android app, coming soon">
      <span className="lp-store-small">Coming soon</span>
      <span className="lp-store-big">Android app</span>
    </span>
  );
}

export function WebButton({ full = false, height = 56 }: { full?: boolean; height?: number }) {
  return (
    <Link href={WEB_APP_HREF} className={['btn', 'btn-ink', 'pr', 'lp-web', full && 'lp-full'].filter(Boolean).join(' ')} style={{ height }}>
      Use it on the web
      <MdiIcon path={mdiArrowRight} size={20} />
    </Link>
  );
}

/** A landing section's H2: 56 on desktop, 40 at phone width (landing.css). */
export function LandingH2({ id, children, onDeep = false }: { id: string; children: ReactNode; onDeep?: boolean }) {
  return (
    <h2 id={id} className={onDeep ? 'lp-h2 lp-h2-deep' : 'lp-h2'}>
      {children}
    </h2>
  );
}
