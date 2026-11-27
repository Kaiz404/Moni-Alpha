import { describe, expect, it } from 'vitest';
import { destinationOf, MAIN_NAV, SIDE_NAV } from '../nav';

describe('nav', () => {
  it('lights the most specific place for a path and its pages', () => {
    expect(destinationOf('/home')).toBe('home');
    expect(destinationOf('/home/wallets')).toBe('wallets');
    expect(destinationOf('/home/wallets/7f1c')).toBe('wallets');
    expect(destinationOf('/home/places')).toBe('places');
    expect(destinationOf('/activity/abc')).toBe('activity');
    expect(destinationOf('/homework')).toBeNull();
  });

  it('puts Wallets and Map in the sidebar after Debts, one word each, and keeps the tab bar to four', () => {
    expect(SIDE_NAV.map((item) => item.label)).toEqual(['Home', 'Activity', 'Budget', 'Debts', 'Wallets', 'Map']);
    expect(SIDE_NAV.filter((item) => item.label.includes(' '))).toEqual([]);
    expect(MAIN_NAV.map((item) => item.label)).toEqual(['Home', 'Activity', 'Budget', 'Debts']);
  });
});
