import { NAV, type Destination } from './nav';

/** The shell-wide keys (W2-Parts' shortcuts dialog, "Anywhere" and "Go to"). Screens add their own later. */
export type ShortcutAction =
  | { kind: 'palette' }
  | { kind: 'close' }
  | { kind: 'ask' }
  | { kind: 'shortcuts' }
  | { kind: 'add' }
  | { kind: 'fold' }
  | { kind: 'undo' }
  | { kind: 'go'; to: Destination };

export type KeyInput = {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  /** The focus is in a text field, where only Ctrl K and Esc act. */
  typing: boolean;
};

/** True after G, waiting for the section letter. */
export type KeyState = { afterG: boolean };

export const INITIAL_KEY_STATE: KeyState = { afterG: false };

const IDLE = (action: ShortcutAction | null = null) => ({ state: INITIAL_KEY_STATE, action });

export function keyStep(state: KeyState, input: KeyInput): { state: KeyState; action: ShortcutAction | null } {
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  const command = input.ctrl || input.meta;
  if (command && !input.alt && key === 'k') return IDLE({ kind: 'palette' });
  if (key === 'Escape') return IDLE({ kind: 'close' });
  if (input.typing || input.alt) return IDLE();
  if (command) return IDLE(key === 'z' ? { kind: 'undo' } : null);

  if (state.afterG) {
    const item = NAV.find((nav) => nav.go === key);
    return IDLE(item ? { kind: 'go', to: item.key } : null);
  }
  switch (key) {
    case 'g':
      return { state: { afterG: true }, action: null };
    case '/':
      return IDLE({ kind: 'ask' });
    case '?':
      return IDLE({ kind: 'shortcuts' });
    case 'n':
      return IDLE({ kind: 'add' });
    case '[':
      return IDLE({ kind: 'fold' });
    default:
      return IDLE();
  }
}

export type ShortcutRow = { label: string; keys: readonly string[] };

export const SHORTCUT_GROUPS: readonly { title: string; rows: readonly ShortcutRow[] }[] = [
  {
    title: 'Anywhere',
    rows: [
      { label: 'Search or ask Moni', keys: ['Ctrl', 'K'] },
      { label: 'Add a transaction', keys: ['N'] },
      { label: 'Moni chat', keys: ['/'] },
      { label: 'Fold or open the sidebar', keys: ['['] },
      { label: 'Undo', keys: ['Ctrl', 'Z'] },
      { label: 'These shortcuts', keys: ['?'] },
      { label: 'Close', keys: ['Esc'] },
    ],
  },
  { title: 'Go to', rows: NAV.map((item) => ({ label: item.label, keys: ['G', item.go.toUpperCase()] })) },
  {
    title: 'Home',
    rows: [
      { label: 'Pace', keys: ['P'] },
      { label: 'Daily', keys: ['D'] },
    ],
  },
  {
    title: 'Activity',
    rows: [
      { label: 'Next and previous row', keys: ['J', 'K'] },
      { label: 'Tick the row', keys: ['X'] },
      { label: 'Open details', keys: ['Enter'] },
      { label: 'Edit category', keys: ['C'] },
      { label: 'Delete', keys: ['Del'] },
    ],
  },
  {
    title: 'Budget',
    rows: [
      { label: 'Next and previous category', keys: ['J', 'K'] },
      { label: 'Edit the budget', keys: ['E'] },
    ],
  },
  {
    title: 'Debts',
    rows: [
      { label: 'Next and previous person', keys: ['J', 'K'] },
      { label: 'Record a repayment', keys: ['R'] },
      { label: 'Remind', keys: ['M'] },
      { label: 'Record a debt', keys: ['D'] },
    ],
  },
  {
    title: 'Review',
    rows: [
      { label: 'Next and previous capture', keys: ['J', 'K'] },
      { label: 'Select the capture', keys: ['Space'] },
      { label: 'Approve', keys: ['A'] },
      { label: 'Not mine', keys: ['X'] },
    ],
  },
  {
    title: 'Moni chat',
    rows: [
      { label: 'Send', keys: ['Enter'] },
      { label: 'New line', keys: ['Shift', 'Enter'] },
      { label: 'Approve the draft in focus', keys: ['Enter'] },
      { label: 'Close', keys: ['Esc'] },
    ],
  },
];
