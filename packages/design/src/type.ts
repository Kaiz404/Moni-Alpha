/** The one family. The web loads it as a variable font; the phone loads one static file per weight. */
export const fontFamily = 'Funnel Display';

/** Each face by its token name: the Expo font key the phone uses and the CSS weight the web uses. */
export const fontFaces = {
  display: { expo: 'FunnelDisplay_400Regular', weight: 400 },
  'display-semibold': { expo: 'FunnelDisplay_600SemiBold', weight: 600 },
  'display-bold': { expo: 'FunnelDisplay_700Bold', weight: 700 },
} as const;

export type FontFace = keyof typeof fontFaces;

export type TypeStyle = {
  readonly face: FontFace;
  readonly size: number;
  readonly line: number;
  /** Letter spacing in em: −0.02 from 18 up, −0.03 on the hero, +0.04 on caps. */
  readonly tracking: number;
  readonly uppercase?: boolean;
};

/** The V2F-Bible type scale, sizes and line heights in px. */
export const typeScale = {
  hero: { face: 'display-bold', size: 64, line: 64, tracking: -0.03 },
  amountHero: { face: 'display-bold', size: 52, line: 54, tracking: -0.02 },
  screenTitle: { face: 'display-bold', size: 28, line: 32, tracking: -0.02 },
  sectionTitle: { face: 'display-bold', size: 22, line: 26, tracking: -0.02 },
  cardTitle: { face: 'display-bold', size: 18, line: 22, tracking: -0.02 },
  rowTitle: { face: 'display-semibold', size: 16, line: 22, tracking: 0 },
  body: { face: 'display', size: 15, line: 21, tracking: 0 },
  meta: { face: 'display', size: 13, line: 18, tracking: 0 },
  smallest: { face: 'display', size: 12, line: 16, tracking: 0 },
  caps: { face: 'display-bold', size: 12, line: 16, tracking: 0.04, uppercase: true },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof typeScale;
