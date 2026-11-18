/** Corner radii in px (dp on the phone). Capsules use the framework's full radius. */
export const radii = {
  card: 26,
  tile: 22,
  field: 16,
  sheet: 32,
} as const;

/** Named spacing in px: screen sides, section gap, card padding, icon bubble, minimum touch target. */
export const spacing = {
  screen: 20,
  section: 24,
  card: 18,
  bubble: 42,
  touch: 44,
} as const;
