import { TintBubble, type TintBubbleSize } from '@/components/ui/transaction-row';
import type { IconSymbolName } from '@/components/ui/icon-symbol';

/** A custom category's bubble: its colour solid with an Ink glyph, in both themes. */
export function CategoryBubble({
  icon,
  color,
  size = 42,
}: {
  icon: IconSymbolName;
  color: string;
  size?: TintBubbleSize;
}) {
  return <TintBubble icon={icon} color={color} size={size} />;
}
