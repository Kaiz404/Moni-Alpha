'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AskMoniMark, Cat } from '@/components/brand';
import { Icon } from '@/components/icon';
import type { IconName } from '@/lib/icons';
import type { Mood } from '@repo/brand';
import { useShellApi, type ShellAction } from './shell-context';

/** How the page sits in the phone layout: a tab root (in the tab bar) or a page pushed over one. */
export type PhoneRole = 'home' | 'tab' | 'tab-with-moni' | 'pushed';

/** The command field from W2-Home's header: opens Ctrl K. */
function CommandField() {
  const { run } = useShellApi();
  return (
    <button type="button" className="cmd-field press" onClick={() => run({ kind: 'palette' })} aria-label="Search or ask Moni, command bar">
      <span className="ask-bubble">
        <AskMoniMark size={22} onInk id="cmdf" />
      </span>
      <span className="cmd-field-text">Search or ask Moni</span>
      <span className="kbd">Ctrl K</span>
    </button>
  );
}

function AskMoniButton() {
  const { run } = useShellApi();
  return (
    <button type="button" className="ask-button press" aria-label="Ask Moni" onClick={() => run({ kind: 'ask' })}>
      <AskMoniMark size={26} onInk id="askb" />
    </button>
  );
}

export function Page({
  title,
  sub,
  phone,
  children,
}: {
  title: string;
  sub?: string;
  phone: PhoneRole;
  children: ReactNode;
}) {
  const { user } = useShellApi();
  return (
    <>
      <header className="page-head" data-only="sidebar rail rail-one-column">
        <div style={{ minWidth: 0 }}>
          {sub && <div className="meta">{sub}</div>}
          <h1 className="page-title">{title}</h1>
        </div>
        <CommandField />
      </header>
      <header className="phone-head" data-only="phone">
        {phone === 'home' && (
          <>
            <Link href="/settings" className="me-tile phone-me press" aria-label="Profile and settings">
              {user.initial}
            </Link>
            <h1 className="phone-greeting">{title}</h1>
            <AskMoniButton />
          </>
        )}
        {(phone === 'tab' || phone === 'tab-with-moni') && (
          <>
            <h1 className="phone-title">{title}</h1>
            {phone === 'tab-with-moni' && <AskMoniButton />}
          </>
        )}
        {phone === 'pushed' && (
          <>
            <Link href="/home" className="back-button press" aria-label="Back">
              <Icon name="chevron-left" size={22} />
            </Link>
            <h1 className="phone-pushed-title">{title}</h1>
          </>
        )}
      </header>
      {children}
    </>
  );
}

/** W2-Empty's page empty: the 72 cat in one mood, a title, one plain line and at most one button. */
export function PageEmpty({
  mood,
  title,
  line,
  action,
}: {
  mood: Mood;
  title: string;
  line: string;
  action?: { label: string; icon: IconName; keys?: string; tone: 'ink' | 'sand'; run: ShellAction };
}) {
  const { run } = useShellApi();
  return (
    <section className="page-card">
      <div className="empty">
        <Cat mood={mood} size={72} id={`empty-${mood}`} />
        <h2 className="empty-title">{title}</h2>
        <p className="empty-line">{line}</p>
        {action && (
          <button type="button" className={`btn btn-${action.tone} press`} onClick={() => run(action.run)}>
            <Icon name={action.icon} size={20} />
            {action.label}
            {action.keys && <span className="kbd kbd-on-ink">{action.keys}</span>}
          </button>
        )}
      </div>
    </section>
  );
}
