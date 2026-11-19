'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AskMoniMark, Cat, Wordmark } from '@/components/brand';
import { Icon } from '@/components/icon';
import { destinationOf, MAIN_NAV } from '@/lib/nav';
import { useOnline } from '@/components/states/connection';
import { useShellApi } from './shell-context';

/** W2-Parts "Full sidebar", 1360 and wider: the phone's Ink tab bar turned upright. */
export function Sidebar() {
  const { user, run, hrefWithPane, pane } = useShellApi();
  const online = useOnline();
  const current = destinationOf(usePathname());
  return (
    <nav aria-label="Moni" className="sidebar" data-only="sidebar">
      <div className="sidebar-top">
      <Link href={hrefWithPane('/home')} className="sidebar-logo" aria-label="Moni home">
        <Cat size={36} ground="deep" tile id="sb-logo" />
        <span className="wordmark">
          <Wordmark size={28} onInk />
        </span>
      </Link>
      <button type="button" className="nav-fold press" aria-label="Fold the sidebar" title="Fold the sidebar ([)" onClick={() => run({ kind: 'fold' })}>
        <Icon name="dock-left" size={20} />
        <span className="kbd kbd-inline">[</span>
      </button>
      </div>
      <button type="button" className="sidebar-add press" onClick={() => run({ kind: 'add' })}>
        <span className="add-dot">
          <Icon name="plus" size={18} />
        </span>
        <span>Add a transaction</span>
        <span className="kbd kbd-on-ink">N</span>
      </button>
      <span aria-hidden="true" style={{ height: 14 }} />
      {MAIN_NAV.map((item) => (
        <Link key={item.key} href={hrefWithPane(item.href)} className="navi" aria-current={current === item.key ? 'page' : undefined}>
          <Icon name={item.icon} size={22} />
          <span>{item.label}</span>
        </Link>
      ))}
      <span className="sidebar-rule" aria-hidden="true" />
      <button
        type="button"
        className="navi"
        aria-pressed={pane === 'chat'}
        data-offline={!online || undefined}
        title={online ? undefined : 'Moni chat needs a connection'}
        onClick={() => run({ kind: 'ask' })}
      >
        <AskMoniMark size={24} onInk id="sb-ask" />
        <span style={{ flex: '1 1 auto', color: 'var(--color-on-tab-bar)' }}>Ask Moni</span>
        <span className="kbd kbd-on-ink">/</span>
      </button>
      <span style={{ flex: '1 1 auto' }} />
      <button
        type="button"
        className="navi sidebar-me"
        aria-haspopup="menu"
        aria-current={current === 'settings' ? 'page' : undefined}
        onClick={(event) => run({ kind: 'account' }, event.currentTarget)}
      >
        <span className="me-tile">{user.initial}</span>
        <span className="sidebar-me-name">
          <span>{user.name}</span>
          <span>Settings</span>
        </span>
        <Icon name="cog-outline" size={20} />
      </button>
    </nav>
  );
}

/** W2-Parts "Rail", 700 to 1359: the sidebar folded, the same items in the same order, labelled. */
export function Rail() {
  const { user, run, hrefWithPane, pane } = useShellApi();
  const current = destinationOf(usePathname());
  return (
    <nav aria-label="Moni" className="rail" data-only="rail rail-one-column">
      <Link href={hrefWithPane('/home')} aria-label="Moni home" style={{ paddingBottom: 6 }}>
        <Cat size={40} ground="deep" tile id="rail-logo" />
      </Link>
      <button type="button" className="nav-fold press" data-fold aria-label="Open the sidebar" title="Open the sidebar ([)" onClick={() => run({ kind: 'fold' })}>
        <Icon name="dock-left" size={20} />
        <span className="kbd kbd-inline">[</span>
      </button>
      <button type="button" className="press" onClick={() => run({ kind: 'add' })} title="Add a transaction (N)">
        <span className="ind">
          <span className="add-dot">
            <Icon name="plus" size={18} />
          </span>
        </span>
        Add
      </button>
      <span aria-hidden="true" style={{ height: 6 }} />
      {MAIN_NAV.map((item) => (
        <Link key={item.key} href={hrefWithPane(item.href)} aria-current={current === item.key ? 'page' : undefined}>
          <span className="ind">
            <Icon name={item.icon} size={22} />
          </span>
          {item.label}
        </Link>
      ))}
      <span className="rail-rule" aria-hidden="true" />
      <button type="button" aria-pressed={pane === 'chat'} onClick={() => run({ kind: 'ask' })} title="Ask Moni (/)">
        <span className="ind">
          <AskMoniMark size={26} onInk id="rail-ask" />
        </span>
        Ask Moni
      </button>
      <span style={{ flex: '1 1 auto' }} />
      <button
        type="button"
        aria-haspopup="menu"
        aria-current={current === 'settings' ? 'page' : undefined}
        onClick={(event) => run({ kind: 'account' }, event.currentTarget)}
        title={`${user.name}, settings`}
      >
        <span className="ind" style={{ height: 40 }}>
          <span className="me-tile" style={{ width: 36, height: 36, borderRadius: 13, fontSize: 16 }}>
            {user.initial}
          </span>
        </span>
        {user.name}
      </button>
    </nav>
  );
}

/** The phone layout's floating Ink tab bar: Home · Activity · + · Budget · Debts (docs/redesign/tokens.md). */
export function TabBar() {
  const { run } = useShellApi();
  const pathname = usePathname();
  const current = destinationOf(pathname);
  const [home, activity, budget, debts] = MAIN_NAV;
  // Pushed pages (Review, Settings, and Home's own pages such as Where you spend) have no tab bar, as on the phone.
  if (!MAIN_NAV.some((item) => item.key === current) || pathname.startsWith('/home/')) return null;
  const cell = (item: typeof home) => (
    <Link key={item!.key} href={item!.href} className="tab" aria-current={current === item!.key ? 'page' : undefined}>
      <Icon name={item!.icon} size={24} />
      <span>{item!.label}</span>
    </Link>
  );
  return (
    <nav aria-label="Moni" className="tabbar" data-only="phone">
      {cell(home)}
      {cell(activity)}
      <span className="tab-plus-cell">
        <button type="button" className="tab-plus press" aria-label="Add a transaction" onClick={() => run({ kind: 'add' })}>
          <Icon name="plus" size={30} />
        </button>
      </span>
      {cell(budget)}
      {cell(debts)}
    </nav>
  );
}
