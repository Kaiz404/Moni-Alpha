/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 *
 * Prefer semantic Uniwind classes (`text-foreground`, `bg-background`) for layout.
 * Use this hook only when a RN `style` color prop is required.
 */

import { Colors } from '@/constants/theme';
import { useThemeTokens } from '@/hooks/use-theme-tokens';
import { useUniwind } from 'uniwind';

const tokenByName = {
  text: 'foreground',
  background: 'background',
  tint: 'primary',
  accent: 'accent',
  icon: 'muted',
  tabIconDefault: 'muted',
  tabIconSelected: 'primary',
} as const;

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark,
) {
  const { theme } = useUniwind();
  const tokens = useThemeTokens();
  const colorFromProps = props[theme === 'dark' ? 'dark' : 'light'];

  if (colorFromProps) {
    return colorFromProps;
  }

  const tokenKey = tokenByName[colorName];
  return tokens[tokenKey];
}
