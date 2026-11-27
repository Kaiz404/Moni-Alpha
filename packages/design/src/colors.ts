/**
 * Colour roles, light and dark, in the order the generated CSS lists them. Light values come from
 * docs/redesign/tokens.md, dark from the V2F-Dark board. Each group prints as one block; a note
 * prints as a comment above its role in the light block.
 */
export type ColorRoleEntry = readonly [name: string, light: string, dark: string, note?: string];

export const colorGroups = [
  [
    ['background', '#f6f2e9', '#0b0a09'],
    ['background-muted', '#ece5d6', '#2d2a27'],
    ['canvas', '#f6f2e9', '#0b0a09'],
    ['card', '#fffdf8', '#1d1b19'],
    ['surface-1', '#fffdf8', '#1d1b19'],
    ['surface-2', '#ece5d6', '#2d2a27'],
    ['surface-raised', '#fffdf8', '#1d1b19'],
    ['surface-tray', '#efe8da', '#252320'],
  ],
  [
    ['foreground', '#17181a', '#f6f3ed'],
    ['muted', '#6b665c', '#a39c90'],
    ['border', '#ddd5c5', '#443f38'],
    ['border-subtle', '#efe8da', '#252320'],
    ['border-strong', '#b9b0a0', '#80796d'],
  ],
  [
    ['primary', '#17181a', '#f6f3ed'],
    ['primary-foreground', '#fffdf8', '#0b0a09'],
    ['primary-muted', '#d3eed9', '#123422'],
    ['accent', '#8ecf9d', '#66d68a'],
    ['accent-lilac', '#a98cf5', '#987aff'],
    ['accent-peach', '#ff9f66', '#f58d47'],
    ['accent-lemon', '#f7cf3a', '#f0c42c'],
    ['accent-coral', '#ff7f70', '#f5685a'],
    ['accent-aqua', '#4cc8ba', '#30bea6'],
  ],
  [
    ['success', '#236b47', '#72de97'],
    ['danger', '#b23e35', '#ff7366'],
    ['warning', '#6b5410', '#f0cf5a'],
    ['income', '#236b47', '#72de97'],
    ['expense', '#17181a', '#f6f3ed'],
    ['transfer', '#6b665c', '#a39c90'],
    ['state-pending', '#3e3654', '#c9b7ff'],
    ['state-attention', '#6b5410', '#f0cf5a'],
    ['state-approved', '#174831', '#72de97'],
    ['state-destructive', '#8e2f28', '#ff8a7e'],
  ],
  [
    ['chart-1', '#6fd08c', '#59c97d'],
    ['chart-2', '#62a8ee', '#4ca4f5'],
    ['chart-3', '#a98cf5', '#987aff'],
    ['chart-4', '#f7cf3a', '#f0c42c'],
    ['chart-5', '#ff7f70', '#f5685a'],
    ['chart-6', '#ff9f66', '#f58d47'],
  ],
  [
    ['sand', '#ece5d6', '#2d2a27'],
    ['sand-light', '#efe8da', '#252320'],
    ['hairline', '#ddd5c5', '#443f38'],
    ['track', '#ece5d6', '#252320'],
    ['ink-2', '#4a463e', '#cec8bd'],
    ['inactive', '#a9a397', '#a39c90'],
    ['tab-bar', '#17181a', '#242220'],
    ['on-tab-bar', '#fffdf8', '#f6f3ed'],
    ['on-pastel', '#17181a', '#f6f3ed'],
    [
      'on-category',
      '#17181a',
      '#17181a',
      'Glyph on a solid category, wallet or action bubble: Ink in both themes.',
    ],
    ['on-mint-key', '#17181a', '#0b2416'],
    [
      'block-mint',
      '#a9ddb5',
      '#123422',
      'Blocks, pills and buttons: pastel in light, tonal in dark. mint, lemon, lilac... below are marks.',
    ],
    ['block-lemon', '#f2dc72', '#352b0c'],
    ['block-lilac', '#c9b6f0', '#2d2452'],
    ['block-peach', '#f5be98', '#3d2616'],
    ['deep-mint', '#236b47', '#72de97'],
    ['mint', '#6fd08c', '#59c97d'],
    ['mint-key', '#8ecf9d', '#66d68a'],
    ['mint-key-pressed', '#7dc48d', '#59c97d'],
    ['lemon', '#f7cf3a', '#f0c42c'],
    ['lilac', '#a98cf5', '#987aff'],
    ['peach', '#ff9f66', '#f58d47'],
    ['coral', '#ff7f70', '#f5685a'],
    ['sky', '#62a8ee', '#4ca4f5'],
    ['aqua', '#4cc8ba', '#30bea6'],
    ['over', '#b23e35', '#ff7366'],
    ['primary-pressed', '#2e2f33', '#ddd8ce'],
    ['mint-pressed', '#9ad3a8', '#1a4530'],
    ['destructive-fill', '#f9d5d0', '#3d1d19'],
    ['destructive-pressed', '#f3c3bc', '#4d2620'],
    ['moni-glyph', '#c9b6f0', '#4a3596'],
    ['attention-fill', '#f8edb8', '#352b0c'],
    ['pending-fill', '#e4daf6', '#2d2452'],
    ['bloom', '#e3d8c2', '#443f38'],
    ['on-ink-positive', '#a9ddb5', '#236b47'],
    ['on-lemon', '#6b5410', '#f0cf5a', 'Secondary text on a block.'],
    ['on-lilac', '#3e3654', '#c9b7ff'],
    ['on-mint', '#174831', '#72de97'],
    ['on-ink-meta', '#a9a397', '#6b655c', 'Secondary text on an Ink card (AI moments).'],
    ['on-ink-body', '#efe8da', '#2d2a27'],
  ],
  [
    [
      'moni-card',
      '#17181a',
      '#1d1b19',
      "Moni's chat cards and bubbles: Ink in light, a dark surface in dark, never cream (#146).",
    ],
    ['on-moni-card', '#fffdf8', '#f6f3ed'],
    ['on-moni-card-meta', '#a9a397', '#a39c90'],
    ['on-moni-card-body', '#efe8da', '#cec8bd'],
    ['moni-card-glyph', '#c9b6f0', '#c9b7ff'],
    ['moni-card-raised', '#fffdf8', '#2d2a27', 'A panel or chip on a Moni card; foreground reads on it.'],
    ['moni-card-action', '#fffdf8', '#f6f3ed', "A Moni card's main button."],
    ['on-moni-card-action', '#17181a', '#0b0a09'],
    ['moni-card-quiet', '#363430', '#2d2a27', "A Moni card's second button."],
    ['moni-card-pressed', '#4a463e', '#443f38'],
  ],
] as const satisfies readonly (readonly ColorRoleEntry[])[];

export type ColorRole = (typeof colorGroups)[number][number][0];

const roles: readonly ColorRoleEntry[] = colorGroups.flat();

export const colorRoleNames = roles.map(([name]) => name) as readonly ColorRole[];

export const lightColors = Object.fromEntries(
  roles.map(([name, light]) => [name, light]),
) as Record<ColorRole, string>;

export const darkColors = Object.fromEntries(roles.map(([name, , dark]) => [name, dark])) as Record<
  ColorRole,
  string
>;
