/**
 * Curated solid wallet card colors aligned to the Moni pastel palette.
 *
 * This list is the single place designers/devs extend when adding a new
 * card style — appending an entry here immediately makes it selectable in
 * the wallet create/edit forms. `id` is persisted on `wallets.card_style_id`;
 * never rename an existing `id` (wallets already reference it), only append.
 */

export type WalletCardStyle = {
  id: string;
  label: string;
  /** Solid fill applied to wallet cards and their previews. */
  backgroundColor: string;
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
    backgroundColor: '#8ECF9D',
    colors: ['#C8E6D4', '#8ECF9D'],
    angle: 135,
    swatchHex: '#8ECF9D',
    ...PASTEL_CONTENT,
  },
  {
    id: 'citrus-pop',
    label: 'Lemon',
    backgroundColor: '#E8CF50',
    colors: ['#F7F7F2', '#E8CF50'],
    angle: 135,
    swatchHex: '#E8CF50',
    ...PASTEL_CONTENT,
  },
  {
    id: 'coral-bloom',
    label: 'Coral',
    backgroundColor: '#E87D72',
    colors: ['#F7F7F2', '#E87D72'],
    angle: 135,
    swatchHex: '#E87D72',
    ...PASTEL_CONTENT,
  },
  {
    id: 'ocean-deep',
    label: 'Aqua',
    backgroundColor: '#72CEC4',
    colors: ['#F7F7F2', '#72CEC4'],
    angle: 135,
    swatchHex: '#72CEC4',
    ...PASTEL_CONTENT,
  },
  {
    id: 'violet-dusk',
    label: 'Lilac',
    backgroundColor: '#B39AE8',
    colors: ['#F7F7F2', '#B39AE8'],
    angle: 135,
    swatchHex: '#B39AE8',
    ...PASTEL_CONTENT,
  },
  {
    id: 'midnight-mint',
    label: 'Mint shade',
    backgroundColor: '#236B47',
    colors: ['#E5E9DC', '#8ECF9D'],
    angle: 160,
    swatchHex: '#236B47',
    contentColor: '#F4F5EF',
    contentMutedColor: '#E0EEE3',
    actionOverlayColor: 'rgba(244, 245, 239, 0.16)',
  },
  {
    id: 'rose-quartz',
    label: 'Peach',
    backgroundColor: '#F0AD85',
    colors: ['#F7F7F2', '#F0AD85'],
    angle: 135,
    swatchHex: '#F0AD85',
    ...PASTEL_CONTENT,
  },
  {
    id: 'slate-steel',
    label: 'Neutral',
    backgroundColor: '#E5E9DC',
    colors: ['#F7F7F2', '#E5E9DC'],
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
