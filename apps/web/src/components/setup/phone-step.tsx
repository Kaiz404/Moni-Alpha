'use client';

import type { ReactNode } from 'react';
import { QrCode } from '@/components/auth/qr-code';
import { Glyph } from '@/components/ledger/glyph';
import { Fact } from '@/components/marketing/fact';
import { phoneLinkMail } from '@/lib/setup';
import { SITE_FACTS, factText } from '@/lib/site-facts';
import { Item } from './setup-item';

/** Step 4, Get Moni on your phone: the Play link as a QR, Google Play, and the link mailed to yourself. */
export function PhoneStep({ email, footer }: { email: string; footer: ReactNode }) {
  const play = factText('googlePlayUrl');
  const confirmed = SITE_FACTS.googlePlayUrl.confirmed;
  return (
    <>
      <h1 className="setup-h" id="setup-title">
        Get Moni on your phone
      </h1>
      <p className="setup-lead">Bank alerts and receipts are captured on your phone. Everything it captures shows here too, on the same account.</p>
      <div className="setup-card setup-qr-card">
        <QrCode value={play} size={150} />
        <div className="setup-qr-text">
          <b>Point your phone&apos;s camera here</b>
          <a className="setup-store press" href={confirmed ? play : undefined} target="_blank" rel="noreferrer" aria-disabled={!confirmed || undefined}>
            <Glyph name="google-play" size={22} />
            <span>
              <small>Get it on</small>
              Google Play
            </span>
          </a>
          {!confirmed && <Fact name="googlePlayUrl" />}
          <a className="link setup-mail" href={phoneLinkMail(email, play)}>
            <Glyph name="send-outline" size={16} />
            Email me the link
          </a>
        </div>
      </div>
      <div className="setup-card setup-why">
        <span className="caps">Why the phone</span>
        <Item icon="bell-ring-outline" title="Bank alerts" line="Moni reads a payment alert as it arrives and files it. Android only: iPhone keeps alerts private to each app." />
        <Item icon="camera-outline" title="Receipts" line="Snap one at the till and Moni reads the shop and the total." />
        <Item icon="microphone" title="Say it" line="“Mamak Ali, 13.20, cash” and it's in." />
      </div>
      {footer}
    </>
  );
}
