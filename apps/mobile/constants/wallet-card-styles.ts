/**
 * Curated wallet card gradients aligned to the Moni pastel palette.
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
  /** Accessible foreground colours for this pastel surface. */
  contentColor: string;
  contentMutedColor: string;
  actionOverlayColor: string;
};

const PASTEL_CONTENT = {
  contentColor: '#1E211E',
  contentMutedColor: '#454B44',
  actionOverlayColor: 'rgba(30, 33, 30, 0.12)',
} as const;

export const WALLET_CARD_STYLES: WalletCardStyle[] = [
  {
    id: 'emerald-grain',
    label: 'Mint',
    colors: ['#DCEFE0', '#8ECF9D'],
    angle: 135,
    swatchHex: '#8ECF9D',
    ...PASTEL_CONTENT,
  },
  {
    id: 'citrus-pop',
    label: 'Lemon',
    colors: ['#F7F7F2', '#F1DC78'],
    angle: 135,
    swatchHex: '#F1DC78',
    ...PASTEL_CONTENT,
  },
  {
    id: 'coral-bloom',
    label: 'Coral',
    colors: ['#F7F7F2', '#F19A91'],
    angle: 135,
    swatchHex: '#F19A91',
    ...PASTEL_CONTENT,
  },
  {
    id: 'ocean-deep',
    label: 'Aqua',
    colors: ['#F7F7F2', '#9CD9D1'],
    angle: 135,
    swatchHex: '#9CD9D1',
    ...PASTEL_CONTENT,
  },
  {
    id: 'violet-dusk',
    label: 'Lilac',
    colors: ['#F7F7F2', '#C9B7F4'],
    angle: 135,
    swatchHex: '#C9B7F4',
    ...PASTEL_CONTENT,
  },
  {
    id: 'midnight-mint',
    label: 'Mint shade',
    colors: ['#EFF0EA', '#8ECF9D'],
    angle: 160,
    swatchHex: '#236B47',
    ...PASTEL_CONTENT,
  },
  {
    id: 'rose-quartz',
    label: 'Peach',
    colors: ['#F7F7F2', '#F7C6A8'],
    angle: 135,
    swatchHex: '#F7C6A8',
    ...PASTEL_CONTENT,
  },
  {
    id: 'slate-steel',
    label: 'Neutral',
    colors: ['#F7F7F2', '#EFF0EA'],
    angle: 150,
    swatchHex: '#7B8179',
    ...PASTEL_CONTENT,
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
