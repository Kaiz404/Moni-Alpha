import { View } from 'react-native';
import { useUniwind } from 'uniwind';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { TintBubble } from '@/components/ui/transaction-row';
import { useThemeTokens } from '@/hooks/use-theme-tokens';

/**
 * A custom category's bubble. Custom colours are already light pastels, so in light
 * mode they fill the bubble solid, as V2A-CategoryForm previews them; dark uses the
 * shared dark tint with the pastel glyph (V2F-Dark).
 */
export function CategoryBubble({
  icon,
  color,
}: {
  icon: IconSymbolName;
  color: string;
}) {
  const tokens = useThemeTokens();
  const dark = useUniwind().theme === 'dark';
  if (dark) return <TintBubble icon={icon} color={color} />;
  return (
    <View
      className="h-[42px] w-[42px] items-center justify-center rounded-full"
      style={{ backgroundColor: color }}
    >
      <IconSymbol name={icon} size={20} color={tokens.onPastel} />
    </View>
  );
}
