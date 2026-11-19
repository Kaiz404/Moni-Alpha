'use client';

import { dateLabel, turnOnFor, UNASKED, type AiConsent, type ConsentChange } from '@repo/core';
import type { AiUse } from '@repo/types';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AskMoniMark } from '@/components/brand';
import { showToast } from '@/components/shell/shell-store';
import { changeAiConsent, useAiConsent } from '@/lib/ai';
import { clockTime } from '@/lib/ledger/format';
import { useLedger } from '@/lib/ledger/use-ledger';
import { Mdi, SETTINGS_ICONS } from './mdi';

/** The phone's words (Profile › Moni's AI), with W2-Parts' icons. */
const USES: { use: AiUse; icon: ReactNode; title: string; meta?: string }[] = [
  { use: 'alerts', icon: <Mdi path={SETTINGS_ICONS.alerts} />, title: 'Payment alerts from the apps you link', meta: 'One-time codes never leave your phone.' },
  { use: 'add', icon: <Mdi path={SETTINGS_ICONS.add} />, title: 'What you say in Add', meta: 'Voice is turned into text on your phone when it can be.' },
  { use: 'receipts', icon: <Mdi path={SETTINGS_ICONS.receipts} />, title: 'Receipt photos you scan' },
  { use: 'chat', icon: <AskMoniMark size={22} id="ai-use-chat" />, title: 'What you send in Moni chat', meta: 'With the figures Moni needs to answer.' },
];

function Switch({ label, on, disabled, onChange }: { label: string; on: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-label={label}
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
    />
  );
}

/**
 * Settings › Moni's AI (W2-Parts): one switch for all of Moni's AI and one per use, every one off until
 * the user turns it on. The switches move at once; a change the server refuses moves them back.
 */
export function AiSection() {
  const consent: AiConsent = useAiConsent() ?? UNASKED;
  const { calendar, now, mounted } = useLedger();
  const on = consent.kind === 'answered' && consent.on;
  const master =
    consent.kind === 'unasked'
      ? 'Off. Nothing goes to AI.'
      : mounted
        ? `Turned ${consent.on ? 'on' : 'off'} by you on ${dateLabel(calendar.dayKey(consent.at), calendar.dayKey(now))}, ${clockTime(consent.at, calendar.zone)}`
        : '';

  const change = (next: ConsentChange) => {
    changeAiConsent(next).catch(() => showToast({ text: "Couldn't save the change. Check your connection.", tone: 'error' }));
  };

  return (
    <section className="set-card" aria-labelledby="ai-title">
      <div className="set-head">
        <h2 id="ai-title" className="set-title">
          Moni&apos;s AI
        </h2>
        <span className="ai-tag">AI</span>
      </div>
      <div className="set-group">
        <div className="set-row" style={{ minHeight: 64 }}>
          <span className="set-row-text">
            <span className="set-row-title" style={{ fontSize: 16, fontWeight: 700 }}>
              Let Moni use AI
            </span>
            <span className="set-row-meta" data-testid="ai-master-meta">
              {master}
            </span>
          </span>
          <Switch
            label="Let Moni use AI"
            on={on}
            onChange={(next) => change(next && consent.kind === 'unasked' ? turnOnFor(consent, 'chat') : { all: next })}
          />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="caps" style={{ color: 'var(--color-muted)' }}>
          What Moni sends, and only when you use it
        </span>
        <div className="set-group">
          {USES.map((row) => (
            <div key={row.use} className="set-row" aria-disabled={!on || undefined} style={{ minHeight: 60 }}>
              {row.icon}
              <span className="set-row-text">
                <span className="set-row-title">{row.title}</span>
                {row.meta && <span className="set-row-meta">{row.meta}</span>}
              </span>
              <Switch
                label={row.title}
                on={consent.kind === 'answered' && consent.uses[row.use]}
                disabled={!on}
                onChange={(next) => change({ [row.use]: next })}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="set-notes">
        <div className="set-note">
          <b>Who reads it</b>
          <span>OpenRouter, an AI service in the US, passes it to the AI model that reads it. Neither keeps it or trains on it.</span>
        </div>
        <div className="set-note">
          <b>What Moni keeps</b>
          <span>The transaction it makes, stored in your account in Moni&apos;s cloud database, the same as one you add by hand.</span>
        </div>
      </div>
      <p className="set-small">
        With AI off you can still add, edit and import by hand; alerts, receipts and voice wait for you.{' '}
        <Link href="/privacy" className="see-all" style={{ minHeight: 0, display: 'inline' }}>
          Privacy policy
        </Link>
      </p>
    </section>
  );
}

