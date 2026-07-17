import { View, type ViewProps } from 'react-native';

type SurfaceTone = 'default' | 'muted' | 'raised' | 'tray';

type SurfaceProps = ViewProps & {
  className?: string;
  tone?: SurfaceTone;
};

const toneClass: Record<SurfaceTone, string> = {
  default: 'border border-border bg-card',
  muted: 'border border-border-subtle bg-surface-2',
  raised: 'border border-border bg-surface-raised',
  tray: 'border border-primary/15 bg-surface-tray',
};

/** Matte, low-elevation container used for genuine grouped content only. */
export function Surface({
  className,
  tone = 'default',
  ...props
}: SurfaceProps) {
  return (
    <View
      className={`rounded-[22px] ${toneClass[tone]} ${className ?? ''}`}
      {...props}
    />
  );
}
