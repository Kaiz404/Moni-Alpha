import type { AddMode } from './add-entry';
import type { IconName } from './icons';
import { NAV, type Destination } from './nav';

/** What a palette row does when it runs. The shell owns the effects; this module only lists them. */
export type CommandAction =
  | { kind: 'go'; to: Destination }
  | { kind: 'add'; mode?: Exclude<AddMode, 'choose'> }
  | { kind: 'ask' }
  | { kind: 'theme'; theme: 'light' | 'dark' }
  | { kind: 'shortcuts' }
  | { kind: 'fold' }
  | { kind: 'signOut' };

export type CommandGroup = 'Go to' | 'Actions';

export type Command = {
  id: string;
  group: CommandGroup;
  title: string;
  icon: IconName | 'cat';
  /** Key hints shown at the row's end, pressed in order. */
  keys?: readonly string[];
  keywords?: readonly string[];
  action: CommandAction;
};

export type ResultGroup = { group: CommandGroup; items: Command[] };

const GROUP_ORDER: readonly CommandGroup[] = ['Go to', 'Actions'];

/** At most this many rows per group while typing, as W2-Parts draws the results. */
export const ROWS_PER_GROUP = 3;

export function buildCommands({ resolvedTheme }: { resolvedTheme: 'light' | 'dark' }): Command[] {
  const goTo: Command[] = NAV.map((item) => ({
    id: `go-${item.key}`,
    group: 'Go to',
    title: item.label,
    icon: item.icon,
    keys: ['G', item.go.toUpperCase()],
    action: { kind: 'go', to: item.key },
  }));
  const other = resolvedTheme === 'dark' ? 'light' : 'dark';
  const actions: Command[] = [
    { id: 'add', group: 'Actions', title: 'Add a transaction', icon: 'plus', keys: ['N'], keywords: ['new', 'expense', 'spend'], action: { kind: 'add' } },
    { id: 'ask', group: 'Actions', title: 'Ask Moni', icon: 'cat', keys: ['/'], keywords: ['chat', 'question'], action: { kind: 'ask' } },
    {
      id: 'theme',
      group: 'Actions',
      title: `Switch to ${other} theme`,
      icon: other === 'dark' ? 'weather-night' : 'white-balance-sunny',
      keywords: ['appearance', 'theme', 'mode'],
      action: { kind: 'theme', theme: other },
    },
    { id: 'fold', group: 'Actions', title: 'Fold or open the sidebar', icon: 'dock-left', keys: ['['], keywords: ['collapse', 'expand', 'rail', 'sidebar'], action: { kind: 'fold' } },
    { id: 'shortcuts', group: 'Actions', title: 'Keyboard shortcuts', icon: 'keyboard-outline', keys: ['?'], keywords: ['keys', 'help'], action: { kind: 'shortcuts' } },
    { id: 'sign-out', group: 'Actions', title: 'Sign out', icon: 'logout', keywords: ['log out', 'leave'], action: { kind: 'signOut' } },
  ];
  return [...goTo, ...actions];
}

function matches(command: Command, query: string): boolean {
  const haystack = [command.title, ...(command.keywords ?? [])].join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** The palette's rows for what's typed, grouped in a fixed order. An empty query lists everything. */
export function filterCommands(commands: readonly Command[], query: string): ResultGroup[] {
  const typed = query.trim();
  return GROUP_ORDER.map((group) => {
    const inGroup = commands.filter((c) => c.group === group && (typed === '' || matches(c, typed)));
    return { group, items: typed === '' ? inGroup : inGroup.slice(0, ROWS_PER_GROUP) };
  }).filter((result) => result.items.length > 0);
}
