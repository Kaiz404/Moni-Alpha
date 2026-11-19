import { mdiChevronRight, mdiShieldAccountOutline, mdiTrayArrowDown } from '@mdi/js';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Fact } from './fact';
import { LandingH2, MdiIcon } from './parts';
import { PrivacyAiSwitch } from './privacy-ai-switch';
import './privacy.css';

const FACTS: readonly { title: string; body: ReactNode }[] = [
  { title: 'No bank logins.', body: 'Moni never asks for your bank password and never moves money.' },
  {
    title: 'AI only if you say yes.',
    body: (
      <>
        Reading an alert, a receipt or your voice uses an AI model. Moni asks before the first time, and typing works without it.{' '}
        <Fact name="aiNoRetention" />
      </>
    ),
  },
  {
    title: 'Leave whenever you like.',
    body: 'Export your transactions as a CSV file, or delete your account and everything in it, from the app or the web.',
  },
];

export function LandingPrivacy() {
  return (
    <section id="privacy" aria-labelledby="pv-h" className="lp-sec pv-sec">
      <div className="pv-block">
        <LandingH2 id="pv-h" onDeep>
          Your data stays yours.
        </LandingH2>
        <div className="pv-facts">
          {FACTS.map((fact) => (
            <div key={fact.title} className="pv-fact">
              <h3>{fact.title}</h3>
              <p>{fact.body}</p>
            </div>
          ))}
        </div>
        <Link href="/privacy" className="pv-link">
          Read the privacy policy
          <MdiIcon path={mdiChevronRight} size={20} />
        </Link>
        <section aria-label="Settings, your data" className="pv-card">
          <div className="pv-card-head">
            <span className="pv-card-icon">
              <MdiIcon path={mdiShieldAccountOutline} size={20} />
            </span>
            <h3>Your data</h3>
            <span className="pv-card-tag">Settings</span>
          </div>
          <div className="pv-group">
            <PrivacyAiSwitch />
            <div className="pv-row">
              <span className="pv-row-text">
                <span className="pv-row-title">Stored in Moni’s cloud database</span>
                <span className="pv-row-sub">
                  Encrypted in transit and at rest. <Fact name="dataRegion" />
                </span>
              </span>
            </div>
            <div className="pv-row">
              <span className="pv-row-title">Export transactions as CSV</span>
              <MdiIcon path={mdiTrayArrowDown} size={20} className="pv-row-icon" />
            </div>
            <Link href="/delete-account" className="pv-row pv-row-button">
              <span className="pv-row-title pv-danger">Delete your account</span>
              <MdiIcon path={mdiChevronRight} size={20} className="pv-row-chev" />
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
