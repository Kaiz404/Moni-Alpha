import { describe, expect, it } from 'vitest';
import { DEFAULT_HOME_LAYOUT, parseHomeLayout, swapCards, toggleCard } from '../home-layout';

describe('Customise Home', () => {
  it('swaps two cards between their slots and leaves the rest in place', () => {
    expect(swapCards(DEFAULT_HOME_LAYOUT, 'recent', 'wallets').slots).toEqual(['review', 'wallets', 'next', 'map', 'recent']);
  });

  it('hides a card and shows it again', () => {
    const hidden = toggleCard(DEFAULT_HOME_LAYOUT, 'map');
    expect(hidden.hidden).toEqual(['map']);
    expect(toggleCard(hidden, 'map').hidden).toEqual([]);
  });

  it('reads back what it stored, and falls back to the default for anything else', () => {
    const layout = toggleCard(swapCards(DEFAULT_HOME_LAYOUT, 'review', 'next'), 'recent');
    expect(parseHomeLayout(JSON.stringify(layout))).toEqual({ slots: ['next', 'recent', 'review', 'map', 'wallets'], hidden: ['recent'] });
    expect(parseHomeLayout(null)).toEqual(DEFAULT_HOME_LAYOUT);
    expect(parseHomeLayout('{"slots":["review","review","next","map","wallets"]}')).toEqual(DEFAULT_HOME_LAYOUT);
    expect(parseHomeLayout('not json')).toEqual(DEFAULT_HOME_LAYOUT);
  });
});
