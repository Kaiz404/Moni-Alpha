/**
 * Settings' sections (W2-Data's section nav). Only sections that work are listed; Wallets, Categories,
 * Rules and Capture sources join when they are built. Under 700 wide the same list is the phone's
 * Profile rows, each a pushed page.
 */
export type SettingsSection = 'profile' | 'ai' | 'merchants' | 'import';

export type SettingsNavItem = { key: SettingsSection; label: string; href: `/settings/${string}` };

export const SETTINGS_GROUPS: readonly { caption: string; items: readonly SettingsNavItem[] }[] = [
  {
    caption: 'Account',
    items: [
      { key: 'profile', label: 'Profile', href: '/settings/profile' },
      { key: 'ai', label: "Moni's AI", href: '/settings/ai' },
    ],
  },
  { caption: 'Money', items: [{ key: 'merchants', label: 'Merchant names', href: '/settings/merchants' }] },
  { caption: 'Data', items: [{ key: 'import', label: 'Import and export', href: '/settings/import' }] },
];

/** Where a Settings path is: the section the nav marks, the phone's title, and where its Back goes. */
export type SettingsPlace = { section: SettingsSection; index: boolean; phoneTitle: string; back: string };

export function settingsPlace(pathname: string): SettingsPlace {
  const path = pathname.replace(/\/$/, '');
  if (path === '/settings/delete-account') {
    return { section: 'profile', index: false, phoneTitle: 'Delete your account', back: '/settings/profile' };
  }
  const item = SETTINGS_GROUPS.flatMap((group) => group.items).find((each) => path === each.href);
  if (!item) return { section: 'profile', index: true, phoneTitle: 'Settings', back: '/home' };
  return { section: item.key, index: false, phoneTitle: item.label, back: '/settings' };
}
