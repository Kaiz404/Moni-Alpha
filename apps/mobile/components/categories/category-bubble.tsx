import { View } from 'react-native';
import { useUniwind } from 'uniwind';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import {
  BUBBLE_GLYPH,
  TintBubble,
  type TintBubbleSize,
} from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

/**
 * A custom category's bubble. Custom colours are already light pastels, so in light
 * mode they fill the bubble solid, as V2A-CategoryForm previews them; dark uses the
 * shared dark tint with the pastel glyph (V2F-Dark).
 */
export function CategoryBubble({
  icon,
  color,
  size = 42,
}: {
  icon: IconSymbolName;
  color: string;
  size?: TintBubbleSize;
}) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  if (dark) return <TintBubble icon={icon} color={color} size={size} />;
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <IconSymbol name={icon} size={BUBBLE_GLYPH[size]} color={tokens.onPastel} />
    </View>
  );
}
