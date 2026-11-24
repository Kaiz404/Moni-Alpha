import { describe, expect, it } from 'vitest';
import { DEFAULT_HOME_LAYOUT, parseHomeLayout, swapCards, toggleCard } from '../home-layout';

describe('Customise Home', () => {
  it('swaps two cards between their slots and leaves the rest in place', () => {
    expect(swapCards(DEFAULT_HOME_LAYOUT, 'recent', 'map').slots).toEqual(['review', 'map', 'next', 'recent']);
  });

  it('hides a card and shows it again', () => {
    const hidden = toggleCard(DEFAULT_HOME_LAYOUT, 'map');
    expect(hidden.hidden).toEqual(['map']);
    expect(toggleCard(hidden, 'map').hidden).toEqual([]);
  });

  it('reads back what it stored, and falls back to the default for anything else', () => {
    const layout = toggleCard(swapCards(DEFAULT_HOME_LAYOUT, 'review', 'next'), 'recent');
    expect(parseHomeLayout(JSON.stringify(layout))).toEqual({ slots: ['next', 'recent', 'review', 'map'], hidden: ['recent'] });
    expect(parseHomeLayout(null)).toEqual(DEFAULT_HOME_LAYOUT);
    expect(parseHomeLayout('{"slots":["review","review","next","map"]}')).toEqual(DEFAULT_HOME_LAYOUT);
    expect(parseHomeLayout('not json')).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('drops the Wallets card from a layout saved before Home lost it, keeping the rest in order', () => {
    expect(parseHomeLayout('{"slots":["map","recent","wallets","next","review"],"hidden":["wallets","next"]}')).toEqual({
      slots: ['map', 'recent', 'next', 'review'],
      hidden: ['next'],
    });
  });
});
