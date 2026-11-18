'use client';

import { createContext, useContext } from 'react';
import type { CommandAction } from '@/lib/commands';
import type { ShortcutAction } from '@/lib/keys';

export type ShellAction = CommandAction | ShortcutAction | { kind: 'account' } | { kind: 'closePane' };

export type ShellUser = {
  name: string;
  initial: string;
  currency: string;
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
