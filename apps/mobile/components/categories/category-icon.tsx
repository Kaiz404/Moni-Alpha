import { IconSymbol } from '@/components/ui/icon-symbol';

type CategoryIconProps = {
  icon: string | null | undefined;
  color: string;
  size?: number;
};

/** Category icons are always rendered through the Material Design icon boundary. */
export function CategoryIcon({
  icon,
  color,
  size = 20,
}: CategoryIconProps) {
  return (
    <IconSymbol
      color={color}
      name={(icon || 'shape-outline') as any}
      size={size}
    />
  );
}
