/**
 * The phone's wallet card surfaces. Each colour's id, label, swatch and tint come from `@repo/core`'s
 * `WALLET_COLOURS`, which the web shares; add a colour there first, then its surface here.
 */

import { walletColour } from '@repo/core';

import type { BubbleTint } from '@/components/ui/nav-row';

function colour(id: string) {
  const { hex, ...rest } = walletColour(id);
  return { ...rest, swatchHex: hex };
}

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
  /** The v2 pastel its 42 list bubble takes (V2H-Wallets draws Aqua for an Aqua wallet). */
  tint: BubbleTint;
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
    ...colour('emerald-grain'),
    backgroundColor: '#8ECF9D',
    colors: ['#C8E6D4', '#8ECF9D'],
    angle: 135,
    ...PASTEL_CONTENT,
  },
  {
    ...colour('citrus-pop'),
    backgroundColor: '#E8CF50',
    colors: ['#F7F7F2', '#E8CF50'],
    angle: 135,
    ...PASTEL_CONTENT,
  },
  {
    ...colour('coral-bloom'),
    backgroundColor: '#E87D72',
    colors: ['#F7F7F2', '#E87D72'],
    angle: 135,
    ...PASTEL_CONTENT,
  },
  {
    ...colour('ocean-deep'),
    backgroundColor: '#72CEC4',
    colors: ['#F7F7F2', '#72CEC4'],
    angle: 135,
    ...PASTEL_CONTENT,
  },
  {
    ...colour('violet-dusk'),
    backgroundColor: '#B39AE8',
    colors: ['#F7F7F2', '#B39AE8'],
    angle: 135,
    ...PASTEL_CONTENT,
  },
  {
    ...colour('midnight-mint'),
    backgroundColor: '#236B47',
    colors: ['#E5E9DC', '#8ECF9D'],
    angle: 160,
    contentColor: '#F4F5EF',
    contentMutedColor: '#E0EEE3',
    actionOverlayColor: 'rgba(244, 245, 239, 0.16)',
  },
  {
    ...colour('rose-quartz'),
    backgroundColor: '#F0AD85',
    colors: ['#F7F7F2', '#F0AD85'],
    angle: 135,
    ...PASTEL_CONTENT,
  },
  {
    ...colour('slate-steel'),
    backgroundColor: '#E5E9DC',
    colors: ['#F7F7F2', '#E5E9DC'],
    angle: 150,
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
