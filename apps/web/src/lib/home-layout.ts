/**
 * Customise Home (W2-Home, editing): Spent stays first; the other five cards sit in fixed slots, swap
 * by dragging one onto another, and each can be hidden. The phone layout shows them in the same order.
 */
export const HOME_CARDS = ['review', 'recent', 'next', 'map', 'wallets'] as const;
export type HomeCard = (typeof HOME_CARDS)[number];

export const HOME_CARD_LABELS: Record<HomeCard | 'spent', string> = {
  spent: 'Spent',
  review: 'Review',
  recent: 'Recent',
  next: 'Next 14 days',
  map: 'Where you spend',
  wallets: 'Wallets',
};

export type HomeLayout = {
  /** The card in each slot: beside Spent, the left column, the middle top, the middle bottom, the right column. */
  slots: readonly HomeCard[];
  hidden: readonly HomeCard[];
};

export const DEFAULT_HOME_LAYOUT: HomeLayout = { slots: HOME_CARDS, hidden: [] };

const isCard = (value: unknown): value is HomeCard => HOME_CARDS.includes(value as HomeCard);

/** A stored layout, or the default when it is missing, malformed or names a card twice. */
export function parseHomeLayout(raw: string | null): HomeLayout {
  try {
    const value = JSON.parse(raw ?? 'null') as { slots?: unknown; hidden?: unknown } | null;
    const slots = Array.isArray(value?.slots) ? value.slots.filter(isCard) : [];
    if (slots.length !== HOME_CARDS.length || new Set(slots).size !== slots.length) return DEFAULT_HOME_LAYOUT;
    const hidden = Array.isArray(value?.hidden) ? [...new Set(value.hidden.filter(isCard))] : [];
    return { slots, hidden };
  } catch {
    return DEFAULT_HOME_LAYOUT;
  }
}

export function swapCards(layout: HomeLayout, a: HomeCard, b: HomeCard): HomeLayout {
  if (a === b) return layout;
  return { ...layout, slots: layout.slots.map((card) => (card === a ? b : card === b ? a : card)) };
}

export function toggleCard(layout: HomeLayout, card: HomeCard): HomeLayout {
  return {
    ...layout,
    hidden: layout.hidden.includes(card) ? layout.hidden.filter((each) => each !== card) : [...layout.hidden, card],
  };
}
