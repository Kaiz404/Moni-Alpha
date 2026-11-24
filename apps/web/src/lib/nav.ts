import type { IconName } from './icons';
import { reviewHref } from './review-view';

/**
 * Every place the shell can go. The sidebar, the rail, the phone tab bar, the Ctrl K palette, the
 * G-then-letter keys and the shortcuts dialog all read this one list. Review is not a page: it is the
 * drawer on Home (#104), so the palette and G R open Home with it.
 */
export type Destination = 'home' | 'activity' | 'budget' | 'debts' | 'wallets' | 'places' | 'review' | 'settings';

export type NavItem = {
  key: Destination;
  label: string;
  /** The rail's label when the full one would wrap in its 72 px. */
  short?: string;
  href: string;
  icon: IconName;
  /** The letter after G that goes here. */
  go: string;
  /**
   * Main sections sit in the sidebar, the rail and the phone tab bar. Home's pages sit in the sidebar and
   * the rail only, since the phone reaches them from Home. A drawer has no entry in any of them.
   */
  section: 'main' | 'home-page' | 'drawer' | 'account';
};

export const NAV: readonly NavItem[] = [
  { key: 'home', label: 'Home', href: '/home', icon: 'home', go: 'h', section: 'main' },
  { key: 'activity', label: 'Activity', href: '/activity', icon: 'receipt-text', go: 'a', section: 'main' },
  { key: 'budget', label: 'Budget', href: '/budget', icon: 'chart-box', go: 'b', section: 'main' },
  { key: 'debts', label: 'Debts', href: '/debts', icon: 'handshake-outline', go: 'd', section: 'main' },
  { key: 'wallets', label: 'Wallets', href: '/home/wallets', icon: 'wallet-outline', go: 'w', section: 'home-page' },
  { key: 'places', label: 'Spending map', short: 'Map', href: '/home/places', icon: 'map-marker-outline', go: 'm', section: 'home-page' },
  { key: 'review', label: 'Review', href: reviewHref(), icon: 'tray-full', go: 'r', section: 'drawer' },
  { key: 'settings', label: 'Settings', href: '/settings', icon: 'cog-outline', go: 's', section: 'account' },
];

/** The phone tab bar's four: Home, Activity, Budget and Debts. */
export const MAIN_NAV = NAV.filter((item) => item.section === 'main');

/** The sidebar and the rail: the four, then Wallets and Spending map. */
export const SIDE_NAV = NAV.filter((item) => item.section === 'main' || item.section === 'home-page');

export function navItem(key: Destination): NavItem {
  return NAV.find((item) => item.key === key)!;
}

/** The destination a path belongs to, the most specific one (Wallets over Home), or null outside the app. */
export function destinationOf(pathname: string): Destination | null {
  const matches = NAV.filter((item) => item.section !== 'drawer' && (pathname === item.href || pathname.startsWith(`${item.href}/`)));
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.key ?? null;
}
