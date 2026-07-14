/**
 * Curated, colour-theory-balanced wallet card gradients.
 *
 * This list is the single place designers/devs extend when adding a new
 * card style — appending an entry here immediately makes it selectable in
 * the wallet create/edit forms. `id` is persisted on `wallets.card_style_id`;
 * never rename an existing `id` (wallets already reference it), only append.
 */

export type WalletCardStyle = {
  id: string;
  label: string;
  /** LinearGradient stops, applied top-left -> bottom-right by default. */
  colors: [string, string, ...string[]];
  angle: number;
  /** Flat hex used for charts/legends/small dots where a gradient can't render. */
  swatchHex: string;
  /** Grain overlay opacity bucket — darker gradients read well with more grain. */
  grain: 'subtle' | 'medium';
};

export const WALLET_CARD_STYLES: WalletCardStyle[] = [
  {
    id: 'emerald-grain',
    label: 'Emerald',
    colors: ['#0f766e', '#22c55e'],
    angle: 135,
    swatchHex: '#059669',
    grain: 'medium',
  },
  {
    id: 'citrus-pop',
    label: 'Citrus',
    colors: ['#f59e0b', '#fde047'],
    angle: 135,
    swatchHex: '#d97706',
    grain: 'subtle',
  },
  {
    id: 'coral-bloom',
    label: 'Coral',
    colors: ['#be123c', '#fb7185'],
    angle: 135,
    swatchHex: '#db2777',
    grain: 'subtle',
  },
  {
    id: 'ocean-deep',
    label: 'Ocean',
    colors: ['#075985', '#38bdf8'],
    angle: 135,
    swatchHex: '#0284c7',
    grain: 'medium',
  },
  {
    id: 'violet-dusk',
    label: 'Violet',
    colors: ['#5b21b6', '#a78bfa'],
    angle: 135,
    swatchHex: '#7c3aed',
    grain: 'subtle',
  },
  {
    id: 'midnight-mint',
    label: 'Midnight',
    colors: ['#020617', '#0f766e'],
    angle: 160,
    swatchHex: '#0a0a0a',
    grain: 'medium',
  },
  {
    id: 'rose-quartz',
    label: 'Rose',
    colors: ['#9d174d', '#f472b6'],
    angle: 135,
    swatchHex: '#db2777',
    grain: 'subtle',
  },
  {
    id: 'slate-steel',
    label: 'Slate',
    colors: ['#1e293b', '#64748b'],
    angle: 150,
    swatchHex: '#334155',
    grain: 'medium',
  },
];

export const DEFAULT_WALLET_CARD_STYLE_ID = WALLET_CARD_STYLES[0].id;

/** Looks up a style by id, gracefully falling back if a preset is ever retired. */
export function getWalletCardStyle(id: string | null | undefined): WalletCardStyle {
  return (
    WALLET_CARD_STYLES.find((style) => style.id === id) ??
    WALLET_CARD_STYLES.find((style) => style.id === DEFAULT_WALLET_CARD_STYLE_ID)!
  );
}
