'use client';

import { bindPersistentLayer } from '@ui-sdk/core';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle } from '@ui-sdk/react/dialog';
import { Menu, MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem } from '@ui-sdk/react/menu';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { useTheme } from '@/components/use-theme';
import { SHORTCUT_GROUPS } from '@/lib/keys';
import type { ThemePref } from '@/lib/theme';
import { useShellApi } from './shell-context';
import { Glyph } from '@/components/ledger/glyph';
import { dismissToast, undoToast, useToast, type ToastTone } from './shell-store';

/**
 * Open while mounted; a close plays the exit first, then hands back to the shell. The shell's overlay
 * state stays the one switch, so `?` and the account name still open and close these.
 */
function useExit(close: () => void) {
  const [open, setOpen] = useState(true);
  return {
    open,
    onOpenChange: (next: boolean) => {
      if (!next) setOpen(false);
    },
    onOpenChangeComplete: (isOpen: boolean) => {
      if (!isOpen) close();
    },
  };
}

/** W2-Parts "Keyboard shortcuts", on ?. Screens add their groups as they arrive. */
export function ShortcutsDialog() {
  const { run } = useShellApi();
  const exit = useExit(() => run({ kind: 'close' }));
  return (
    <Dialog {...exit}>
      <DialogBackdrop className="scrim scrim-center" />
      <DialogContent className="dialog motion-grow" onKeyDown={(event) => event.stopPropagation()}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <DialogTitle className="dialog-title">Keyboard shortcuts</DialogTitle>
          <DialogClose className="pane-close press" autoFocus aria-label="Close">
            <Icon name="close" size={20} />
            <span className="kbd">Esc</span>
          </DialogClose>
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
      </DialogContent>
    </Dialog>
  );
}

const THEMES: { pref: ThemePref; label: string }[] = [
  { pref: 'light', label: 'Light' },
  { pref: 'dark', label: 'Dark' },
  { pref: 'system', label: 'System' },
];

/**
 * W2-Parts "Account menu": opens from the name at the foot of the sidebar or rail. Theme switches in
 * place. ui-sdk's menu gives it arrow keys, type-to-find, Esc and a press outside, and keeps it on screen.
 */
export function AccountMenu({ anchor }: { anchor: DOMRect | null }) {
  const { user, run } = useShellApi();
  const { pref, setTheme } = useTheme();
  const menu = useRef<HTMLDivElement>(null);
  const exit = useExit(() => run({ kind: 'close' }));
  // A menu rendered open leaves the focus where it was; the shell opens this one from its name, so Settings takes it.
  useEffect(() => {
    const frame = requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const wide = anchor ? anchor.width > 120 : true;
  const box = anchor ?? new DOMRect(20, innerHeight - 88, 0, 0);

  return (
    <Menu {...exit} modal={false}>
      <MenuContent
        ref={menu}
        aria-label="Account"
        className="account-menu motion-pop"
        anchor={{ getBoundingClientRect: () => box }}
        side={wide ? 'top' : 'right'}
        align={wide ? 'start' : 'end'}
        sideOffset={wide ? 8 : 12}
        collisionPadding={8}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="account-head">
          <span className="me-tile">{user.initial}</span>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: 16 }}>{user.name}</strong>
            <span style={{ fontSize: 13, color: 'var(--color-inactive)' }}>Main currency {user.currency}</span>
          </span>
        </div>
        <MenuItem className="menu-item" onSelect={() => run({ kind: 'go', to: 'settings' })}>
          <Icon name="cog-outline" size={22} />
          Settings
        </MenuItem>
        <div className="menu-item" style={{ cursor: 'default' }}>
          <Icon name="weather-night" size={22} />
          <span style={{ flex: '1 1 auto' }}>Theme</span>
          <MenuRadioGroup
            aria-label="Theme"
            value={pref}
            onValueChange={(value) => {
              const button = menu.current?.querySelector<HTMLElement>(`[data-pref="${value}"]`)?.getBoundingClientRect();
              setTheme(value as ThemePref, button ? { x: button.left + button.width / 2, y: button.top + button.height / 2 } : undefined);
            }}
            render={<span className="seg" />}
          >
            {THEMES.map((theme) => (
              <MenuRadioItem key={theme.pref} value={theme.pref} data-pref={theme.pref} render={<button type="button" />}>
                {theme.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </div>
        <MenuItem className="menu-item" onSelect={() => run({ kind: 'shortcuts' })}>
          <Icon name="keyboard-outline" size={22} />
          <span style={{ flex: '1 1 auto' }}>Shortcuts</span>
          <span className="kbd kbd-on-ink">?</span>
        </MenuItem>
        <MenuItem className="menu-item" label="Help" render={<a href="/help" />}>
          <Icon name="help-circle-outline" size={22} />
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            Help
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-inactive)' }}>Guides, privacy policy and terms</span>
          </span>
        </MenuItem>
        <span className="menu-rule" aria-hidden="true" />
        <MenuItem className="menu-item" onSelect={() => run({ kind: 'signOut' })}>
          <Icon name="logout" size={22} />
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

const TOAST_MS: Record<ToastTone, number | null> = { done: 4000, info: 4000, undone: 2000, error: null };
const TOAST_ICON: Record<ToastTone, string> = { done: 'check-circle', undone: 'undo', error: 'alert-circle', info: 'information-outline' };

/**
 * Toasts bottom left (above the tab bar on the phone layout), one at a time. The Mint bar runs out with
 * the time left and stops while pointed at; the toast closes when the bar ends. An error stays. It is a
 * ui-sdk persistent layer: Undo works under a confirm, and pressing it never closes an open popover.
 */
export function Toaster() {
  const toast = useToast();
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => (toast && slot.current ? bindPersistentLayer(slot.current) : undefined), [toast]);
  if (!toast) return null;
  return (
    <div ref={slot} className="toast-slot">
      <div key={toast.id} role="status" className="toast motion-rise" data-tone={toast.tone}>
        <Glyph name={TOAST_ICON[toast.tone]} size={20} className="toast-icon" />
        <span style={{ fontSize: 14, lineHeight: '19px' }}>{toast.text}</span>
        {toast.undo && (
          <button type="button" className="toast-action press" onClick={() => undoToast()}>
            <Icon name="undo" size={18} />
            Undo
            <span className="kbd kbd-on-ink" data-only="sidebar rail rail-one-column">
              Ctrl Z
            </span>
          </button>
        )}
        {toast.retry && (
          <button
            type="button"
            className="toast-action press"
            onClick={() => {
              dismissToast(toast.id);
              toast.retry?.();
            }}
          >
            <Icon name="refresh" size={18} />
            Try again
          </button>
        )}
        {toast.tone === 'error' && (
          <button type="button" className="toast-action toast-close press" aria-label="Close" onClick={() => dismissToast(toast.id)}>
            <Icon name="close" size={18} />
          </button>
        )}
        {TOAST_MS[toast.tone] !== null && (
          <span
            aria-hidden="true"
            className="toast-timer"
            style={{ animationDuration: `${TOAST_MS[toast.tone]}ms` }}
            onAnimationEnd={() => dismissToast(toast.id)}
          />
        )}
      </div>
    </div>
  );
}
