'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '@/components/icon';
import { useTheme } from '@/components/use-theme';
import { SHORTCUT_GROUPS } from '@/lib/keys';
import type { ThemePref } from '@/lib/theme';
import { useShellApi } from './shell-context';
import { dismissToast, undoToast, useToast } from './shell-store';

/** W2-Parts "Keyboard shortcuts", on ?. Screens add their groups as they arrive. */
export function ShortcutsDialog() {
  const { run } = useShellApi();
  return (
    <div className="scrim scrim-center" onMouseDown={(event) => event.target === event.currentTarget && run({ kind: 'close' })}>
      <div role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" className="dialog motion-grow">
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 id="shortcuts-title" className="dialog-title">
            Keyboard shortcuts
          </h2>
          <button type="button" className="pane-close press" autoFocus onClick={() => run({ kind: 'close' })} aria-label="Close">
            <Icon name="close" size={20} />
            <span className="kbd">Esc</span>
          </button>
        </header>
        <div className="shortcut-grid">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="caps" style={{ margin: '8px 0 6px' }}>
                {group.title}
              </h3>
              {group.rows.map((row) => (
                <div key={row.label} className="shortcut-row">
                  <span>{row.label}</span>
                  <span className="keys">
                    {row.keys.map((key) => (
                      <span key={key} className="kbd">
                        {key}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
        <p className="meta" style={{ margin: '18px 0 0' }}>
          Shortcuts rest while you type in a field. G then a letter moves between sections.
        </p>
      </div>
    </div>
  );
}

const THEMES: { pref: ThemePref; label: string }[] = [
  { pref: 'light', label: 'Light' },
  { pref: 'dark', label: 'Dark' },
  { pref: 'system', label: 'System' },
];

/** W2-Parts "Account menu": opens from the name at the foot of the sidebar or rail. Theme switches in place. */
export function AccountMenu({ anchor }: { anchor: DOMRect | null }) {
  const { user, run } = useShellApi();
  const { pref, setTheme } = useTheme();
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) run({ kind: 'close' });
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [run]);

  const style = anchor
    ? anchor.width > 120
      ? { left: anchor.left, bottom: innerHeight - anchor.top + 8 }
      : { left: anchor.right + 12, bottom: innerHeight - anchor.bottom }
    : { left: 20, bottom: 88 };

  return (
    <div ref={menu} role="menu" aria-label="Account" className="account-menu motion-pop" style={style}>
      <div className="account-head">
        <span className="me-tile">{user.initial}</span>
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <strong style={{ fontSize: 16 }}>{user.name}</strong>
          <span style={{ fontSize: 13, color: 'var(--color-inactive)' }}>Main currency {user.currency}</span>
        </span>
      </div>
      <button type="button" role="menuitem" className="menu-item" onClick={() => run({ kind: 'go', to: 'settings' })}>
        <Icon name="cog-outline" size={22} />
        Settings
      </button>
      <div className="menu-item" style={{ cursor: 'default' }}>
        <Icon name="weather-night" size={22} />
        <span style={{ flex: '1 1 auto' }}>Theme</span>
        <span className="seg" role="radiogroup" aria-label="Theme">
          {THEMES.map((theme) => (
            <button
              key={theme.pref}
              type="button"
              role="radio"
              aria-checked={pref === theme.pref}
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                setTheme(theme.pref, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
              }}
            >
              {theme.label}
            </button>
          ))}
        </span>
      </div>
      <button type="button" role="menuitem" className="menu-item" onClick={() => run({ kind: 'shortcuts' })}>
        <Icon name="keyboard-outline" size={22} />
        <span style={{ flex: '1 1 auto' }}>Shortcuts</span>
        <span className="kbd kbd-on-ink">?</span>
      </button>
      <a role="menuitem" className="menu-item" href="/help">
        <Icon name="help-circle-outline" size={22} />
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          Help
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-inactive)' }}>Guides, privacy policy and terms</span>
        </span>
      </a>
      <span className="menu-rule" aria-hidden="true" />
      <button type="button" role="menuitem" className="menu-item" onClick={() => run({ kind: 'signOut' })}>
        <Icon name="logout" size={22} />
        Sign out
      </button>
    </div>
  );
}

const TOAST_MS = 4000;

/**
 * Toasts bottom left (above the tab bar on the phone layout), one at a time. The Mint bar runs out with
 * the time left and stops while pointed at; the toast closes when the bar ends. An error stays.
 */
export function Toaster() {
  const toast = useToast();
  if (!toast) return null;
  return (
    <div className="toast-slot">
      <div key={toast.id} role="status" className="toast motion-rise" data-tone={toast.tone}>
        <Icon name={toast.tone === 'error' ? 'alert-circle-outline' : 'check-circle'} size={20} className="toast-icon" />
        <span style={{ fontSize: 14, lineHeight: '19px' }}>{toast.text}</span>
        {toast.undo && (
          <button type="button" className="toast-action press" onClick={() => undoToast()}>
            <Icon name="undo" size={18} />
            Undo
          </button>
        )}
        {toast.tone === 'error' && (
          <button type="button" className="toast-action press" aria-label="Close" onClick={() => dismissToast(toast.id)}>
            <Icon name="close" size={18} />
          </button>
        )}
        {toast.tone !== 'error' && (
          <span
            aria-hidden="true"
            className="toast-timer"
            style={{ animationDuration: `${TOAST_MS}ms` }}
            onAnimationEnd={() => dismissToast(toast.id)}
          />
        )}
      </div>
    </div>
  );
}
