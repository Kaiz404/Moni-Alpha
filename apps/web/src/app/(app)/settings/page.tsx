'use client';

import Link from 'next/link';
import { Icon } from '@/components/icon';
import { Page } from '@/components/shell/page';
import { useShellApi } from '@/components/shell/shell-context';
import { useTheme } from '@/components/use-theme';
import type { ThemePref } from '@/lib/theme';

const THEMES: { pref: ThemePref; label: string }[] = [
  { pref: 'light', label: 'Light' },
  { pref: 'dark', label: 'Dark' },
  { pref: 'system', label: 'System' },
];

/** Settings until W2-Data's sections arrive: Theme, Sign out and Delete your account. */
export default function SettingsPage() {
  const { user, run } = useShellApi();
  const { pref, setTheme } = useTheme();
  return (
    <Page title="Settings" sub={`${user.name} · your data in Moni`} phone="pushed">
      <section className="page-card settings-card">
        <div className="settings-row">
          <Icon name="weather-night" size={22} />
          <span style={{ flex: '1 1 auto', fontWeight: 600 }}>Theme</span>
          <span className="seg seg-light" role="radiogroup" aria-label="Theme">
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
        <button type="button" className="settings-row" onClick={() => run({ kind: 'signOut' })}>
          <Icon name="logout" size={22} />
          <span style={{ flex: '1 1 auto', fontWeight: 600 }}>Sign out</span>
        </button>
        <Link href="/settings/delete-account" className="settings-row settings-row-over">
          <Icon name="account-remove-outline" size={22} />
          <span style={{ flex: '1 1 auto', fontWeight: 600 }}>Delete your account</span>
          <Icon name="chevron-right" size={20} />
        </Link>
      </section>
    </Page>
  );
}
