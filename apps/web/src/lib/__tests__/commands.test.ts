import { describe, expect, it } from 'vitest';
import { buildCommands, filterCommands } from '../commands';

const titles = (query: string, resolvedTheme: 'light' | 'dark' = 'light') =>
  filterCommands(buildCommands({ resolvedTheme }), query).map(({ group, items }) => [group, items.map((c) => c.title)]);

describe('filterCommands', () => {
  it('lists every place and action when nothing is typed', () => {
    expect(titles('')).toEqual([
      ['Go to', ['Home', 'Activity', 'Budget', 'Debts', 'Review', 'Settings']],
      ['Actions', ['Add a transaction', 'Ask Moni', 'Switch to dark theme', 'Keyboard shortcuts', 'Sign out']],
    ]);
  });

  it('matches titles and keywords without case', () => {
    expect(titles('BUD')).toEqual([['Go to', ['Budget']]]);
    expect(titles('theme')).toEqual([['Actions', ['Switch to dark theme']]]);
    expect(titles('log out')).toEqual([['Actions', ['Sign out']]]);
  });

  it('needs every typed word', () => {
    expect(titles('add spend')).toEqual([['Actions', ['Add a transaction']]]);
    expect(titles('add debts')).toEqual([]);
  });

  it('keeps at most three rows a group while typing', () => {
    expect(titles('e')).toEqual([
      ['Go to', ['Home', 'Budget', 'Debts']],
      ['Actions', ['Add a transaction', 'Ask Moni', 'Switch to dark theme']],
    ]);
  });

  it('offers the other theme', () => {
    expect(titles('switch', 'dark')).toEqual([['Actions', ['Switch to light theme']]]);
  });

  it('finds nothing for words no row has', () => {
    expect(titles('klcc')).toEqual([]);
  });
});
