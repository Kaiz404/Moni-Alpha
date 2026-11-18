import type { IconName } from './icons';

/**
 * Every place the shell can go. The sidebar, the rail, the phone tab bar, the Ctrl K palette, the
 * G-then-letter keys and the shortcuts dialog all read this one list.
 */
export type Destination = 'home' | 'activity' | 'budget' | 'debts' | 'review' | 'settings';

export type NavItem = {
  key: Destination;
  label: string;
  href: `/${Destination}`;
  icon: IconName;
  /** The letter after G that goes here. */
  go: string;
  /** Main sections sit above the sidebar's divider and in the phone tab bar. */
  section: 'main' | 'review' | 'account';
};

export const NAV: readonly NavItem[] = [
  { key: 'home', label: 'Home', href: '/home', icon: 'home', go: 'h', section: 'main' },
  { key: 'activity', label: 'Activity', href: '/activity', icon: 'receipt-text', go: 'a', section: 'main' },
  { key: 'budget', label: 'Budget', href: '/budget', icon: 'chart-box', go: 'b', section: 'main' },
  { key: 'debts', label: 'Debts', href: '/debts', icon: 'handshake-outline', go: 'd', section: 'main' },
  { key: 'review', label: 'Review', href: '/review', icon: 'tray-full', go: 'r', section: 'review' },
  { key: 'settings', label: 'Settings', href: '/settings', icon: 'cog-outline', go: 's', section: 'account' },
];

export const MAIN_NAV = NAV.filter((item) => item.section === 'main');

export function navItem(key: Destination): NavItem {
  return NAV.find((item) => item.key === key)!;
}

/** The destination a path belongs to, or null outside the app. */
export function destinationOf(pathname: string): Destination | null {
  return NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.key ?? null;
}
