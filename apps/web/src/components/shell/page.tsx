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
function CommandField({ text }: { text: string }) {
  const { run } = useShellApi();
  return (
    <button type="button" className="cmd-field press" onClick={() => run({ kind: 'palette' })} aria-label={`${text}, command bar`}>
      <span className="ask-bubble">
        <AskMoniMark size={22} onInk id="cmdf" />
      </span>
      <span className="cmd-field-text">{text}</span>
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
  back = '/home',
  actions,
  commandText = 'Search or ask Moni',
  phoneSub,
  crumb,
  children,
}: {
  title: string;
  sub?: string;
  /** The page this one is pushed from, over the title: "Home ›". */
  crumb?: { label: string; href: string };
  phone: PhoneRole;
  /** Where the phone layout's back button goes from a pushed page. */
  back?: string;
  /** The page's own controls, before the command field (Customise, List | Table). */
  actions?: ReactNode;
  /** Null leaves the command field out, as Customise Home does. */
  commandText?: string | null;
  /** The phone Home header's date line over the greeting. */
  phoneSub?: string;
  children: ReactNode;
}) {
  const { user } = useShellApi();
  return (
    <>
      <header className="page-head" data-only="sidebar rail rail-one-column">
        <div style={{ minWidth: 0 }}>
          {crumb && (
            <nav aria-label="Breadcrumb" className="crumb">
              <Link href={crumb.href}>{crumb.label}</Link>
              <Icon name="chevron-right" size={16} />
            </nav>
          )}
          {sub && <div className="meta">{sub}</div>}
          <h1 className="page-title">{title}</h1>
        </div>
        <div className="page-actions">
          {actions}
          {commandText !== null && <CommandField text={commandText} />}
        </div>
      </header>
      <header className="phone-head" data-only="phone">
        {phone === 'home' && (
          <>
            <Link href="/settings" className="me-tile phone-me press" aria-label="Profile and settings">
              {user.initial}
            </Link>
            <div className="phone-greeting-block">
              {phoneSub && <div className="meta">{phoneSub}</div>}
              <h1 className="phone-greeting">{title}</h1>
            </div>
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
            <Link href={back} className="back-button press" aria-label="Back">
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
  children,
}: {
  mood: Mood;
  title: string;
  line: string;
  children?: ReactNode;
  action?: { label: string; icon: IconName; keys?: string; tone: 'ink' | 'sand'; run: ShellAction };
}) {
  const { run } = useShellApi();
  return (
    <section className="page-card">
      <div className="empty">
        <Cat mood={mood} size={72} id={`empty-${mood}`} />
        <h2 className="empty-title">{title}</h2>
        <p className="empty-line">{line}</p>
        {children}
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
