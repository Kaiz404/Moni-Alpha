'use client';

import { useValue } from '@legendapp/state/react';
import { updateProfilePreferences } from '@repo/data';
import { userPreferencesSchema, type MoniTone } from '@repo/types';
import Link from 'next/link';
import { useState } from 'react';
import { DeleteAccountDialog } from '@/components/account/delete-account-form';
import { Icon } from '@/components/icon';
import { showToast } from '@/components/shell/shell-store';
import { useShellApi } from '@/components/shell/shell-context';
import { useTheme } from '@/components/use-theme';
import { moniStore } from '@/lib/moni-store';
import type { ThemePref } from '@/lib/theme';

const THEMES: { pref: ThemePref; label: string }[] = [
  { pref: 'light', label: 'Light' },
  { pref: 'dark', label: 'Dark' },
  { pref: 'system', label: 'System' },
];

/** The phone's Moni's tone sheet, as a row of three choices. */
export const TONES: Record<MoniTone, { title: string; meta: string }> = {
  friendly: { title: 'Friendly', meta: 'Warm and short, with a kind word' },
  direct: { title: 'Straight to the point', meta: 'Just the answer and its number' },
  playful: { title: 'Playful', meta: 'Short, with a little joke' },
};

/**
 * Shows the pick at once, then writes `preferences.moni_tone`; a refused write puts the old one back.
 * Returns whether the server kept it.
 */
async function saveTone(tone: MoniTone): Promise<boolean> {
  const store = moniStore();
  const previous = store.profilePreferences$.peek();
  store.profilePreferences$.set({ ...userPreferencesSchema.parse(previous ?? {}), moni_tone: tone });
  try {
    store.profilePreferences$.set(await updateProfilePreferences(store.supabase, { moni_tone: tone }));
    return true;
  } catch {
    store.profilePreferences$.set(previous);
    showToast({ text: "Couldn't change Moni's tone. Try again.", tone: 'error' });
    return false;
  }
}

/** Settings › Profile: who you are, the theme, Moni's tone, the privacy policy and terms, Sign out and Delete your account. */
export function ProfileSection() {
  const { user, run } = useShellApi();
  const { pref, setTheme } = useTheme();
  const picked = useValue(() => moniStore().profilePreferences$.get()?.moni_tone ?? 'friendly');
  const [deleting, setDeleting] = useState(false);

  const pickTone = (tone: MoniTone) => {
    if (tone === picked) return;
    const before = picked;
    void saveTone(tone).then((kept) => {
      if (kept) showToast({ text: `Moni's tone: ${TONES[tone].title}`, tone: 'done', undo: () => void saveTone(before) });
    });
  };

  return (
    <section className="set-card" aria-labelledby="profile-title">
      <h2 id="profile-title" className="set-title">
        Profile
      </h2>
      <div className="set-group">
        <div className="set-row">
          <Icon name="account-outline" size={20} />
          <span className="set-row-title" style={{ flex: '1 1 auto' }}>
            Name
          </span>
          <span className="set-row-value">{user.name}</span>
        </div>
        <div className="set-row">
          <Icon name="email-outline" size={20} />
          <span className="set-row-title" style={{ flex: '1 1 auto' }}>
            Email
          </span>
          <span className="set-row-value">{user.email}</span>
        </div>
        <div className="set-row">
          <Icon name="weather-night" size={20} />
          <span className="set-row-title" style={{ flex: '1 1 auto' }}>
            Theme
          </span>
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
      </div>
      <div className="set-group">
        <div className="set-row" style={{ flexWrap: 'wrap', paddingTop: 12, paddingBottom: 14 }}>
          <span className="set-row-text" style={{ flexBasis: '100%' }}>
            <span className="set-row-title" id="tone-label">
              Moni&apos;s tone
            </span>
            <span className="set-row-meta">How Moni sounds in chat. The numbers stay the same.</span>
          </span>
          <span className="tone-options" role="radiogroup" aria-labelledby="tone-label">
            {(Object.keys(TONES) as MoniTone[]).map((tone) => (
              <button
                key={tone}
                type="button"
                role="radio"
                className="tone-option press"
                aria-checked={picked === tone}
                title={TONES[tone].meta}
                onClick={() => pickTone(tone)}
              >
                {TONES[tone].title}
              </button>
            ))}
          </span>
        </div>
      </div>
      <div className="set-group">
        <Link href="/privacy" className="set-row">
          <Icon name="file-document-outline" size={20} />
          <span className="set-row-title" style={{ flex: '1 1 auto' }}>
            Privacy policy
          </span>
          <Icon name="chevron-right" size={20} />
        </Link>
        <Link href="/terms" className="set-row">
          <Icon name="file-document-outline" size={20} />
          <span className="set-row-title" style={{ flex: '1 1 auto' }}>
            Terms
          </span>
          <Icon name="chevron-right" size={20} />
        </Link>
      </div>
      <div className="set-group">
        <button type="button" className="set-row" onClick={() => run({ kind: 'signOut' })}>
          <Icon name="logout" size={20} />
          <span className="set-row-title">Sign out</span>
        </button>
        <button type="button" className="set-row" data-tone="over" aria-haspopup="dialog" onClick={() => setDeleting(true)}>
          <Icon name="account-remove-outline" size={20} />
          <span className="set-row-title">Delete your account</span>
        </button>
      </div>
      {deleting && <DeleteAccountDialog userId={user.id} zone={user.zone} onClose={() => setDeleting(false)} />}
    </section>
  );
}
