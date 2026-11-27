'use client';

import { createContext, useContext } from 'react';
import type { CommandAction } from '@/lib/commands';
import type { ShortcutAction } from '@/lib/keys';

export type ShellAction = CommandAction | ShortcutAction | { kind: 'account' } | { kind: 'closePane' };

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  initial: string;
  /** The sign-in provider's photo, such as Google's; null for an email sign-in. */
  photoUrl: string | null;
  currency: string;
  /** The profile's finance timezone; null reads days in the browser's zone. */
  zone: string | null;
};

export type Pane = 'chat' | 'add' | null;

export type ShellApi = {
  user: ShellUser;
  pane: Pane;
  run: (action: ShellAction, origin?: HTMLElement | null) => void;
  /** A link to `href` that keeps the docked Moni chat open. */
  hrefWithPane: (href: string) => string;
};

export const ShellContext = createContext<ShellApi | null>(null);

export function useShellApi(): ShellApi {
  const api = useContext(ShellContext);
  if (!api) throw new Error('useShellApi needs the app shell');
  return api;
}
