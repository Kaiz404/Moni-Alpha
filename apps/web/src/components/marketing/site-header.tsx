'use client';

import { mdiArrowRight, mdiClose, mdiMenu } from '@mdi/js';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Cat, Wordmark } from '@/components/brand';
import { createClient } from '@/lib/supabase/client';
import { SIGNED_IN_HOME } from '@/lib/routes';
import { MdiIcon, WEB_APP_HREF } from './parts';

const SECTIONS = [
  { label: 'How it works', href: '#how' },
  { label: 'Map', href: '#map' },
  { label: 'Privacy', href: '#privacy' },
  { label: 'FAQ', href: '#faq' },
];

/** True once the browser holds a Moni session. The page is static, so this is read after it loads. */
function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (live) setSignedIn(Boolean(data.session));
      });
    return () => {
      live = false;
    };
  }, []);
  return signedIn;
}

/** The landing page's top bar: the lockup, the section links, and Sign in or, once signed in, Open Moni. */
export function SiteHeader() {
  const signedIn = useSignedIn();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="lp-top">
      <Link href="#top" className="lp-logo" aria-label="Moni home">
        <Cat size={34} ground="deep" tile id="lp-logo" />
        <Wordmark size={27} />
      </Link>
      <nav className="lp-sections" aria-label="Page">
        {SECTIONS.map((section) => (
          <a key={section.href} href={section.href} className="lp-nav">
            {section.label}
          </a>
        ))}
      </nav>
      <span className="lp-grow" />
      {signedIn ? (
        <Link href={SIGNED_IN_HOME} className="btn btn-ink pr lp-open">
          Open Moni
          <MdiIcon path={mdiArrowRight} size={20} />
        </Link>
      ) : (
        <>
          <Link href="/login" className="lp-nav">
            Sign in
          </Link>
          <Link href={WEB_APP_HREF} className="btn btn-out pr lp-open">
            Open the web app
          </Link>
        </>
      )}
      <button
        type="button"
        className="lp-menu-btn pr"
        aria-label={menuOpen ? 'Close the menu' : 'Menu'}
        aria-expanded={menuOpen}
        aria-controls="lp-menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <MdiIcon path={menuOpen ? mdiClose : mdiMenu} size={22} />
      </button>
      <nav id="lp-menu" className="lp-menu" aria-label="Menu" data-open={menuOpen}>
        {SECTIONS.map((section) => (
          <a key={section.href} href={section.href} onClick={() => setMenuOpen(false)}>
            {section.label}
          </a>
        ))}
        <Link href={signedIn ? SIGNED_IN_HOME : WEB_APP_HREF} className="btn btn-ink lp-full">
          {signedIn ? 'Open Moni' : 'Open the web app'}
        </Link>
      </nav>
    </header>
  );
}
