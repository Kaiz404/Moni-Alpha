'use client';

import { useEffect, useState } from 'react';
import { Cat } from '@/components/brand';
import { Icon } from '@/components/icon';
import { Glyph } from '@/components/ledger/glyph';
import { showsGetApp } from '@/lib/setup';
import { SITE_FACTS, factText } from '@/lib/site-facts';

const CLOSED_KEY = 'moni-get-app-closed';

function closedAt(): number | null {
  try {
    const value = Number(window.localStorage.getItem(CLOSED_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** W2-Responsive: on an Android phone, Home says once, under the greeting, that the app catches bank alerts. */
export function GetAppBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(showsGetApp(navigator.userAgent, closedAt(), Date.now())), []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      window.localStorage.setItem(CLOSED_KEY, String(Date.now()));
    } catch {
      // A private window keeps it closed until the tab closes.
    }
  };
  return (
    <section aria-label="Get the Moni app" className="get-app motion-rise" data-only="phone">
      <div className="get-app-top">
        <Cat size={40} ground="deep" tile id="get-app" />
        <span className="get-app-text">
          <b>Moni catches bank alerts in the app</b>
          <span>Same account. Nothing to move.</span>
        </span>
        <button type="button" className="get-app-close press" aria-label="Not now" onClick={close}>
          <Icon name="close" size={20} />
        </button>
      </div>
      <a className="btn btn-ink press" href={SITE_FACTS.googlePlayUrl.confirmed ? factText('googlePlayUrl') : undefined} target="_blank" rel="noreferrer">
        <Glyph name="download" size={20} />
        Get the app
      </a>
    </section>
  );
}
